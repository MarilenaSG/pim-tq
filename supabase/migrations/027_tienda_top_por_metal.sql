-- Migración 027: función RPC top productos por metal y tienda
-- Ordenado por unidades vendidas (no por ingresos), para análisis
-- de rotación de Oro y Plata por tienda.

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
    case
      when a.ingresos > 0
      then round((a.ingresos - a.coste) / a.ingresos * 100, 1)
      else null
    end as mb_pct
  from agg a
  join products pr on pr.codigo_modelo = a.codigo_modelo
  where pr.metal = p_metal
  order by a.uds desc
  limit p_limit
$$;

grant execute on function tienda_top_por_metal(text, text, int) to anon;
