-- Migración 030: MB% robusto en tienda_tendencia y tiendas_kpis_listing
--
-- Lógica de prioridad para coste:
--   1. Si coste_total > 0 en ventas_mensuales → usa el real
--   2. Si pct_margen_bruto en product_variants > 0 → estima coste
--   3. Si ninguno → devuelve coste NULL (frontend mostrará "—")
--
-- Esto evita tanto el 100% (coste_total=0 con COALESCE a 0)
-- como el 0% (pct_margen_bruto NULL con COALESCE a 0).

-- ── tienda_tendencia ──────────────────────────────────────────────────────────
-- Añade mb_pct calculado en servidor para que el frontend solo lo muestre.

create or replace function tienda_tendencia(p_tienda text)
returns table (
  anyo     int,
  mes      int,
  ingresos numeric,
  uds      bigint,
  coste    numeric,
  mb_pct   numeric     -- calculado aquí; NULL si no hay datos de coste
)
language sql stable as $$
  select
    v.anyo,
    v.mes,
    round(coalesce(sum(v.ingresos_netos), 0)::numeric, 2)        as ingresos,
    coalesce(sum(v.unidades_vendidas), 0)::bigint                 as uds,
    -- coste: real si existe, estimado desde MB% si no, NULL si ninguno
    case
      when sum(v.coste_total) > 0
        then round(sum(v.coste_total)::numeric, 2)
      when sum(pv.pct_margen_bruto) is not null
        then round(
          sum(v.ingresos_netos * (1 - coalesce(pv.pct_margen_bruto, 0) / 100))::numeric,
          2
        )
      else null
    end                                                            as coste,
    -- mb_pct directo, calculado aquí
    case
      when sum(v.ingresos_netos) > 0 and sum(v.coste_total) > 0
        then round(
          (sum(v.ingresos_netos) - sum(v.coste_total))
          / sum(v.ingresos_netos) * 100,
          1
        )
      when sum(v.ingresos_netos) > 0 and sum(pv.pct_margen_bruto) is not null
        then round(
          sum(v.ingresos_netos * coalesce(pv.pct_margen_bruto, 0))
          / sum(v.ingresos_netos),
          1
        )
      else null
    end                                                            as mb_pct
  from ventas_mensuales v
  left join products pr on pr.codigo_modelo = v.codigo_modelo
  left join product_variants pv on pv.codigo_interno = pr.variante_lider
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
  base as (
    select
      v.tienda,
      sum(v.ingresos_netos) as ingresos,
      sum(v.unidades_vendidas) as uds,
      sum(v.coste_total) as coste_real,
      count(distinct v.codigo_modelo) as n_mod,
      -- suma ponderada de pct_margen_bruto × ingresos para fallback
      sum(v.ingresos_netos * coalesce(pv.pct_margen_bruto, 0) / 100) as coste_estimado_mb
    from ventas_mensuales v, periodo p
    left join products pr on pr.codigo_modelo = v.codigo_modelo
    left join product_variants pv on pv.codigo_interno = pr.variante_lider
    where v.anyo * 12 + v.mes >= p.year_from * 12 + p.month_from
    group by v.tienda
  )
  select
    b.tienda                                                      as tienda_nombre,
    round(coalesce(b.ingresos, 0)::numeric, 2)                   as ingresos_12m,
    coalesce(b.uds, 0)::bigint                                    as uds_12m,
    case
      when b.coste_real > 0 then round(b.coste_real::numeric, 2)
      else round((b.ingresos - b.coste_estimado_mb)::numeric, 2)
    end                                                           as coste_12m,
    case
      when b.ingresos > 0 and b.coste_real > 0
        then round((b.ingresos - b.coste_real) / b.ingresos * 100, 1)
      when b.ingresos > 0 and b.coste_estimado_mb > 0
        then round(b.coste_estimado_mb / b.ingresos * 100, 1)
      else null
    end                                                           as mb_pct,
    b.n_mod                                                       as n_modelos
  from base b
$$;

grant execute on function tiendas_kpis_listing() to anon;
