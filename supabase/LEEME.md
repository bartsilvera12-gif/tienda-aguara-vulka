# Panel de administración (Supabase) — Puesta en marcha

Sigue estos pasos **una sola vez** para dejar funcionando el panel y la tienda en vivo.

## 1. Correr el SQL
En Supabase → **SQL Editor** → New query:
1. Pegá y ejecutá `01-schema.sql` (crea el esquema `aguaravulka`, tablas, permisos y el bucket de fotos).
2. Pegá y ejecutá `02-seed.sql` (carga los productos, categorías y portadas actuales).

## 2. Exponer el esquema en la API
Supabase → **Settings → API → Exposed schemas** (o *Data API*): agregá **`aguaravulka`** a la lista (además de `public`) y guardá.
> Sin este paso la API no “ve” el esquema y el panel no carga datos.

## 3. Usuario admin
Ya está creado: **admin@aguaravulka.com.py**. Solo ese email puede editar (lo fuerzan las reglas RLS).
Si necesitás cambiar la contraseña: Supabase → Authentication → Users.

## 4. Conectar el sitio
Editá **`supabase-config.js`** (en la raíz del proyecto) y poné:
- `url`: la URL del proyecto (Settings → API → Project URL, ej. `https://xxxx.supabase.co`)
- `anonKey`: la **anon/public key** (Settings → API → Project API keys → `anon` `public`).
  - ⚠️ NO uses la `service_role` key.

## 5. Listo
- Panel: abrí **`admin.html`** → ingresá con el email/contraseña.
- La tienda (`index.html`) ya lee todo en vivo desde Supabase.
- Si Supabase no está configurado o falla, la tienda usa los datos locales de respaldo (no se rompe).

## Qué se puede hacer en el panel
- **Productos**: crear/editar/eliminar, elegir empresa (Aguará/Vulka) y categoría, precio, talles, destacado, activar/ocultar, imagen principal y **galería de fotos**.
- **Categorías**: crear/editar/eliminar en cada empresa, con **foto de categoría**.
- **Portadas**: editar las imágenes de portada de cada empresa (Aguará = carrusel, Vulka = portada única), con título, etiqueta y encuadre.

Las fotos que subís van al bucket `aguaravulka` (Storage) y quedan públicas para mostrarse en la tienda.
