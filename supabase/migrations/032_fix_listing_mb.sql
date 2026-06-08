-- Migración 032: corrige precedencia SQL en tiendas_kpis_listing()
--
-- Bug: "FROM ventas_mensuales v, periodo p LEFT JOIN mb_modelo m ON ..."
-- El LEFT JOIN se asociaba con `periodo p` (no con `v`) por precedencia SQL
-- de los JOIN explícitos sobre las comas. Resultado: mb_pct siempre NULL.
--
-- Fix: usar CROSS JOIN explícito para periodo → LEFT JOIN se asocia con v.

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
      sum(v.ingresos_netos)                                                             as ingresos,
      sum(v.unidades_vendidas)                                                          as uds,
      count(distinct v.codigo_modelo)                                                   as n_mod,
      sum(v.ingresos_netos * m.mb_pct)                                                  as ingresos_x_mb,
      sum(v.ingresos_netos * case when m.mb_pct is not null then 1 else 0 end)          as ingresos_con_mb
    from ventas_mensuales v
    cross join periodo p
    left join mb_modelo m on m.codigo_modelo = v.codigo_modelo
    where v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.tienda
  )
  select
    b.tienda                                                             as tienda_nombre,
    round(coalesce(b.ingresos, 0)::numeric, 2)                          as ingresos_12m,
    coalesce(b.uds, 0)::bigint                                           as uds_12m,
    0::numeric                                                           as coste_12m,
    round((b.ingresos_x_mb / nullif(b.ingresos_con_mb, 0))::numeric, 1) as mb_pct,
    b.n_mod                                                              as n_modelos
  from base b
$$;

grant execute on function tiendas_kpis_listing() to anon;
