-- ============================================================
--  Tienda Aguará + Vulka — Esquema Supabase "aguaravulka"
--  Correr en: Supabase -> SQL Editor -> New query -> pegar -> Run
--  Luego correr 02-seed.sql (datos iniciales).
-- ============================================================

create schema if not exists aguaravulka;
grant usage on schema aguaravulka to anon, authenticated, service_role;

-- ---------- Tablas ----------
create table if not exists aguaravulka.categorias (
  id         uuid primary key default gen_random_uuid(),
  marca      text not null check (marca in ('aguara','vulka')),
  nombre     text not null,
  imagen     text,
  orden      int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists aguaravulka.productos (
  id           uuid primary key default gen_random_uuid(),
  marca        text not null check (marca in ('aguara','vulka')),
  categoria_id uuid references aguaravulka.categorias(id) on delete set null,
  nombre       text not null,
  precio       numeric,
  talles       text,
  descripcion  text,
  destacado    boolean not null default false,
  activo       boolean not null default true,
  montos       jsonb,
  imagen       text,
  orden        int  not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists aguaravulka.producto_imagenes (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references aguaravulka.productos(id) on delete cascade,
  url         text not null,
  orden       int  not null default 0
);

create table if not exists aguaravulka.portada_slides (
  id         uuid primary key default gen_random_uuid(),
  marca      text not null check (marca in ('aguara','vulka')),
  titulo     text,
  etiqueta   text,
  imagen     text,
  pos        text default '50% 30%',
  orden      int  not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Permisos base (RLS es el que realmente controla) ----------
grant select on all tables in schema aguaravulka to anon;
grant all    on all tables in schema aguaravulka to authenticated, service_role;
alter default privileges in schema aguaravulka grant select on tables to anon;
alter default privileges in schema aguaravulka grant all    on tables to authenticated, service_role;

-- ---------- RLS ----------
alter table aguaravulka.categorias        enable row level security;
alter table aguaravulka.productos         enable row level security;
alter table aguaravulka.producto_imagenes enable row level security;
alter table aguaravulka.portada_slides    enable row level security;

-- Lectura pública (para la tienda)
create policy "lectura publica" on aguaravulka.categorias        for select using (true);
create policy "lectura publica" on aguaravulka.productos         for select using (true);
create policy "lectura publica" on aguaravulka.producto_imagenes for select using (true);
create policy "lectura publica" on aguaravulka.portada_slides    for select using (true);

-- Escritura SÓLO para el admin (admin@aguaravulka.com.py)
create policy "escritura admin" on aguaravulka.categorias        for all to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py')
  with check ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');
create policy "escritura admin" on aguaravulka.productos         for all to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py')
  with check ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');
create policy "escritura admin" on aguaravulka.producto_imagenes for all to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py')
  with check ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');
create policy "escritura admin" on aguaravulka.portada_slides    for all to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py')
  with check ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');

-- ---------- Storage (bucket público para las fotos) ----------
insert into storage.buckets (id, name, public)
values ('aguaravulka','aguaravulka', true)
on conflict (id) do nothing;

create policy "av lectura publica" on storage.objects
  for select using (bucket_id = 'aguaravulka');
create policy "av subir admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'aguaravulka' and (auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');
create policy "av actualizar admin" on storage.objects
  for update to authenticated using (bucket_id = 'aguaravulka' and (auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');
create policy "av borrar admin" on storage.objects
  for delete to authenticated using (bucket_id = 'aguaravulka' and (auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');

-- ============================================================
--  IMPORTANTE (paso en el panel de Supabase):
--  Settings -> API -> "Exposed schemas": agregar  aguaravulka
--  (además de public). Sin esto la API no ve el esquema.
-- ============================================================
