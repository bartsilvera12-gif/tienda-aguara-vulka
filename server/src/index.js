/**
 * Aguara + Vulka Payments API — backend Node minimo para procesar pagos con PagoPar.
 *
 * Corre en la misma VPS que el Supabase (api.neura.com.py) y se expone bajo el
 * prefijo /pagopar (nginx proxyea /pagopar/ -> http://127.0.0.1:8788). El sitio
 * (HTML estatico en Hostinger: aguarafitwear.com.py) lo llama por CORS.
 *
 * ARQUITECTURA (deliberadamente simple):
 *   1. Frontend arma el pedido (items + comprador + total) y hace POST a
 *      /pagopar/create-payment.
 *   2. El server firma la transaccion con SHA1 y llama a PagoPar. Devuelve el
 *      paymentLink (URL de checkout) y el hash.
 *   3. El navegador redirige a paymentLink. PagoPar cobra, y despues:
 *        - vuelve al usuario a PAGOPAR_RETURN_URL (/gracias-por-su-compra/?hash=...)
 *        - notifica server-to-server al PAGOPAR_WEBHOOK_URL
 *   4. El webhook valida la firma y responde el eco que PagoPar espera.
 *   La persistencia en Supabase es OPCIONAL (best-effort): si no esta
 *   configurada, el cobro igual funciona.
 *
 * Endpoints (todos bajo /pagopar):
 *   GET  /pagopar/health                 — smoke test
 *   POST /pagopar/create-payment         — crea la transaccion, devuelve URL
 *   GET  /pagopar/status?hash=           — consulta estado (para la pagina de gracias)
 *   POST /pagopar/webhook                — notificacion de PagoPar (sin CORS)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  buildStartTransactionToken,
  checkoutUrlFromHash,
  consultarPedidoPagopar,
  getPagoparEndpoints,
  iniciarTransaccion,
  isPagoparRespuestaOk,
  maskPagoparCredential,
  phpStrvalFloatval,
  verifyWebhookToken,
} from "./pagopar.js";
import { guardarPedidoWeb, marcarPedidoPagado } from "./db.js";

const PORT = Number(process.env.PORT || 8788);

// ── Config ──────────────────────────────────────────────────────────────────
const PAGOPAR_PUBLIC_KEY =
  process.env.PAGOPAR_PUBLIC_KEY || process.env.PAGOPAR_PUBLIC_TOKEN || "";
const PAGOPAR_PRIVATE_KEY =
  process.env.PAGOPAR_PRIVATE_KEY || process.env.PAGOPAR_PRIVATE_TOKEN || "";
const PAGOPAR_RETURN_URL = process.env.PAGOPAR_RETURN_URL || "";
const PAGOPAR_WEBHOOK_URL = process.env.PAGOPAR_WEBHOOK_URL || "";
const PAGOPAR_FORMA_PAGO = Number(process.env.PAGOPAR_FORMA_PAGO || 9);
const PAGOPAR_ORDER_WRAPPER =
  String(process.env.PAGOPAR_ORDER_WRAPPER || "").trim() === "1";
const PAGOPAR_ITEM_CATEGORIA = String(process.env.PAGOPAR_ITEM_CATEGORIA || "909");
const PAGOPAR_ITEM_CIUDAD = String(process.env.PAGOPAR_ITEM_CIUDAD || "1");
const PAGOPAR_ITEM_PRODUCTO_ID = String(process.env.PAGOPAR_ITEM_PRODUCTO_ID || "895");
const PAGOPAR_ITEM_IMAGEN_URL =
  process.env.PAGOPAR_ITEM_IMAGEN_URL || "https://www.pagopar.com/static/img/logo.png";
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TIENDA = "Aguara Fitwear + Vulka";

function requireEnv() {
  const faltan = [];
  if (!PAGOPAR_PUBLIC_KEY) faltan.push("PAGOPAR_PUBLIC_KEY");
  if (!PAGOPAR_PRIVATE_KEY) faltan.push("PAGOPAR_PRIVATE_KEY");
  if (!PAGOPAR_RETURN_URL) faltan.push("PAGOPAR_RETURN_URL");
  if (!PAGOPAR_WEBHOOK_URL) faltan.push("PAGOPAR_WEBHOOK_URL");
  if (faltan.length) {
    throw new Error(
      "Faltan variables en .env: " + faltan.join(", ") + " (ver server/.env.example)"
    );
  }
}

// ── App ─────────────────────────────────────────────────────────────────────
const app = express();
app.disable("x-powered-by");
// El webhook puede llegar como JSON, form-urlencoded o texto plano. Se captura
// el body RAW antes de parsearlo. Se guarda el string original en req.rawBody.
app.use("/pagopar/webhook", express.raw({ type: "*/*", limit: "1mb" }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString("utf8");
    try {
      req.body = JSON.parse(req.rawBody);
    } catch (_) {
      const params = new URLSearchParams(req.rawBody);
      const obj = {};
      let hadPayload = false;
      for (const [k, v] of params) {
        obj[k] = v;
        if (k === "payload" || k === "data" || k === "body") {
          try { req.body = JSON.parse(v); hadPayload = true; break; } catch (_) {}
        }
      }
      if (!hadPayload) req.body = Object.keys(obj).length ? obj : req.rawBody;
    }
  }
  next();
});
app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length === 0) return cb(null, true); // dev: sin filtro
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`[cors] origin no permitido: ${origin}`));
    },
    credentials: false,
  })
);

app.get("/pagopar/health", (_req, res) => {
  let endpoints = null;
  try {
    endpoints = getPagoparEndpoints();
  } catch (e) {
    endpoints = { error: e instanceof Error ? e.message : String(e) };
  }
  res.json({
    ok: true,
    tienda: TIENDA,
    env: process.env.NODE_ENV || "development",
    pagopar: {
      env: endpoints?.env,
      publicKey: maskPagoparCredential(PAGOPAR_PUBLIC_KEY),
      privateKey: maskPagoparCredential(PAGOPAR_PRIVATE_KEY),
      returnUrl: PAGOPAR_RETURN_URL || "(sin definir)",
      webhookUrl: PAGOPAR_WEBHOOK_URL || "(sin definir)",
    },
    time: new Date().toISOString(),
  });
});

// ── Helpers de payload ─────────────────────────────────────────────────────
function randomIdPedidoComercio() {
  return Math.floor(100_000_000 + Math.random() * 900_000_000);
}
function s(v, max = 200) {
  return String(v == null ? "" : v).slice(0, max);
}
function digitsOnly(v, max = 20) {
  return String(v == null ? "" : v).replace(/\D/g, "").slice(0, max);
}

/** Comprador con las 11 claves exactas que valida la API. */
function buildComprador(input) {
  const telefono = digitsOnly(input.telefono, 20) || "0000000";
  const documento = digitsOnly(input.documento, 20) || telefono.slice(-7);
  return {
    ruc: s(input.ruc, 20),
    email: s(input.email, 200) || "sin-email@aguarafitwear.com.py",
    ciudad: s(input.ciudad || "1", 10),
    nombre: s(input.nombre, 200) || "Cliente",
    telefono,
    direccion: s(input.direccion, 200),
    documento,
    coordenadas: "",
    razon_social: s(input.razon_social, 200),
    tipo_documento: s(input.tipo_documento || "CI", 20),
    direccion_referencia: s(input.direccion_referencia, 200),
  };
}

/** Un item por transaccion con precio_total = monto_total del pedido. */
function buildCompraItem(descripcion, montoTotal) {
  return {
    ciudad: PAGOPAR_ITEM_CIUDAD,
    nombre: s(descripcion, 200) || ("Compra " + TIENDA),
    cantidad: 1,
    categoria: PAGOPAR_ITEM_CATEGORIA,
    public_key: PAGOPAR_PUBLIC_KEY,
    url_imagen: PAGOPAR_ITEM_IMAGEN_URL,
    descripcion: s(descripcion, 500) || ("Compra " + TIENDA),
    id_producto: PAGOPAR_ITEM_PRODUCTO_ID,
    precio_total: Math.max(0, Math.round(Number(montoTotal) || 0)),
    vendedor_telefono: "",
    vendedor_direccion: "",
    vendedor_direccion_referencia: "",
    vendedor_direccion_coordenadas: "",
  };
}

function buildDescripcionResumen(items) {
  if (!Array.isArray(items) || items.length === 0) return "Compra " + TIENDA;
  const partes = items.map((it) => {
    const cant = Number(it.cantidad || 1);
    const nombre = s(it.nombre, 60);
    return cant > 1 ? `${cant}x ${nombre}` : nombre;
  });
  return s(partes.join(" · "), 500);
}

// ── /pagopar/create-payment ────────────────────────────────────────────────
app.post("/pagopar/create-payment", async (req, res) => {
  try {
    requireEnv();
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: "items vacio" });
    }

    const totalCalculado = items.reduce((acc, it) => {
      const cant = Math.max(1, Math.round(Number(it.cantidad) || 1));
      const pu = Math.max(0, Math.round(Number(it.precio_unitario) || 0));
      return acc + cant * pu;
    }, 0);
    const totalCliente = Math.round(Number(body.monto_total) || 0);
    if (Math.abs(totalCalculado - totalCliente) > 1) {
      return res.status(400).json({
        error: "monto_total no coincide con la suma de items",
        detalle: { totalCalculado, totalCliente },
      });
    }
    if (totalCalculado <= 0) {
      return res.status(400).json({ error: "monto_total invalido" });
    }

    const comprador = buildComprador(body.comprador || {});
    const descripcion = buildDescripcionResumen(items);

    const idPedidoComercio = randomIdPedidoComercio();
    const ref = String(idPedidoComercio);
    const token = buildStartTransactionToken(
      PAGOPAR_PRIVATE_KEY,
      idPedidoComercio,
      totalCalculado
    );
    const fechaMax = new Date();
    fechaMax.setDate(fechaMax.getDate() + 3);
    const fecha_maxima_pago = fechaMax.toISOString().slice(0, 19).replace("T", " ");

    const pagoparBody = {
      token,
      public_key: PAGOPAR_PUBLIC_KEY,
      compras_items: [buildCompraItem(descripcion, totalCalculado)],
      monto_total: totalCalculado,
      tipo_pedido: "VENTA-COMERCIO",
      fecha_maxima_pago,
      id_pedido_comercio: idPedidoComercio,
      descripcion_resumen: descripcion,
      comprador,
    };

    const payload = PAGOPAR_ORDER_WRAPPER ? { orderPagopar: pagoparBody } : pagoparBody;

    console.info("[create-payment] iniciando", {
      id_pedido_comercio: idPedidoComercio,
      monto_total: totalCalculado,
      monto_strval: phpStrvalFloatval(totalCalculado),
      forma_pago: PAGOPAR_FORMA_PAGO,
      items: items.length,
    });

    const pp = await iniciarTransaccion(payload);
    if (!isPagoparRespuestaOk(pp.respuesta)) {
      console.error("[create-payment] pagopar rechazo", pp);
      return res.status(502).json({
        error: "PagoPar rechazo la transaccion",
        pagopar: pp,
      });
    }

    let hash = null;
    const r = pp?.resultado;
    if (Array.isArray(r) && r[0]) {
      hash = r[0].data || r[0].hash_pedido || r[0].hash || null;
    }
    if (!hash) {
      return res.status(502).json({
        error: "PagoPar no devolvio hash de pedido",
        pagopar: pp,
      });
    }

    const paymentLink = checkoutUrlFromHash(hash);

    // Persistir el pedido (estado pendiente) — best-effort.
    try {
      const pedido = {
        id_pedido_comercio: idPedidoComercio,
        cliente_nombre: comprador.nombre,
        cliente_email: comprador.email,
        cliente_telefono: comprador.telefono,
        cliente_documento: comprador.documento,
        ciudad_codigo: String(comprador.ciudad || "1"),
        direccion: comprador.direccion || "",
        modalidad: String(body.modalidad || "envio"),
        observaciones: String(body.observaciones || ""),
        subtotal: totalCalculado,
        envio: 0,
        total: totalCalculado,
        estado_pago: "pendiente",
        estado_envio: "pendiente",
        pagopar_hash: String(hash),
        pagopar_link: paymentLink,
      };
      const lineas = items.map((it) => {
        const cant = Math.max(1, Math.round(Number(it.cantidad) || 1));
        const pu = Math.max(0, Math.round(Number(it.precio_unitario) || 0));
        return {
          producto_codigo: String(it.codigo || it.producto_codigo || "web"),
          nombre: String(it.nombre || "Producto"),
          color: String(it.color || ""),
          cantidad: cant,
          precio_unitario: pu,
          total_linea: cant * pu,
        };
      });
      await guardarPedidoWeb(pedido, lineas);
    } catch (dbErr) {
      console.error("[create-payment] no se pudo guardar el pedido:", dbErr?.message || dbErr);
    }

    return res.json({
      paymentLink,
      hash: String(hash),
      ref,
      id_pedido_comercio: idPedidoComercio,
    });
  } catch (e) {
    console.error("[create-payment] error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
});

// ── /pagopar/status?hash= ──────────────────────────────────────────────────
app.get("/pagopar/status", async (req, res) => {
  try {
    requireEnv();
    const hash = String(req.query.hash || "").trim();
    if (!hash) return res.status(400).json({ error: "falta hash" });

    const result = await consultarPedidoPagopar(hash, {
      publicKey: PAGOPAR_PUBLIC_KEY,
      privateKey: PAGOPAR_PRIVATE_KEY,
    });
    return res.json(result);
  } catch (e) {
    console.error("[status] error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
});

// ── /pagopar/webhook ───────────────────────────────────────────────────────
app.post("/pagopar/webhook", async (req, res) => {
  try {
    requireEnv();

    let src = req.body;
    if (typeof src === "string") {
      try { src = JSON.parse(src); } catch (_) { src = {}; }
    }
    src = src || {};

    let inner = src;
    let formato = "A_plano";
    if (Array.isArray(src)) {
      inner = src[0] || {};
      formato = "A_plano";
    } else if (src && Array.isArray(src.resultado) && src.resultado[0]) {
      inner = src.resultado[0];
      formato = "B_envuelto";
    }

    const hashPedido = String(inner.hash_pedido || inner.hash || inner.data || "").trim();
    const tokenRecibido = String(inner.token || "").trim();

    console.info("[webhook] recibido", {
      hashPedido: hashPedido || "(vacio)",
      formato,
      tieneToken: !!tokenRecibido,
      shape: Array.isArray(req.body) ? "array" : typeof req.body,
      keys: Object.keys(inner),
      pagado: inner.pagado,
    });

    if (!hashPedido) {
      return res.status(400).json({ error: "no pude extraer hash_pedido del body" });
    }

    if (tokenRecibido) {
      const ok = verifyWebhookToken(PAGOPAR_PRIVATE_KEY, hashPedido, tokenRecibido);
      if (!ok) {
        console.warn("[webhook] token invalido para hash", hashPedido);
        return res.status(401).json({ error: "token invalido" });
      }
    }

    const estaPagado = inner.pagado === true || String(inner.pagado).toLowerCase() === "true";
    if (estaPagado) {
      marcarPedidoPagado(hashPedido, { pagopar_forma_pago: s(inner.forma_pago) || null })
        .then(() => console.info("[webhook] pedido marcado pagado", hashPedido))
        .catch((e) => console.error("[webhook] no se pudo marcar pagado:", e?.message || e));
    }

    consultarPedidoPagopar(hashPedido, {
      publicKey: PAGOPAR_PUBLIC_KEY,
      privateKey: PAGOPAR_PRIVATE_KEY,
    })
      .then((r) => console.info("[webhook] estado consultado", {
        hashPedido, resultado: r?.resultado?.[0],
      }))
      .catch((e) => console.warn("[webhook] error al consultar estado", e?.message || e));

    // Eco que PagoPar espera para dar por confirmado el webhook.
    return res.json([inner]);
  } catch (e) {
    console.error("[webhook] error", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.listen(PORT, () => {
  console.info(`[aguara-payments] escuchando en :${PORT}`);
  try {
    const ep = getPagoparEndpoints();
    console.info("[aguara-payments] pagopar env=%s api=%s checkout=%s", ep.env, ep.apiBase, ep.checkoutBase);
  } catch (e) {
    console.warn("[aguara-payments] pagopar sin resolver:", e.message);
  }
});
