-- ============================================================
--  Agrega el campo "colores" a productos (separados por · )
--  Correr una vez en Supabase -> SQL Editor.
-- ============================================================

alter table aguaravulka.productos
  add column if not exists colores text;
