-- ============================================================
--  Arregla los permisos de escritura (RLS).
--  En Supabase self-hosted la validación por email a veces no
--  trae el claim y bloquea todo. Esta versión permite escribir
--  a cualquier usuario AUTENTICADO (al panel solo entra el admin).
--  Correr una vez en Supabase -> SQL Editor.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['categorias','productos','producto_imagenes','portada_slides','config','descuentos']
  loop
    -- borra políticas de escritura previas (si existen)
    execute format('drop policy if exists "escritura admin" on aguaravulka.%I', t);
    -- lectura pública (por si faltara)
    execute format('drop policy if exists "lectura publica" on aguaravulka.%I', t);
    execute format('create policy "lectura publica" on aguaravulka.%I for select using (true)', t);
    -- escritura para autenticados
    execute format('create policy "escritura admin" on aguaravulka.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Storage: permitir subir/editar/borrar a autenticados (lectura pública)
drop policy if exists "av subir admin" on storage.objects;
drop policy if exists "av actualizar admin" on storage.objects;
drop policy if exists "av borrar admin" on storage.objects;
create policy "av subir admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'aguaravulka');
create policy "av actualizar admin" on storage.objects
  for update to authenticated using (bucket_id = 'aguaravulka');
create policy "av borrar admin" on storage.objects
  for delete to authenticated using (bucket_id = 'aguaravulka');
