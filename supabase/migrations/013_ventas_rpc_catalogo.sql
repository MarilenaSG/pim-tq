-- Migración 013: RPCs de ventas filtradas al catálogo actual
-- Usa codigo_modelo (precalculado en el sync) en vez de JOIN a product_variants
-- para evitar timeouts. Filtro: codigo_modelo IN (SELECT FROM products)

CREATE OR REPLACE FUNCTION ventas_evolucion(
  p_anyo_desde integer,
  p_mes_desde  integer,
  p_anyo_hasta integer,
  p_mes_hasta  integer
)
RETURNS TABLE(
  anyo              smallint,
  mes               smallint,
  ingresos_netos    numeric,
  unidades_vendidas bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    v.anyo,
    v.mes,
    COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos_netos,
    COALESCE(SUM(v.unidades_vendidas), 0) AS unidades_vendidas
  FROM ventas_mensuales v
  WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM products)
    AND (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY v.anyo, v.mes
  ORDER BY v.anyo, v.mes;
$$;

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
  cat AS (SELECT codigo_modelo FROM products),
  ytd AS (
    SELECT
      SUM(v.ingresos_netos)    AS ingresos,
      SUM(v.unidades_vendidas) AS unidades,
      COUNT(DISTINCT v.mes)    AS meses
    FROM ventas_mensuales v
    WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM cat)
      AND v.anyo = p_cur_anyo
  ),
  prev AS (
    SELECT
      SUM(v.ingresos_netos)    AS ingresos,
      SUM(v.unidades_vendidas) AS unidades
    FROM ventas_mensuales v
    WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM cat)
      AND v.anyo = p_prev_anyo
  ),
  last_period AS (
    SELECT v.anyo, v.mes
    FROM ventas_mensuales v
    WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM cat)
    ORDER BY v.anyo DESC, v.mes DESC
    LIMIT 1
  ),
  last_month AS (
    SELECT SUM(v.ingresos_netos) AS ingresos, SUM(v.unidades_vendidas) AS unidades
    FROM ventas_mensuales v
    WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM cat)
      AND v.anyo = (SELECT anyo FROM last_period)
      AND v.mes  = (SELECT mes  FROM last_period)
  ),
  lm_prev AS (
    SELECT SUM(v.ingresos_netos) AS ingresos, SUM(v.unidades_vendidas) AS unidades
    FROM ventas_mensuales v
    WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM cat)
      AND v.anyo = (SELECT anyo FROM last_period) - 1
      AND v.mes  = (SELECT mes  FROM last_period)
  )
  SELECT
    COALESCE(ytd.ingresos, 0)::numeric,
    COALESCE(ytd.unidades, 0)::bigint,
    COALESCE(ytd.meses,    0)::bigint,
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

CREATE OR REPLACE FUNCTION ventas_top_modelos(
  p_anyo_desde integer,
  p_mes_desde  integer,
  p_anyo_hasta integer,
  p_mes_hasta  integer,
  p_limit      integer DEFAULT 10
)
RETURNS TABLE(
  codigo_modelo text,
  ingresos_12m  numeric,
  unidades_12m  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    v.codigo_modelo,
    COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos_12m,
    COALESCE(SUM(v.unidades_vendidas), 0) AS unidades_12m
  FROM ventas_mensuales v
  WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM products)
    AND (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY v.codigo_modelo
  ORDER BY ingresos_12m DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION ventas_por_familia(
  p_anyo_desde integer,
  p_mes_desde  integer,
  p_anyo_hasta integer,
  p_mes_hasta  integer,
  p_limit      integer DEFAULT 8
)
RETURNS TABLE(
  familia      text,
  ingresos     numeric,
  unidades     bigint,
  pct_ingresos numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT
      COALESCE(p.familia, 'Sin familia') AS familia,
      COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos,
      COALESCE(SUM(v.unidades_vendidas), 0) AS unidades
    FROM ventas_mensuales v
    JOIN products p ON p.codigo_modelo = v.codigo_modelo
    WHERE (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
      AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
    GROUP BY COALESCE(p.familia, 'Sin familia')
  ),
  total AS (SELECT SUM(ingresos) AS total_ingresos FROM base)
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

GRANT EXECUTE ON FUNCTION ventas_evolucion   TO anon;
GRANT EXECUTE ON FUNCTION ventas_kpis        TO anon;
GRANT EXECUTE ON FUNCTION ventas_top_modelos TO anon;
GRANT EXECUTE ON FUNCTION ventas_por_familia TO anon;
