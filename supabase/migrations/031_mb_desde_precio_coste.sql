-- Migración 031: MB% usando precio_venta y cost_price_medio como fuente principal
--
-- pct_margen_bruto en product_variants viene a 0 desde el CSV de Metabase,
-- no como NULL. Usamos la cadena de fallback:
--   1. pct_margen_bruto > 0 (si Metabase lo exporta correctamente algún día)
--   2. (precio_venta - cost_price_medio) / precio_venta × 100  ← fuente real
--   3. null → muestra "—" en UI (honesto: sin datos)

-- ── tienda_tendencia ──────────────────────────────────────────────────────────
-- Requiere DROP porque cambia firma de retorno (añade mb_pct)

drop function if exists tienda_tendencia(text);

create function tienda_tendencia(p_tienda text)
returns table (
  anyo     int,
  mes      int,
  ingresos numeric,
  uds      bigint,
  coste    numeric,
  mb_pct   numeric
)
language sql stable as $$
  with mb_modelo as (
    select
      pr.codigo_modelo,
      coalesce(
        nullif(pv.pct_margen_bruto, 0),
        case
          when pv.precio_venta > 0 and pv.cost_price_medio > 0
          then round((pv.precio_venta - pv.cost_price_medio) / pv.precio_venta * 100, 1)
        end
      ) as mb_pct
    from products pr
    left join product_variants pv on pv.codigo_interno = pr.variante_lider
  )
  select
    v.anyo,
    v.mes,
    round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)         as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint                   as uds,
    null::numeric                                                    as coste,
    round(
      sum(v.ingresos_netos * m.mb_pct)
      / nullif(
          sum(v.ingresos_netos * case when m.mb_pct is not null then 1 else 0 end),
          0
        ),
      1
    )                                                                as mb_pct
  from ventas_mensuales v
  left join mb_modelo m on m.codigo_modelo = v.codigo_modelo
  where v.tienda = p_tienda
  group by v.anyo, v.mes
  order by v.anyo asc, v.mes asc
$$;

grant execute on function tienda_tendencia(text) to anon;

-- ── tiendas_kpis_listing ──────────────────────────────────────────────────────

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
  mb_modelo as (
    select
      pr.codigo_modelo,
      coalesce(
        nullif(pv.pct_margen_bruto, 0),
        case
          when pv.precio_venta > 0 and pv.cost_price_medio > 0
          then round((pv.precio_venta - pv.cost_price_medio) / pv.precio_venta * 100, 1)
        end
      ) as mb_pct
    from products pr
    left join product_variants pv on pv.codigo_interno = pr.variante_lider
  ),
  base as (
    select
      v.tienda,
      sum(v.ingresos_netos)                                            as ingresos,
      sum(v.unidades_vendidas)                                         as uds,
      count(distinct v.codigo_modelo)                                  as n_mod,
      sum(v.ingresos_netos * m.mb_pct)                                 as ingresos_x_mb,
      sum(v.ingresos_netos * case when m.mb_pct is not null then 1 else 0 end) as ingresos_con_mb
    from ventas_mensuales v, periodo p
    left join mb_modelo m on m.codigo_modelo = v.codigo_modelo
    where v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.tienda
  )
  select
    b.tienda                                                           as tienda_nombre,
    round(coalesce(b.ingresos, 0)::numeric, 2)                        as ingresos_12m,
    coalesce(b.uds, 0)::bigint                                         as uds_12m,
    0::numeric                                                         as coste_12m,
    round((b.ingresos_x_mb / nullif(b.ingresos_con_mb, 0))::numeric, 1) as mb_pct,
    b.n_mod                                                            as n_modelos
  from base b
$$;

grant execute on function tiendas_kpis_listing() to anon;

-- ── tienda_top_por_metal ──────────────────────────────────────────────────────
-- Misma lógica para MB% en las tablas de Top Oro / Top Plata

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
      round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)       as ingresos
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
    0::numeric                                                     as coste,
    coalesce(
      nullif(pv.pct_margen_bruto, 0),
      case
        when pv.precio_venta > 0 and pv.cost_price_medio > 0
        then round((pv.precio_venta - pv.cost_price_medio) / pv.precio_venta * 100, 1)
      end
    )                                                              as mb_pct
  from agg a
  join products pr on pr.codigo_modelo = a.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
  where pr.metal = p_metal
  order by a.uds desc
  limit p_limit
$$;

grant execute on function tienda_top_por_metal(text, text, int) to anon;
