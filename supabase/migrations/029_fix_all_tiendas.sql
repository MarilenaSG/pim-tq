-- Migración 029: aplica columna isla + recrea todas las funciones RPC de tiendas
-- con MB% calculado desde pct_margen_bruto (variante líder) para robustez total.
-- Ejecutar en Supabase SQL Editor — reemplaza 025, 026, 027 y 028 de una vez.

-- ── 1. Columna isla (segura si ya existe) ─────────────────────────────────────

alter table tiendas
  add column if not exists isla text default 'Tenerife';

update tiendas set isla = 'Tenerife' where isla is null;

-- ── 2. tiendas_kpis_listing ───────────────────────────────────────────────────
-- MB% = media ponderada de pct_margen_bruto por ingresos.

create or replace function tiendas_kpis_listing()
returns table (
  tienda_nombre text,
  ingresos_12m  numeric,
  uds_12m       bigint,
  coste_12m     numeric,
  mb_pct        numeric,
  n_modelos     bigint
)
language sql stable as $$
  with periodo as (
    select
      extract(year  from now() - interval '12 months')::int as year_from,
      extract(month from now() - interval '12 months')::int as month_from
  ),
  base as (
    select
      v.tienda,
      v.codigo_modelo,
      sum(v.ingresos_netos)    as ingresos,
      sum(v.unidades_vendidas) as uds
    from ventas_mensuales v, periodo p
    where v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.tienda, v.codigo_modelo
  )
  select
    b.tienda                                                       as tienda_nombre,
    round(coalesce(sum(b.ingresos), 0)::numeric, 2)               as ingresos_12m,
    coalesce(sum(b.uds), 0)::bigint                               as uds_12m,
    0::numeric                                                     as coste_12m,
    round(
      sum(b.ingresos * coalesce(pv.pct_margen_bruto, 0) / 100)
      / nullif(sum(b.ingresos), 0) * 100,
      1
    )                                                              as mb_pct,
    count(distinct b.codigo_modelo)                               as n_modelos
  from base b
  join products pr on pr.codigo_modelo = b.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
  group by b.tienda
$$;

grant execute on function tiendas_kpis_listing() to anon;

-- ── 3. tienda_tendencia ───────────────────────────────────────────────────────
-- coste estimado = ingresos × (1 − pct_margen_bruto/100) por variante líder.
-- Así MB% en el KPI card nunca da 100% aunque coste_total sea 0 en ventas.

create or replace function tienda_tendencia(p_tienda text)
returns table (
  anyo     int,
  mes      int,
  ingresos numeric,
  uds      bigint,
  coste    numeric
)
language sql stable as $$
  select
    v.anyo,
    v.mes,
    round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)          as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint                   as uds,
    -- coste estimado: ingresos × (1 − MB%) usando pct_margen_bruto del líder
    round(coalesce(
      sum(v.ingresos_netos * (1 - coalesce(pv.pct_margen_bruto, 0) / 100)),
      0
    )::numeric, 2)                                                   as coste
  from ventas_mensuales v
  left join products pr on pr.codigo_modelo = v.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
  where v.tienda = p_tienda
  group by v.anyo, v.mes
  order by v.anyo asc, v.mes asc
$$;

grant execute on function tienda_tendencia(text) to anon;

-- ── 4. tienda_familias ────────────────────────────────────────────────────────

create or replace function tienda_familias(p_tienda text)
returns table (
  familia   text,
  ingresos  numeric,
  uds       bigint,
  coste     numeric,
  n_modelos bigint
)
language sql stable as $$
  with periodo as (
    select
      extract(year  from now() - interval '12 months')::int as year_from,
      extract(month from now() - interval '12 months')::int as month_from
  )
  select
    coalesce(pr.familia, 'Sin familia')                            as familia,
    round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)         as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint                  as uds,
    round(coalesce(
      sum(v.ingresos_netos * (1 - coalesce(pv.pct_margen_bruto, 0) / 100)),
      0
    )::numeric, 2)                                                  as coste,
    count(distinct v.codigo_modelo)                                as n_modelos
  from ventas_mensuales v
  join products pr on pr.codigo_modelo = v.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider,
  periodo p
  where v.tienda = p_tienda
    and v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
  group by pr.familia
  order by ingresos desc
$$;

grant execute on function tienda_familias(text) to anon;

-- ── 5. tienda_metales ─────────────────────────────────────────────────────────

create or replace function tienda_metales(p_tienda text)
returns table (
  metal    text,
  ingresos numeric,
  uds      bigint
)
language sql stable as $$
  with periodo as (
    select
      extract(year  from now() - interval '12 months')::int as year_from,
      extract(month from now() - interval '12 months')::int as month_from
  )
  select
    coalesce(pr.metal, 'Otro')                                     as metal,
    round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)          as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint                   as uds
  from ventas_mensuales v
  join products pr on pr.codigo_modelo = v.codigo_modelo,
  periodo p
  where v.tienda = p_tienda
    and v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
  group by pr.metal
  order by ingresos desc
$$;

grant execute on function tienda_metales(text) to anon;

-- ── 6. tienda_top_por_metal ───────────────────────────────────────────────────

create or replace function tienda_top_por_metal(
  p_tienda text,
  p_metal  text,
  p_limit  int default 10
)
returns table (
  codigo_modelo text,
  description   text,
  familia       text,
  karat         text,
  abc_ventas    text,
  uds           bigint,
  ingresos      numeric,
  coste         numeric,
  mb_pct        numeric
)
language sql stable as $$
  with periodo as (
    select
      extract(year  from now() - interval '12 months')::int as year_from,
      extract(month from now() - interval '12 months')::int as month_from
  ),
  agg as (
    select
      v.codigo_modelo,
      coalesce(sum(v.unidades_vendidas), 0)::bigint               as uds,
      round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)       as ingresos,
      0::numeric                                                   as coste
    from ventas_mensuales v, periodo p
    where v.tienda = p_tienda
      and v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.codigo_modelo
  )
  select
    a.codigo_modelo,
    pr.description,
    pr.familia,
    pr.karat,
    pr.abc_ventas,
    a.uds,
    a.ingresos,
    a.coste,
    pv.pct_margen_bruto                                            as mb_pct
  from agg a
  join products pr on pr.codigo_modelo = a.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
  where pr.metal = p_metal
  order by a.uds desc
  limit p_limit
$$;

grant execute on function tienda_top_por_metal(text, text, int) to anon;
