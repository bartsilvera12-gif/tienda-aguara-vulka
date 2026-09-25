-- ============================================================
--  Códigos de descuento (influencers) — Correr una vez.
-- ============================================================

create table if not exists aguaravulka.descuentos (
  id         uuid primary key default gen_random_uuid(),
  codigo     text unique not null,
  porcentaje numeric not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on aguaravulka.descuentos to anon;
grant all    on aguaravulka.descuentos to authenticated, service_role;

alter table aguaravulka.descuentos enable row level security;

drop policy if exists "lectura publica" on aguaravulka.descuentos;
drop policy if exists "escritura admin" on aguaravulka.descuentos;

create policy "lectura publica" on aguaravulka.descuentos for select using (true);
create policy "escritura admin" on aguaravulka.descuentos for all to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py')
  with check ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');

-- Códigos iniciales (15%)
insert into aguaravulka.descuentos (codigo, porcentaje) values
  ('ANN26', 15), ('PAUL26', 15), ('GLADYS26', 15), ('JAZ26', 15)
on conflict (codigo) do nothing;
