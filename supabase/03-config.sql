-- ============================================================
--  Tabla de configuración (datos de contacto editables)
--  Correr una vez en Supabase -> SQL Editor.
-- ============================================================

create table if not exists aguaravulka.config (
  clave      text primary key,
  valor      text,
  updated_at timestamptz not null default now()
);

grant select on aguaravulka.config to anon;
grant all    on aguaravulka.config to authenticated, service_role;

alter table aguaravulka.config enable row level security;

create policy "lectura publica" on aguaravulka.config for select using (true);
create policy "escritura admin" on aguaravulka.config for all to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py')
  with check ((auth.jwt() ->> 'email') = 'admin@aguaravulka.com.py');

-- Valores por defecto
insert into aguaravulka.config (clave, valor) values
  ('whatsapp',  '595975517443'),
  ('email',     ''),
  ('ig_aguara', 'https://www.instagram.com/aguarafitwear'),
  ('ig_vulka',  ''),
  ('facebook',  'https://www.facebook.com/aguarafitwear'),
  ('direccion', ''),
  ('horario',   'Lunes a viernes para tus consultas')
on conflict (clave) do nothing;
