-- ============================================================
--  Recarga la caché de esquema de PostgREST (Supabase API).
--  Necesario en self-hosted después de agregar columnas
--  (genero, colores) con ALTER TABLE — si no, la API da
--  error 400 "Could not find the 'X' column ... in the schema cache".
--  Correr en Supabase -> SQL Editor cada vez que se agregue/cambie
--  una columna o tabla.
-- ============================================================

notify pgrst, 'reload schema';
