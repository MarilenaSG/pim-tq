-- Migración 021: tabla tiendas
-- Fuente de verdad de las 19 tiendas de Te Quiero Joyerías Canarias.
-- El campo `nombre` coincide EXACTAMENTE con ventas_mensuales.tienda (clave de JOIN).
-- Cluster A = Flagship (8), B = Estándar (8), C = Pequeña (3).

create table tiendas (
  id           text primary key,
  nombre       text not null unique,      -- valor exacto en ventas_mensuales.tienda
  nombre_corto text,                      -- nombre de display en UI
  zona         text check (zona in ('Capital','Periferia','Turistica','Ecommerce')),
  tipo         text check (tipo in ('Flagship','Estandar','Pequeña','Almacen')),
  cluster      text check (cluster in ('A','B','C')),
  activo       boolean not null default true,
  es_almacen   boolean not null default false,
  created_at   timestamptz default now()
);

alter table tiendas disable row level security;

-- ── Cluster A — Flagship (8 tiendas) ────────────────────────────────────────
insert into tiendas (id, nombre, nombre_corto, zona, tipo, cluster) values
  ('cupido',      'Cupido',            'Cupido',       'Turistica', 'Flagship', 'A'),
  ('ecommerce',   'Ecommerce',         'Ecommerce',    'Ecommerce', 'Flagship', 'A'),
  ('galeon',      'Galeón',            'Galeón',       'Turistica', 'Flagship', 'A'),
  ('la_cuesta',   'La Cuesta',         'La Cuesta',    'Periferia', 'Flagship', 'A'),
  ('la_laguna',   'La Laguna',         'La Laguna',    'Capital',   'Flagship', 'A'),
  ('san_isidro',  'San Isidro',        'San Isidro',   'Periferia', 'Flagship', 'A'),
  ('taco',        'Taco',              'Taco',         'Periferia', 'Flagship', 'A'),
  ('villalba',    'Villalba',          'Villalba',     'Capital',   'Flagship', 'A');

-- ── Cluster B — Estándar (8 tiendas) ────────────────────────────────────────
insert into tiendas (id, nombre, nombre_corto, zona, tipo, cluster) values
  ('candelaria',   'Candelaria',        'Candelaria',   'Turistica', 'Estandar', 'B'),
  ('gigantes',     'Gigantes',          'Gigantes',     'Turistica', 'Estandar', 'B'),
  ('guargacho',    'Guargacho',         'Guargacho',    'Periferia', 'Estandar', 'B'),
  ('icod',         'Icod',              'Icod',         'Periferia', 'Estandar', 'B'),
  ('las_galletas', 'Las Galletas',      'Las Galletas', 'Periferia', 'Estandar', 'B'),
  ('realejos',     'Realejos',          'Realejos',     'Periferia', 'Estandar', 'B'),
  ('salud',        'Salud',             'Salud',        'Periferia', 'Estandar', 'B'),
  ('san_agustin',  'San Agustín',       'San Agustín',  'Periferia', 'Estandar', 'B');

-- ── Cluster C — Pequeña (3 tiendas) ─────────────────────────────────────────
insert into tiendas (id, nombre, nombre_corto, zona, tipo, cluster) values
  ('chicharro',    'Chicharro',         'Chicharro',    'Capital',   'Pequeña',  'C'),
  ('ofra',         'Ofra',              'Ofra',         'Periferia', 'Pequeña',  'C'),
  ('puerto_cruz',  'Puerto de la Cruz', 'P. de la Cruz','Turistica', 'Pequeña',  'C');

-- ── Sin cluster: inactivas y almacenes ──────────────────────────────────────
insert into tiendas (id, nombre, nombre_corto, zona, tipo, cluster, activo, es_almacen) values
  ('americas',       'Americas',               'Americas',      null, null,      null, false, false),
  ('dpto_compras',   'Departamento de compras', 'Dpto. Compras', null, 'Almacen', null, true,  true),
  ('tienda_oficina', 'Tienda Oficina',          'T. Oficina',    null, 'Almacen', null, true,  true);

-- ── Índices útiles ───────────────────────────────────────────────────────────
create index idx_tiendas_cluster on tiendas(cluster) where cluster is not null;
create index idx_tiendas_activo  on tiendas(activo);
