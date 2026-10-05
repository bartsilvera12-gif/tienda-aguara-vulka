/**
 * Persistencia OPCIONAL de pedidos web en Supabase (schema aguaravulka).
 *
 * Usa `fetch` contra PostgREST (sin @supabase/supabase-js) para mantener el
 * backend liviano. Escribe con la SERVICE_ROLE_KEY, así que bypassa RLS. El
 * schema NO es `public`, por eso van los headers `Content-Profile`/`Accept-Profile`.
 *
 * Es best-effort: si Supabase no está configurado (falta URL/KEY) o falla, se
 * loguea y NO se corta el flujo de pago (el cobro con PagoPar ya sucedió; el
 * pedido simplemente no queda registrado). Correr antes supabase/11-pedidos-web.sql.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SCHEMA = (process.env.SUPABASE_SCHEMA || "aguaravulka").trim();

export function supabaseConfigurado() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    "Content-Profile": SCHEMA,
    "Accept-Profile": SCHEMA,
    ...extra,
  };
}

async function rest(path, opts) {
  const r = await fetch(SUPABASE_URL + "/rest/v1" + path, opts);
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`);
  }
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

/** Crea el pedido web (estado pendiente) + sus items. Devuelve el id. */
export async function guardarPedidoWeb(pedido, items) {
  if (!supabaseConfigurado()) {
    console.warn("[db] SUPABASE_URL/SERVICE_ROLE_KEY no configurados — el pedido NO se guarda");
    return null;
  }
  const rows = await rest("/web_pedidos", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(pedido),
  });
  const creado = Array.isArray(rows) ? rows[0] : rows;
  const pedidoId = creado && creado.id;
  if (!pedidoId) throw new Error("no se obtuvo el id del pedido creado");

  if (Array.isArray(items) && items.length > 0) {
    await rest("/web_pedido_items", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(items.map((it) => ({ ...it, pedido_id: pedidoId }))),
    });
  }
  return pedidoId;
}

/** Marca un pedido como pagado por su hash de PagoPar. Idempotente. */
export async function marcarPedidoPagado(hash, extra = {}) {
  if (!supabaseConfigurado()) return null;
  const h = encodeURIComponent(String(hash));
  return rest(`/web_pedidos?pagopar_hash=eq.${h}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      estado_pago: "pagado",
      pagado_at: new Date().toISOString(),
      ...extra,
    }),
  });
}
