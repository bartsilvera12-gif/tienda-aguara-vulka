# Aguara + Vulka — Payments API (PagoPar)

Backend Node mínimo para procesar pagos con PagoPar. Corre en la **misma VPS**
que el Supabase (`api.neura.com.py`) y se expone bajo el prefijo **`/pagopar`**.
El sitio estático (Hostinger, `aguarafitwear.com.py`) lo llama por CORS.

No depende de base de datos para cobrar: el pedido vive durante la transacción.
La persistencia en Supabase (`aguaravulka.web_pedidos`) es **opcional**.

## Endpoints

| Método | Ruta (pública)                                   | Uso                                  |
|--------|--------------------------------------------------|--------------------------------------|
| GET    | `https://api.neura.com.py/pagopar/health`        | Smoke test (verifica claves cargadas)|
| POST   | `https://api.neura.com.py/pagopar/create-payment`| El sitio crea la transacción         |
| GET    | `https://api.neura.com.py/pagopar/status?hash=`  | La página de gracias consulta estado |
| POST   | `https://api.neura.com.py/pagopar/webhook`       | PagoPar notifica cambios de estado   |

## Configuración (`.env`)

Copiar `.env.example` a `.env` (en la VPS) y completar. Obligatorio:

- `PAGOPAR_PUBLIC_KEY` / `PAGOPAR_PRIVATE_KEY`: credenciales del comercio
  (panel PagoPar). En pruebas: las de **DESARROLLO** + `PAGOPAR_ENV=staging`.
  En vivo: las de **PRODUCCIÓN** + `PAGOPAR_ENV=production`.
- `PAGOPAR_RETURN_URL`: `https://aguarafitwear.com.py/gracias-por-su-compra/?hash=${hash}`
- `PAGOPAR_WEBHOOK_URL`: `https://api.neura.com.py/pagopar/webhook`
- `ALLOWED_ORIGINS`: `https://aguarafitwear.com.py,https://www.aguarafitwear.com.py`

La clave privada y la `SUPABASE_SERVICE_ROLE_KEY` **nunca** se commitean.

## Correr local

```bash
cd server
npm install
cp .env.example .env    # y completar
npm run dev
curl http://localhost:8788/pagopar/health
```

## Deploy en la VPS

1. **Copiar `server/` a la VPS** (git clone del repo o scp de la carpeta).
2. `cd server && npm install`.
3. Crear `server/.env` con las claves (ver `.env.example`).
4. Proceso persistente con PM2:
   ```bash
   pm2 start src/index.js --name aguara-payments
   pm2 save
   ```
5. **Nginx**: proxyear el prefijo `/pagopar/` al puerto local **8788** en el
   server block que ya atiende `api.neura.com.py` (SSL ya existente):
   ```nginx
   location /pagopar/ {
     proxy_pass         http://127.0.0.1:8788;
     proxy_set_header   Host $host;
     proxy_set_header   X-Forwarded-Proto https;
     proxy_set_header   X-Real-IP $remote_addr;
   }
   ```
   > El server monta las rutas en `/pagopar/*`, así que **no** hay reescritura
   > de path: nginx pasa la URL tal cual.
6. Recargar nginx: `nginx -t && systemctl reload nginx`.
7. Verificar: `curl https://api.neura.com.py/pagopar/health`.

## Panel de PagoPar (Comercio → Configuración)

Cargar (pestaña DESARROLLO para pruebas, PRODUCCIÓN para vivo):

- **URL de redireccionamiento (return)**: `https://aguarafitwear.com.py/gracias-por-su-compra/?hash=$hash`
- **URL de respuesta (webhook)**: `https://api.neura.com.py/pagopar/webhook`

`forma_pago=9` (todos los medios) se configura en el panel.

## Test end-to-end

```bash
curl -X POST https://api.neura.com.py/pagopar/create-payment \
  -H "Content-Type: application/json" \
  -d '{
    "monto_total": 150000,
    "comprador": { "nombre":"Test", "documento":"1234567", "telefono":"0981000000",
                   "email":"test@example.com", "direccion":"Av Test 123", "tipo_documento":"CI" },
    "items": [ { "nombre":"Calza Test", "cantidad":1, "precio_unitario":150000 } ]
  }'
```

Respuesta esperada: JSON con `paymentLink`, `hash`, `ref`. Abrir `paymentLink`
lleva al portal de PagoPar (con claves de DESARROLLO es una transacción de prueba).
