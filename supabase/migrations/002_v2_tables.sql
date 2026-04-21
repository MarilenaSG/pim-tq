-- ============================================================
-- PIM Te Quiero — Migrations v2.0 (todas las tablas nuevas)
-- Ejecutar en Supabase → SQL Editor después de las migrations v1
-- Pre-requisito: auth activado (sección 1)
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ── RLS en tablas existentes ─────────────────────────────────
-- Actualizar policies para requerir autenticación en lectura de cliente
-- (el service_role sigue teniendo acceso completo desde API routes)

alter table products                enable row level security;
alter table product_variants        enable row level security;
alter table product_images          enable row level security;
alter table product_shopify_data    enable row level security;
alter table product_custom_fields   enable row level security;
alter table custom_field_definitions enable row level security;
alter table sync_log                enable row level security;
alter table pricing_rules           enable row level security;

-- Eliminar policies permisivas anteriores si existen
drop policy if exists "service_role_all_products"              on products;
drop policy if exists "service_role_all_variants"             on product_variants;
drop policy if exists "service_role_all_images"               on product_images;
drop policy if exists "service_role_all_shopify"              on product_shopify_data;
drop policy if exists "service_role_all_custom_fields"        on product_custom_fields;
drop policy if exists "service_role_all_field_defs"           on custom_field_definitions;
drop policy if exists "service_role_all_sync_log"             on sync_log;
drop policy if exists "service_role_all_pricing"              on pricing_rules;
drop policy if exists "allow_all_products"                    on products;
drop policy if exists "allow_all_variants"                    on product_variants;
drop policy if exists "allow_all_images"                      on product_images;
drop policy if exists "allow_all_shopify"                     on product_shopify_data;
drop policy if exists "allow_all_custom_fields"               on product_custom_fields;
drop policy if exists "allow_all_field_defs"                  on custom_field_definitions;
drop policy if exists "allow_all_sync_log"                    on sync_log;
drop policy if exists "allow_all_pricing"                     on pricing_rules;

-- products
create policy "authenticated_read_products" on products
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "service_write_products" on products
  for all using (auth.role() = 'service_role');

-- product_variants
create policy "authenticated_read_variants" on product_variants
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "service_write_variants" on product_variants
  for all using (auth.role() = 'service_role');

-- product_images
create policy "authenticated_read_images" on product_images
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "service_write_images" on product_images
  for all using (auth.role() = 'service_role');

-- product_shopify_data
create policy "authenticated_read_shopify" on product_shopify_data
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "service_write_shopify" on product_shopify_data
  for all using (auth.role() = 'service_role');

-- product_custom_fields
create policy "authenticated_read_custom_fields" on product_custom_fields
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "authenticated_write_custom_fields" on product_custom_fields
  for all using (auth.role() in ('authenticated', 'service_role'));

-- custom_field_definitions
create policy "authenticated_read_field_defs" on custom_field_definitions
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "service_write_field_defs" on custom_field_definitions
  for all using (auth.role() = 'service_role');

-- sync_log
create policy "authenticated_read_sync_log" on sync_log
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "service_write_sync_log" on sync_log
  for all using (auth.role() = 'service_role');

-- pricing_rules
create policy "authenticated_read_pricing" on pricing_rules
  for select using (auth.role() in ('authenticated', 'service_role', 'anon'));
create policy "authenticated_write_pricing" on pricing_rules
  for all using (auth.role() in ('authenticated', 'service_role'));

-- ── Configuración de alertas (sección 4) ─────────────────────
create table if not exists alert_settings (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  value       text not null,
  updated_at  timestamptz not null default now()
);

insert into alert_settings (key, value) values
  ('umbral_stock_abc_a',    '5'),
  ('umbral_stock_abc_b',    '2'),
  ('dias_new_sin_venta',    '180'),
  ('alertar_abc_b_stock',   'false'),
  ('ladder_rangos',         '0-50,51-100,101-200,201-350,351-500,501-750,751-1000,1000+')
on conflict (key) do nothing;

-- ── Campañas (sección 9) ─────────────────────────────────────
create table if not exists campaigns (
  id              uuid primary key default uuid_generate_v4(),
  nombre          text not null,
  slug            text unique not null,
  tipo            text check (tipo in ('GTM', 'Propia', 'Estacional', 'Liquidacion')),
  descripcion     text,
  fecha_inicio    date,
  fecha_fin       date,
  estado          text not null default 'borrador'
                  check (estado in ('borrador', 'activa', 'finalizada')),
  color           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists campaign_products (
  id              uuid primary key default uuid_generate_v4(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  codigo_modelo   text not null references products(codigo_modelo) on delete cascade,
  notas           text,
  orden           integer,
  added_at        timestamptz not null default now(),
  added_by        text,
  unique(campaign_id, codigo_modelo)
);

create index if not exists idx_campaign_products_campaign
  on campaign_products(campaign_id);
create index if not exists idx_campaign_products_producto
  on campaign_products(codigo_modelo);

-- ── Anotaciones colaborativas (sección 10) ───────────────────
create table if not exists product_comments (
  id              uuid primary key default uuid_generate_v4(),
  codigo_modelo   text not null references products(codigo_modelo) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_email      text not null,
  user_name       text,
  contenido       text not null,
  tipo            text not null default 'nota'
                  check (tipo in ('nota','precio','surtido','campana','proveedor','alerta')),
  campaign_id     uuid references campaigns(id) on delete set null,
  editado         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_comments_producto on product_comments(codigo_modelo);
create index if not exists idx_comments_user     on product_comments(user_id);
create index if not exists idx_comments_created  on product_comments(created_at desc);

-- ── Histórico de datos (sección 13) ──────────────────────────
create table if not exists ventas_mensuales (
  id                  uuid primary key default uuid_generate_v4(),
  codigo_interno      text not null references product_variants(codigo_interno) on delete cascade,
  codigo_modelo       text not null references products(codigo_modelo) on delete cascade,
  anyo                smallint not null,
  mes                 smallint not null check (mes between 1 and 12),
  unidades_vendidas   integer not null default 0,
  ingresos_netos      numeric,
  coste_total         numeric,
  synced_at           timestamptz not null default now(),
  unique(codigo_interno, anyo, mes)
);
create index if not exists idx_ventas_modelo  on ventas_mensuales(codigo_modelo, anyo, mes);
create index if not exists idx_ventas_periodo on ventas_mensuales(anyo, mes);

create table if not exists devoluciones_mensuales (
  id                  uuid primary key default uuid_generate_v4(),
  codigo_interno      text not null references product_variants(codigo_interno) on delete cascade,
  codigo_modelo       text not null references products(codigo_modelo) on delete cascade,
  anyo                smallint not null,
  mes                 smallint not null check (mes between 1 and 12),
  unidades_devueltas  integer not null default 0,
  importe_devuelto    numeric,
  synced_at           timestamptz not null default now(),
  unique(codigo_interno, anyo, mes)
);
create index if not exists idx_devoluciones_modelo on devoluciones_mensuales(codigo_modelo, anyo, mes);

create table if not exists reservas_activas (
  codigo_interno      text primary key references product_variants(codigo_interno) on delete cascade,
  unidades_reservadas integer not null default 0,
  reservas_count      integer,
  fecha_snapshot      date not null,
  synced_at           timestamptz not null default now()
);

create table if not exists stock_historico (
  id                    uuid primary key default uuid_generate_v4(),
  codigo_interno        text not null references product_variants(codigo_interno) on delete cascade,
  fecha_snapshot        date not null,
  stock_total           integer not null,
  num_tiendas_con_stock integer,
  synced_at             timestamptz not null default now(),
  unique(codigo_interno, fecha_snapshot)
);
create index if not exists idx_stock_hist on stock_historico(codigo_interno, fecha_snapshot desc);

create table if not exists precios_historico (
  id                    uuid primary key default uuid_generate_v4(),
  codigo_interno        text not null references product_variants(codigo_interno) on delete cascade,
  fecha_cambio          date not null,
  precio_venta_nuevo    numeric,
  precio_venta_anterior numeric,
  precio_tachado_nuevo  numeric,
  precio_tachado_ant    numeric,
  cost_price_snapshot   numeric,
  created_at            timestamptz not null default now(),
  unique(codigo_interno, fecha_cambio)
);
create index if not exists idx_precios_hist on precios_historico(codigo_interno, fecha_cambio desc);

-- ── RLS para tablas nuevas ────────────────────────────────────
alter table alert_settings         enable row level security;
alter table campaigns              enable row level security;
alter table campaign_products      enable row level security;
alter table product_comments       enable row level security;
alter table ventas_mensuales       enable row level security;
alter table devoluciones_mensuales enable row level security;
alter table reservas_activas       enable row level security;
alter table stock_historico        enable row level security;
alter table precios_historico      enable row level security;

create policy "auth_read_alert_settings" on alert_settings
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "service_write_alert_settings" on alert_settings
  for all using (auth.role() = 'service_role');

create policy "auth_read_campaigns" on campaigns
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "auth_write_campaigns" on campaigns
  for all using (auth.role() in ('authenticated', 'service_role'));

create policy "auth_read_campaign_products" on campaign_products
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "auth_write_campaign_products" on campaign_products
  for all using (auth.role() in ('authenticated', 'service_role'));

-- Comments: read for all authenticated, write only own rows
create policy "auth_read_comments" on product_comments
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "auth_insert_comments" on product_comments
  for insert with check (auth.uid() = user_id AND auth.role() = 'authenticated');
create policy "auth_update_own_comments" on product_comments
  for update using (auth.uid() = user_id);
create policy "auth_delete_own_comments" on product_comments
  for delete using (auth.uid() = user_id);

create policy "auth_read_ventas" on ventas_mensuales
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "service_write_ventas" on ventas_mensuales
  for all using (auth.role() = 'service_role');

create policy "auth_read_devoluciones" on devoluciones_mensuales
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "service_write_devol" on devoluciones_mensuales
  for all using (auth.role() = 'service_role');

create policy "auth_read_reservas" on reservas_activas
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "service_write_reservas" on reservas_activas
  for all using (auth.role() = 'service_role');

create policy "auth_read_stock_hist" on stock_historico
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "service_write_stock" on stock_historico
  for all using (auth.role() = 'service_role');

create policy "auth_read_precios" on precios_historico
  for select using (auth.role() in ('authenticated', 'service_role'));
create policy "service_write_precios" on precios_historico
  for all using (auth.role() = 'service_role');

-- ── Campos custom para contenido IA (sección 5) ──────────────
insert into custom_field_definitions (field_key, label, field_type, is_active) values
  ('shopify_title_ia',       'Título Shopify (IA)',       'text',     true),
  ('shopify_description_ia', 'Descripción Shopify (IA)', 'textarea', true),
  ('seo_title_ia',           'Título SEO (IA)',           'text',     true),
  ('seo_desc_ia',            'Descripción SEO (IA)',      'textarea', true),
  ('tags_ia',                'Tags Shopify (IA)',         'text',     true)
on conflict (field_key) do nothing;
