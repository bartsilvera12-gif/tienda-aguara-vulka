# Tienda Aguará + Vulka

Tienda web estática que reúne dos marcas paraguayas de indumentaria: **Aguará Fitwear** (deportivo) y **Vulka** (casual / oficina / tendencia).

## Cómo abrir la tienda

La tienda necesita un servidor local (no funciona abriendo el HTML con doble clic directo por `file://`).

### Opción rápida (Windows)
Doble clic en **`Abrir Tienda Aguara.bat`** — levanta un servidor local y abre el navegador.

### Manual
```bash
py -X utf8 -m http.server 8777
```
Luego abrir <http://localhost:8777/>.

## Estructura

| Archivo | Descripción |
|---|---|
| `Tienda Aguara Vulka.html` | Página principal de la tienda |
| `index.html` | Redirección a la tienda (evita 404 en la raíz) |
| `support.js` | Framework de componentes ("DC") |
| `vulka-catalog.js` | Catálogo de productos Vulka |
| `uploads/opt/` | Imágenes optimizadas (WebP) y logos |
| `Abrir Tienda Aguara.bat` | Lanzador para Windows |

## Notas

- Imágenes optimizadas a WebP para carga rápida.
- Incluye carrito, página de detalle de producto, selector de talles/cantidad y gift card.
