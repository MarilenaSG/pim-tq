-- ============================================================
-- PIM Te Quiero — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Extensiones ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tipos enum ───────────────────────────────────────────────
do $$ begin
  create type abc_rating as enum ('A', 'B', 'C');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sync_source_type as enum ('metabase', 'shopify');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sync_status_type as enum ('success', 'error', 'running');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sync_trigger_type as enum ('cron', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type image_source_type as enum ('s3', 'shopify', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type custom_field_type as enum ('text', 'textarea', 'date', 'boolean', 'select');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type redondeo_type as enum ('text', '99', '00');
exception when duplicate_object then null;
end $$;

-- ── products ─────────────────────────────────────────────────
create table if not exists products (
  codigo_modelo        text        primary key,
  description          text,
  category             text,
  familia              text,
  metal                text,
  karat                text,
  supplier_name        text,
  primera_entrada      date,
  num_variantes        integer,
  lista_variantes      text,
  variante_lider       text,

  -- Aggregated from product_variants (calculated on sync)
  ingresos_modelo_12m  numeric,
  abc_ventas           abc_rating,
  abc_unidades         abc_rating,

  -- Control
  metabase_synced_at   timestamptz,
  shopify_synced_at    timestamptz,
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);

-- ── product_variants ─────────────────────────────────────────
create table if not exists product_variants (
  codigo_interno       text        primary key,
  slug                 text        not null,
  codigo_modelo        text        not null references products(codigo_modelo) on delete cascade,
  variante             text,
  es_variante_lider    boolean     not null default false,

  -- Precios
  precio_venta         numeric,
  precio_tachado       numeric,
  descuento_aplicado   numeric,

  -- Costes
  cost_price_medio     numeric,
  ultimo_coste_compra  numeric,
  ultimo_precio_venta  numeric,

  -- Rentabilidad
  margen_bruto         numeric,
  pct_margen_bruto     numeric,

  -- Ventas
  abc_ventas           abc_rating,
  abc_unidades         abc_rating,
  ingresos_slug_12m             numeric,
  ingresos_variante_lider_12m   numeric,
  unidades_mes_anterior         integer,

  -- Stock
  stock_variante       integer,

  -- Distribución
  num_tiendas_activo   integer,

  -- Control
  metabase_synced_at   timestamptz,
  updated_at           timestamptz  not null default now()
);

create index if not exists product_variants_codigo_modelo_idx
  on product_variants(codigo_modelo);

-- ── product_shopify_data ─────────────────────────────────────
create table if not exists product_shopify_data (
  id                   uuid        primary key default uuid_generate_v4(),
  codigo_modelo        text        not null unique references products(codigo_modelo) on delete cascade,
  shopify_product_id   text,
  shopify_title        text,
  shopify_description  text,        -- HTML
  shopify_tags         text[],
  shopify_seo_title    text,
  shopify_seo_desc     text,
  shopify_status       text,
  shopify_handle       text,
  shopify_vendor       text,
  synced_at            timestamptz
);

-- ── product_images ───────────────────────────────────────────
create table if not exists product_images (
  id             uuid              primary key default uuid_generate_v4(),
  codigo_modelo  text              not null references products(codigo_modelo) on delete cascade,
  url            text              not null,
  source         image_source_type not null default 'manual',
  variante       text,
  alt_text       text,
  orden          integer           not null default 0,
  is_primary     boolean           not null default false,
  created_at     timestamptz       not null default now()
);

create index if not exists product_images_codigo_modelo_idx
  on product_images(codigo_modelo);

-- ── product_custom_fields ────────────────────────────────────
create table if not exists product_custom_fields (
  id             uuid              primary key default uuid_generate_v4(),
  codigo_modelo  text              not null references products(codigo_modelo) on delete cascade,
  field_key      text              not null,
  field_value    text,
  field_type     custom_field_type not null default 'text',
  updated_by     text,
  updated_at     timestamptz       not null default now(),
  unique(codigo_modelo, field_key)
);

create index if not exists product_custom_fields_codigo_modelo_idx
  on product_custom_fields(codigo_modelo);

-- ── custom_field_definitions ─────────────────────────────────
create table if not exists custom_field_definitions (
  id          uuid              primary key default uuid_generate_v4(),
  field_key   text              not null unique,
  label       text              not null,
  field_type  custom_field_type not null default 'text',
  options     text[],
  is_active   boolean           not null default true,
  created_at  timestamptz       not null default now()
);

-- ── sync_log ─────────────────────────────────────────────────
create table if not exists sync_log (
  id               uuid              primary key default uuid_generate_v4(),
  source           sync_source_type  not null,
  status           sync_status_type  not null,
  records_updated  integer,
  error_message    text,
  triggered_by     sync_trigger_type not null,
  started_at       timestamptz       not null default now(),
  finished_at      timestamptz
);

create index if not exists sync_log_started_at_idx
  on sync_log(started_at desc);

-- ── pricing_rules ────────────────────────────────────────────
create table if not exists pricing_rules (
  id                   uuid         primary key default uuid_generate_v4(),
  familia              text,
  metal                text,
  karat                text,
  margen_objetivo_pct  numeric,
  redondeo             redondeo_type,
  descuento_minimo_pct numeric,
  updated_by           text,
  updated_at           timestamptz  not null default now()
);

-- ── updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger set_updated_at before update on products
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger set_updated_at before update on product_variants
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger set_updated_at before update on product_custom_fields
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger set_updated_at before update on pricing_rules
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

-- ── RLS ──────────────────────────────────────────────────────
-- Anon puede leer todo. Las escrituras solo desde service role (API routes).
-- El service role bypasses RLS por defecto en Supabase.

alter table products               enable row level security;
alter table product_variants       enable row level security;
alter table product_shopify_data   enable row level security;
alter table product_images         enable row level security;
alter table product_custom_fields  enable row level security;
alter table custom_field_definitions enable row level security;
alter table sync_log               enable row level security;
alter table pricing_rules          enable row level security;

-- Lectura pública para la anon key (la app no tiene auth de usuario)
create policy "anon_read_products"
  on products for select to anon using (true);

create policy "anon_read_variants"
  on product_variants for select to anon using (true);

create policy "anon_read_shopify"
  on product_shopify_data for select to anon using (true);

create policy "anon_read_images"
  on product_images for select to anon using (true);

create policy "anon_read_custom_fields"
  on product_custom_fields for select to anon using (true);

create policy "anon_read_field_defs"
  on custom_field_definitions for select to anon using (true);

create policy "anon_read_sync_log"
  on sync_log for select to anon using (true);

create policy "anon_read_pricing_rules"
  on pricing_rules for select to anon using (true);

-- ── Fin ──────────────────────────────────────────────────────
-- Verificar: SELECT table_name FROM information_schema.tables
--            WHERE table_schema = 'public' ORDER BY table_name;
