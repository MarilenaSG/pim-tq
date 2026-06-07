-- Migración 026: funciones RPC de analytics de tiendas
-- KPIs agregados por tienda a partir de ventas_mensuales (últimos 12 meses)
-- y JOIN con products para datos de producto.

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Devuelve year_from y month_from para "hace 12 meses" desde NOW()
-- Evita duplicar la lógica en cada función

-- ── tiendas_kpis_listing ──────────────────────────────────────────────────────
-- KPIs de todas las tiendas para el listado. Últimos 12 meses.
-- Devuelve: tienda_nombre, ingresos_12m, uds_12m, coste_12m, mb_pct, n_modelos

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
  )
  select
    v.tienda                            as tienda_nombre,
    coalesce(sum(v.ingresos_netos), 0)  as ingresos_12m,
    coalesce(sum(v.unidades_vendidas), 0)::bigint as uds_12m,
    coalesce(sum(v.coste_total), 0)     as coste_12m,
    case
      when sum(v.ingresos_netos) > 0
      then round(
        (sum(v.ingresos_netos) - sum(v.coste_total))
        / sum(v.ingresos_netos) * 100,
        1
      )
      else null
    end                                 as mb_pct,
    count(distinct v.codigo_modelo)     as n_modelos
  from ventas_mensuales v, periodo p
  where v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
  group by v.tienda
$$;

grant execute on function tiendas_kpis_listing() to anon;

-- ── tienda_tendencia ──────────────────────────────────────────────────────────
-- Tendencia mensual de ventas para una tienda concreta.
-- Devuelve: anyo, mes, ingresos, uds, coste. Orden ASC.

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
    coalesce(sum(v.ingresos_netos), 0)   as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint as uds,
    coalesce(sum(v.coste_total), 0)      as coste
  from ventas_mensuales v
  where v.tienda = p_tienda
  group by v.anyo, v.mes
  order by v.anyo asc, v.mes asc
$$;

grant execute on function tienda_tendencia(text) to anon;

-- ── tienda_familias ───────────────────────────────────────────────────────────
-- Desglose por familia para una tienda. Últimos 12 meses.
-- Devuelve: familia, ingresos, uds, coste, n_modelos. Orden DESC por ingresos.

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
    coalesce(p.familia, 'Sin familia')   as familia,
    coalesce(sum(v.ingresos_netos), 0)   as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint as uds,
    coalesce(sum(v.coste_total), 0)      as coste,
    count(distinct v.codigo_modelo)      as n_modelos
  from ventas_mensuales v
  join products p on p.codigo_modelo = v.codigo_modelo,
  periodo pr
  where v.tienda = p_tienda
    and v.anyo * 12 + v.mes >= pr.year_from * 12 + pr.month_from
  group by p.familia
  order by ingresos desc
$$;

grant execute on function tienda_familias(text) to anon;

-- ── tienda_metales ────────────────────────────────────────────────────────────
-- Desglose por metal para una tienda. Últimos 12 meses.
-- Devuelve: metal, ingresos, uds. Orden DESC por ingresos.

create or replace function tienda_metales(p_tienda text)
returns table (
  metal    text,
  ingresos numeric,
  uds      bigint
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
    coalesce(p.metal, 'Otro')            as metal,
    coalesce(sum(v.ingresos_netos), 0)   as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint as uds
  from ventas_mensuales v
  join products p on p.codigo_modelo = v.codigo_modelo,
  periodo pr
  where v.tienda = p_tienda
    and v.anyo * 12 + v.mes >= pr.year_from * 12 + pr.month_from
  group by p.metal
  order by ingresos desc
$$;

grant execute on function tienda_metales(text) to anon;

-- ── tienda_top_productos ──────────────────────────────────────────────────────
-- Top productos por ingresos para una tienda. Últimos 12 meses.
-- Devuelve: codigo_modelo, description, familia, metal, abc_ventas,
--           ingresos, uds, coste, mb_pct. Orden DESC por ingresos.

create or replace function tienda_top_productos(p_tienda text, p_limit int default 15)
returns table (
  codigo_modelo text,
  description   text,
  familia       text,
  metal         text,
  abc_ventas    text,
  ingresos      numeric,
  uds           bigint,
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
      coalesce(sum(v.ingresos_netos), 0)    as ingresos,
      coalesce(sum(v.unidades_vendidas), 0)::bigint as uds,
      coalesce(sum(v.coste_total), 0)       as coste
    from ventas_mensuales v, periodo p
    where v.tienda = p_tienda
      and v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.codigo_modelo
    order by ingresos desc
    limit p_limit
  )
  select
    a.codigo_modelo,
    p.description,
    p.familia,
    p.metal,
    p.abc_ventas,
    a.ingresos,
    a.uds,
    a.coste,
    case
      when a.ingresos > 0
      then round((a.ingresos - a.coste) / a.ingresos * 100, 1)
      else null
    end as mb_pct
  from agg a
  join products p on p.codigo_modelo = a.codigo_modelo
  order by a.ingresos desc
$$;

grant execute on function tienda_top_productos(text, int) to anon;
