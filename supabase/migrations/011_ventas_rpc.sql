-- Migración 011: funciones RPC para agregaciones de ventas
-- Necesarias porque ventas_mensuales tiene granularidad por tienda
-- y fetchear todas las filas al cliente es inviable (>200K filas)

-- ── 1. Evolución mensual agregada (todos los meses de un rango) ──────────
CREATE OR REPLACE FUNCTION ventas_evolucion(
  p_anyo_desde integer,
  p_mes_desde  integer,
  p_anyo_hasta integer,
  p_mes_hasta  integer
)
RETURNS TABLE(
  anyo             smallint,
  mes              smallint,
  ingresos_netos   numeric,
  unidades_vendidas bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    anyo,
    mes,
    COALESCE(SUM(ingresos_netos), 0)   AS ingresos_netos,
    COALESCE(SUM(unidades_vendidas), 0) AS unidades_vendidas
  FROM ventas_mensuales
  WHERE (anyo * 100 + mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (anyo * 100 + mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY anyo, mes
  ORDER BY anyo, mes;
$$;

-- ── 2. KPI totales (YTD, año anterior, último mes, mes previo) ──────────
CREATE OR REPLACE FUNCTION ventas_kpis(
  p_cur_anyo  integer,
  p_cur_mes   integer,
  p_prev_anyo integer
)
RETURNS TABLE(
  ytd_ingresos      numeric,
  ytd_unidades      bigint,
  ytd_meses         bigint,
  prev_ingresos     numeric,
  prev_unidades     bigint,
  last_anyo         smallint,
  last_mes          smallint,
  last_ingresos     numeric,
  last_unidades     bigint,
  lm_prev_ingresos  numeric,
  lm_prev_unidades  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH
  ytd AS (
    SELECT
      SUM(ingresos_netos)    AS ingresos,
      SUM(unidades_vendidas) AS unidades,
      COUNT(DISTINCT mes)    AS meses
    FROM ventas_mensuales
    WHERE anyo = p_cur_anyo
  ),
  prev AS (
    SELECT
      SUM(ingresos_netos)    AS ingresos,
      SUM(unidades_vendidas) AS unidades
    FROM ventas_mensuales
    WHERE anyo = p_prev_anyo
  ),
  last_period AS (
    SELECT anyo, mes
    FROM ventas_mensuales
    ORDER BY anyo DESC, mes DESC
    LIMIT 1
  ),
  last_month AS (
    SELECT
      SUM(ingresos_netos)    AS ingresos,
      SUM(unidades_vendidas) AS unidades
    FROM ventas_mensuales
    WHERE anyo = (SELECT anyo FROM last_period)
      AND mes  = (SELECT mes  FROM last_period)
  ),
  lm_prev AS (
    SELECT
      SUM(ingresos_netos)    AS ingresos,
      SUM(unidades_vendidas) AS unidades
    FROM ventas_mensuales
    WHERE anyo = (SELECT anyo FROM last_period) - 1
      AND mes  = (SELECT mes  FROM last_period)
  )
  SELECT
    COALESCE(ytd.ingresos, 0)::numeric,
    COALESCE(ytd.unidades, 0)::bigint,
    COALESCE(ytd.meses, 0)::bigint,
    COALESCE(prev.ingresos, 0)::numeric,
    COALESCE(prev.unidades, 0)::bigint,
    COALESCE((SELECT anyo FROM last_period), p_cur_anyo::smallint),
    COALESCE((SELECT mes  FROM last_period), p_cur_mes::smallint),
    COALESCE(last_month.ingresos, 0)::numeric,
    COALESCE(last_month.unidades, 0)::bigint,
    COALESCE(lm_prev.ingresos, 0)::numeric,
    COALESCE(lm_prev.unidades, 0)::bigint
  FROM ytd, prev, last_month, lm_prev;
$$;

-- ── 3. Top modelos por ingresos en un rango de 12 meses ─────────────────
CREATE OR REPLACE FUNCTION ventas_top_modelos(
  p_anyo_desde integer,
  p_mes_desde  integer,
  p_anyo_hasta integer,
  p_mes_hasta  integer,
  p_limit      integer DEFAULT 10
)
RETURNS TABLE(
  codigo_modelo     text,
  ingresos_12m      numeric,
  unidades_12m      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    codigo_modelo,
    COALESCE(SUM(ingresos_netos), 0)    AS ingresos_12m,
    COALESCE(SUM(unidades_vendidas), 0) AS unidades_12m
  FROM ventas_mensuales
  WHERE (anyo * 100 + mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (anyo * 100 + mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY codigo_modelo
  ORDER BY ingresos_12m DESC
  LIMIT p_limit;
$$;

-- ── 4. Ventas por familia en un rango de 12 meses ────────────────────────
CREATE OR REPLACE FUNCTION ventas_por_familia(
  p_anyo_desde integer,
  p_mes_desde  integer,
  p_anyo_hasta integer,
  p_mes_hasta  integer,
  p_limit      integer DEFAULT 8
)
RETURNS TABLE(
  familia           text,
  ingresos          numeric,
  unidades          bigint,
  pct_ingresos      numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT
      COALESCE(p.familia, 'Sin familia') AS familia,
      COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos,
      COALESCE(SUM(v.unidades_vendidas), 0) AS unidades
    FROM ventas_mensuales v
    LEFT JOIN products p ON p.codigo_modelo = v.codigo_modelo
    WHERE (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
      AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
    GROUP BY COALESCE(p.familia, 'Sin familia')
  ),
  total AS (
    SELECT SUM(ingresos) AS total_ingresos FROM base
  )
  SELECT
    b.familia,
    b.ingresos,
    b.unidades,
    CASE WHEN t.total_ingresos > 0
      THEN ROUND((b.ingresos / t.total_ingresos) * 100, 1)
      ELSE 0
    END AS pct_ingresos
  FROM base b, total t
  ORDER BY b.ingresos DESC
  LIMIT p_limit;
$$;

-- Permisos para anon (la app usa anon key para lecturas)
GRANT EXECUTE ON FUNCTION ventas_evolucion TO anon;
GRANT EXECUTE ON FUNCTION ventas_kpis TO anon;
GRANT EXECUTE ON FUNCTION ventas_top_modelos TO anon;
GRANT EXECUTE ON FUNCTION ventas_por_familia TO anon;
