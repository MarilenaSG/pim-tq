-- Migración 033: MB% en listado desde coste_total de ventas_mensuales
--
-- El CTE mb_modelo (via product_variants.variante_lider) devuelve NULL
-- porque products.variante_lider no coincide con ningún codigo_interno.
-- Solución: calcular MB% directo desde ventas_mensuales.coste_total,
-- que es la misma fuente que usa tienda_tendencia (por eso la ficha funciona).

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
      sum(v.ingresos_netos)       as ingresos,
      sum(v.unidades_vendidas)    as uds,
      sum(v.coste_total)          as coste,
      count(distinct v.codigo_modelo) as n_mod
    from ventas_mensuales v
    cross join periodo p
    where v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.tienda
  )
  select
    b.tienda                                                              as tienda_nombre,
    round(coalesce(b.ingresos, 0)::numeric, 2)                           as ingresos_12m,
    coalesce(b.uds, 0)::bigint                                            as uds_12m,
    round(coalesce(b.coste, 0)::numeric, 2)                              as coste_12m,
    case
      when b.ingresos > 0 and b.coste > 0
      then round((b.ingresos - b.coste) / b.ingresos * 100, 1)
    end                                                                   as mb_pct,
    b.n_mod                                                               as n_modelos
  from base b
$$;

grant execute on function tiendas_kpis_listing() to anon;
