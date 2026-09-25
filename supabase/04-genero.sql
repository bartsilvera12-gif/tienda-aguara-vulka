-- ============================================================
--  Agrega el campo "genero" a productos (Hombre / Mujer / Unisex)
--  Correr una vez en Supabase -> SQL Editor.
-- ============================================================

alter table aguaravulka.productos
  add column if not exists genero text not null default 'unisex';

-- (opcional) Reglas: valores permitidos
-- alter table aguaravulka.productos add constraint genero_valido
--   check (genero in ('hombre','mujer','unisex'));
