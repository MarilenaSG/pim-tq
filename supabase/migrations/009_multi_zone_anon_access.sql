-- ══════════════════════════════════════════════════════════════════
-- 009 · Multi-zona: acceso anon + nuevas tablas
-- ══════════════════════════════════════════════════════════════════
-- La app no tiene auth de usuario (acceso libre por URL).
-- Los Server Components usan el cliente anon de Supabase.
-- Se reemplazan las policies "authenticated-only" de lectura
-- por policies que permiten también al rol "anon".
-- Las escrituras siguen restringidas a "service_role" (API routes).
-- ══════════════════════════════════════════════════════════════════

-- ── Fix RLS: ventas_mensuales ─────────────────────────────────
drop policy if exists "auth_read_ventas"         on ventas_mensuales;
drop policy if exists "service_write_ventas"     on ventas_mensuales;

create policy "anon_read_ventas"    on ventas_mensuales
  for select using (true);
create policy "service_write_ventas" on ventas_mensuales
  for all    using (auth.role() = 'service_role');

-- ── Fix RLS: reservas_activas ─────────────────────────────────
drop policy if exists "auth_read_reservas"       on reservas_activas;
drop policy if exists "service_write_reservas"   on reservas_activas;

create policy "anon_read_reservas"    on reservas_activas
  for select using (true);
create policy "service_write_reservas" on reservas_activas
  for all    using (auth.role() = 'service_role');

-- ── Fix RLS: devoluciones_mensuales (si existe) ───────────────
drop policy if exists "auth_read_devoluciones"   on devoluciones_mensuales;
drop policy if exists "service_write_devol"      on devoluciones_mensuales;

create policy "anon_read_devoluciones"    on devoluciones_mensuales
  for select using (true);
create policy "service_write_devoluciones" on devoluciones_mensuales
  for all    using (auth.role() = 'service_role');

-- ── Fix RLS: stock_historico (si existe) ─────────────────────
drop policy if exists "auth_read_stock_hist"     on stock_historico;
drop policy if exists "service_write_stock"      on stock_historico;

create policy "anon_read_stock_hist"    on stock_historico
  for select using (true);
create policy "service_write_stock"     on stock_historico
  for all    using (auth.role() = 'service_role');

-- ── Fix RLS: precios_historico (si existe) ───────────────────
drop policy if exists "auth_read_precios"        on precios_historico;
drop policy if exists "service_write_precios"    on precios_historico;

create policy "anon_read_precios"    on precios_historico
  for select using (true);
create policy "service_write_precios" on precios_historico
  for all   using (auth.role() = 'service_role');

-- ── Fix RLS: product_comments ─────────────────────────────────
-- La app ya no tiene auth de usuario; comentarios se guardan
-- con user_email libre (sin user_id). Se abre insert y delete
-- con service_role; anon puede leer y escribir.
drop policy if exists "auth_read_comments"       on product_comments;
drop policy if exists "auth_insert_comments"     on product_comments;
drop policy if exists "auth_update_own_comments" on product_comments;
drop policy if exists "auth_delete_own_comments" on product_comments;

create policy "anon_read_comments"    on product_comments
  for select using (true);
create policy "service_write_comments" on product_comments
  for all    using (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- NUEVAS TABLAS
-- ════════════════════════════════════════════════════════════════

-- ── boletin_overrides ─────────────────────────────────────────
-- Permite al equipo de tiendas o CM sobreescribir la categoría
-- automática del boletín (campaña > nuevo > outlet > retirar).
create table if not exists boletin_overrides (
  id            uuid primary key default gen_random_uuid(),
  codigo_modelo text not null references products(codigo_modelo) on delete cascade,
  categoria     text not null check (categoria in ('campaña','nuevo','outlet','retirar')),
  nota_interna  text,
  activo        boolean not null default true,
  expira_en     date,
  creado_por    text,                        -- email del creador
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_boletin_modelo  on boletin_overrides(codigo_modelo);
create index if not exists idx_boletin_activo  on boletin_overrides(activo, expira_en);

alter table boletin_overrides enable row level security;

create policy "anon_read_boletin"     on boletin_overrides
  for select using (true);
create policy "service_write_boletin" on boletin_overrides
  for all    using (auth.role() = 'service_role');

-- ── ventas_por_tienda ─────────────────────────────────────────
-- Ventas mensuales desagregadas por tienda.
-- Permite el sell-out por local (Zona Ventas).
create table if not exists ventas_por_tienda (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null,            -- codigo_interno = product_variants.slug
  codigo_modelo    text references products(codigo_modelo) on delete set null,
  tienda_id        text not null,
  tienda_nombre    text,
  anyo             integer not null,
  mes              integer not null check (mes between 1 and 12),
  unidades_vendidas integer,
  ingresos_netos   numeric(12,2),
  synced_at        timestamptz not null default now(),

  unique (slug, tienda_id, anyo, mes)
);

create index if not exists idx_vpt_modelo   on ventas_por_tienda(codigo_modelo, anyo, mes);
create index if not exists idx_vpt_tienda   on ventas_por_tienda(tienda_id, anyo, mes);
create index if not exists idx_vpt_periodo  on ventas_por_tienda(anyo, mes);

alter table ventas_por_tienda enable row level security;

create policy "anon_read_vpt"     on ventas_por_tienda
  for select using (true);
create policy "service_write_vpt" on ventas_por_tienda
  for all    using (auth.role() = 'service_role');

-- ── stock_por_tienda ──────────────────────────────────────────
-- Snapshot diario de stock por tienda.
-- Permite el análisis de distribución y rotación por local.
create table if not exists stock_por_tienda (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null,
  codigo_modelo    text references products(codigo_modelo) on delete set null,
  tienda_id        text not null,
  tienda_nombre    text,
  stock_variante   integer not null default 0,
  fecha_snapshot   date not null default current_date,
  synced_at        timestamptz not null default now(),

  unique (slug, tienda_id, fecha_snapshot)
);

create index if not exists idx_spt_modelo    on stock_por_tienda(codigo_modelo, fecha_snapshot);
create index if not exists idx_spt_tienda    on stock_por_tienda(tienda_id, fecha_snapshot);
create index if not exists idx_spt_snapshot  on stock_por_tienda(fecha_snapshot desc);

alter table stock_por_tienda enable row level security;

create policy "anon_read_spt"     on stock_por_tienda
  for select using (true);
create policy "service_write_spt" on stock_por_tienda
  for all    using (auth.role() = 'service_role');
