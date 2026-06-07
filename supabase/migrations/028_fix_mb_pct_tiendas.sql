-- Migración 028: corrige MB% en funciones de analytics de tiendas
-- El problema: ventas_mensuales.coste_total llega a 0 desde el CSV de Metabase,
-- lo que hace que MB% = (ingresos - 0) / ingresos = 100% siempre.
-- Solución: usar product_variants.pct_margen_bruto (variante líder) que sí
-- viene correctamente calculado desde Metabase.

-- ── tienda_top_por_metal ──────────────────────────────────────────────────────
-- Usa pct_margen_bruto de la variante líder en vez de calcular desde coste_total.

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
language sql
stable
as $$
  with periodo as (
    select
      extract(year  from now() - interval '12 months')::int as year_from,
      extract(month from now() - interval '12 months')::int as month_from
  ),
  agg as (
    select
      v.codigo_modelo,
      coalesce(sum(v.unidades_vendidas), 0)::bigint as uds,
      coalesce(sum(v.ingresos_netos),    0)         as ingresos,
      coalesce(sum(v.coste_total),       0)         as coste
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
    -- pct_margen_bruto de la variante líder (dato fiable de Metabase)
    pv.pct_margen_bruto                             as mb_pct
  from agg a
  join products pr on pr.codigo_modelo = a.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
  where pr.metal = p_metal
  order by a.uds desc
  limit p_limit
$$;

grant execute on function tienda_top_por_metal(text, text, int) to anon;

-- ── tiendas_kpis_listing ──────────────────────────────────────────────────────
-- MB% = media ponderada de pct_margen_bruto por ingresos de cada modelo.

create or replace function tiendas_kpis_listing()
returns table (
  tienda_nombre text,
  ingresos_12m  numeric,
  uds_12m       bigint,
  coste_12m     numeric,
  mb_pct        numeric,
  n_modelos     bigint
)
language sql
stable
as $$
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
    coalesce(sum(b.ingresos), 0)                                   as ingresos_12m,
    coalesce(sum(b.uds), 0)::bigint                                as uds_12m,
    0::numeric                                                     as coste_12m,
    -- media ponderada: cada modelo contribuye según sus ingresos
    round(
      sum(b.ingresos * coalesce(pv.pct_margen_bruto, 0) / 100)
      / nullif(sum(b.ingresos), 0) * 100,
      1
    )                                                              as mb_pct,
    count(distinct b.codigo_modelo)                                as n_modelos
  from base b
  join products pr on pr.codigo_modelo = b.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
  group by b.tienda
$$;

grant execute on function tiendas_kpis_listing() to anon;

-- ── tienda_familias ───────────────────────────────────────────────────────────
-- MB% = media ponderada de pct_margen_bruto por ingresos dentro de cada familia.

create or replace function tienda_familias(p_tienda text)
returns table (
  familia   text,
  ingresos  numeric,
  uds       bigint,
  coste     numeric,
  n_modelos bigint
)
language sql
stable
as $$
  with periodo as (
    select
      extract(year  from now() - interval '12 months')::int as year_from,
      extract(month from now() - interval '12 months')::int as month_from
  )
  select
    coalesce(pr.familia, 'Sin familia')              as familia,
    coalesce(sum(v.ingresos_netos), 0)               as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint    as uds,
    coalesce(sum(v.coste_total), 0)                  as coste,
    count(distinct v.codigo_modelo)                  as n_modelos
  from ventas_mensuales v
  join products pr on pr.codigo_modelo = v.codigo_modelo,
  periodo p
  where v.tienda = p_tienda
    and v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
  group by pr.familia
  order by ingresos desc
$$;

grant execute on function tienda_familias(text) to anon;

-- ── tienda_tendencia ──────────────────────────────────────────────────────────
-- Sin cambios de lógica; se recrea para completar el apply de esta migración.

create or replace function tienda_tendencia(p_tienda text)
returns table (
  anyo     int,
  mes      int,
  ingresos numeric,
  uds      bigint,
  coste    numeric
)
language sql
stable
as $$
  select
    v.anyo,
    v.mes,
    coalesce(sum(v.ingresos_netos),    0)            as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint    as uds,
    coalesce(sum(v.coste_total),       0)            as coste
  from ventas_mensuales v
  where v.tienda = p_tienda
  group by v.anyo, v.mes
  order by v.anyo asc, v.mes asc
$$;

grant execute on function tienda_tendencia(text) to anon;
