-- ============================================================
--  Envios por zona/ciudad + Promos con fechas y "delivery gratis"
--  Correr una vez en Supabase -> SQL Editor.
-- ============================================================

create table if not exists aguaravulka.zonas_envio (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  zona       text,
  costo      bigint not null default 0,
  orden      int not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on aguaravulka.zonas_envio to anon;
grant all    on aguaravulka.zonas_envio to authenticated, service_role;

alter table aguaravulka.zonas_envio enable row level security;
drop policy if exists "lectura publica" on aguaravulka.zonas_envio;
drop policy if exists "escritura admin" on aguaravulka.zonas_envio;
create policy "lectura publica" on aguaravulka.zonas_envio for select using (true);
create policy "escritura admin" on aguaravulka.zonas_envio for all to authenticated
  using (true) with check (true);

-- Tarifas por ciudad (solo si la tabla esta vacia; despues se editan en el panel).
insert into aguaravulka.zonas_envio (nombre, zona, costo, orden)
select v.nombre, v.zona, v.costo, v.orden
from (values
  ('Fernando de la Mora', 'Central', 25000, 0),
  ('Asunción', 'Central', 25000, 1),
  ('San Lorenzo', 'Central', 25000, 2),
  ('Luque', 'Central', 25000, 3),
  ('Lambaré', 'Central', 25000, 4),
  ('Mariano Roque Alonso', 'Central', 30000, 5),
  ('Villa Elisa', 'Central', 35000, 6),
  ('Ñemby', 'Central', 35000, 7),
  ('Capiatá', 'Central', 30000, 8),
  ('Limpio', 'Central', 35000, 9),
  ('Areguá', 'Central', 35000, 10),
  ('San Antonio', 'Central', 35000, 11),
  ('Itauguá', 'Central', 35000, 12),
  ('J. Augusto Saldívar', 'Central', 35000, 13),
  ('Ypané', 'Central', 40000, 14),
  ('Itá', 'Central', 40000, 15),
  ('Villeta', 'Central', 40000, 16),
  ('Guarambaré', 'Central', 40000, 17),
  ('Ypacaraí', 'Central', 35000, 18),
  ('Nueva Italia', 'Central', 40000, 19),
  ('Caacupé', 'Zona 2', 35000, 20),
  ('Caaguazú', 'Zona 2', 35000, 21),
  ('Campo 9', 'Zona 2', 35000, 22),
  ('Carmen del Paraná', 'Zona 2', 35000, 23),
  ('Ciudad del Este', 'Zona 2', 35000, 24),
  ('Coronel Oviedo', 'Zona 2', 35000, 25),
  ('Encarnación', 'Zona 2', 35000, 26),
  ('Hernandarias', 'Zona 2', 35000, 27),
  ('Juan E. O’Leary', 'Zona 2', 35000, 28),
  ('Minga Guazú', 'Zona 2', 35000, 29),
  ('Presidente Franco', 'Zona 2', 35000, 30),
  ('Santa Rita', 'Zona 3', 40000, 31),
  ('Pedro Juan Caballero', 'Zona 3', 40000, 32),
  ('Concepción', 'Zona 3', 40000, 33),
  ('Pilar', 'Zona 3', 40000, 34),
  ('Villarrica', 'Zona 3', 40000, 35),
  ('Salto del Guairá', 'Zona 3', 40000, 36),
  ('San Ignacio', 'Zona 3', 40000, 37),
  ('San Juan Bautista', 'Zona 3', 40000, 38),
  ('Hohenau', 'Zona 3', 40000, 39),
  ('Obligado', 'Zona 3', 40000, 40),
  ('Bella Vista Sur', 'Zona 3', 40000, 41),
  ('Coronel Bogado', 'Zona 3', 40000, 42),
  ('Capitán Miranda', 'Zona 3', 40000, 43),
  ('Capitán Meza', 'Zona 3', 40000, 44),
  ('Caazapá', 'Zona 3', 40000, 45),
  ('Paraguarí', 'Zona 3', 40000, 46),
  ('Carapeguá', 'Zona 3', 40000, 47),
  ('San Bernardino', 'Zona 3', 40000, 48),
  ('Piribebuy', 'Zona 3', 40000, 49),
  ('Tobatí', 'Zona 3', 40000, 50),
  ('Santaní', 'Zona 3', 40000, 51),
  ('Curuguaty', 'Zona 3', 40000, 52),
  ('Katueté', 'Zona 3', 40000, 53),
  ('Ybycuí', 'Zona 3', 40000, 54),
  ('Yaguarón', 'Zona 3', 40000, 55),
  ('San José de los Arroyos', 'Zona 3', 40000, 56),
  ('Colonia Yguazú', 'Zona 3', 40000, 57),
  ('María Auxiliadora', 'Zona 3', 40000, 58),
  ('Ayolas', 'Zona 3', 40000, 59),
  ('Quiindy', 'Zona 3', 40000, 60),
  ('Acahay', 'Zona 3', 40000, 61),
  ('Altos', 'Zona 3', 40000, 62),
  ('Arroyos y Esteros', 'Zona 3', 40000, 63),
  ('Benjamin Aceval', 'Zona 3', 40000, 64),
  ('Eusebio Ayala', 'Zona 3', 40000, 65),
  ('Jesús', 'Zona 3', 40000, 66),
  ('Trinidad', 'Zona 3', 40000, 67),
  ('Villa Hayes', 'Zona 3', 40000, 68),
  ('Juan León Mallorquín', 'Zona 3', 40000, 69),
  ('Minga Porá', 'Zona 3', 40000, 70),
  ('San Alberto', 'Zona 3', 40000, 71),
  ('Naranjal', 'Zona 3', 40000, 72),
  ('Itakyry', 'Zona 3', 40000, 73),
  ('Otras localidades no listadas', 'Zona 4', 50000, 74)
) as v(nombre, zona, costo, orden)
where not exists (select 1 from aguaravulka.zonas_envio);

-- ---- Promociones: fechas + delivery gratis (+ productos para el futuro) ----
alter table aguaravulka.promociones add column if not exists fecha_desde     date;
alter table aguaravulka.promociones add column if not exists fecha_hasta     date;
alter table aguaravulka.promociones add column if not exists delivery_gratis boolean not null default false;
alter table aguaravulka.promociones add column if not exists producto_ids    text;

notify pgrst, 'reload schema';
