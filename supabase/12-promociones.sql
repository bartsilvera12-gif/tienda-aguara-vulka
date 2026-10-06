-- ============================================================
--  Promociones (banner editable desde el panel) — Correr una vez.
-- ============================================================

create table if not exists aguaravulka.promociones (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,
  activo      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

grant select on aguaravulka.promociones to anon;
grant all    on aguaravulka.promociones to authenticated, service_role;

alter table aguaravulka.promociones enable row level security;

drop policy if exists "lectura publica" on aguaravulka.promociones;
drop policy if exists "escritura admin" on aguaravulka.promociones;

create policy "lectura publica" on aguaravulka.promociones for select using (true);
-- Escritura para usuarios autenticados (self-hosted: el claim de email no siempre
-- está presente, por eso no se filtra por email como en tablas viejas).
create policy "escritura admin" on aguaravulka.promociones for all to authenticated
  using (true) with check (true);

-- Promo de ejemplo (desactivada para que no aparezca hasta que la actives).
insert into aguaravulka.promociones (titulo, descripcion, activo, orden)
values ('Envío gratis este fin de semana', 'En pedidos seleccionados', false, 0)
on conflict do nothing;

notify pgrst, 'reload schema';
