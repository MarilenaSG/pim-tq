-- Migración 015: arreglo completo de ventas_mensuales
-- La tabla usa "slug" como columna FK (mismo valor que codigo_interno del CSV).
-- Esta migración asegura estructura, índices y RPCs correctas.

-- ── 1. Asegurar columna tienda ───────────────────────────────────────────
ALTER TABLE ventas_mensuales
  ADD COLUMN IF NOT EXISTS tienda text NOT NULL DEFAULT 'sin_tienda';

-- ── 2. Constraint único correcto ─────────────────────────────────────────
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_slug_anyo_mes_key;
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_slug_tienda_anyo_mes_key;
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_ci_tienda_anyo_mes_key;
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_codigo_interno_anyo_mes_key;
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_codigo_interno_tienda_anyo_mes_key;

ALTER TABLE ventas_mensuales
  ADD CONSTRAINT ventas_mensuales_slug_tienda_anyo_mes_key
  UNIQUE (slug, tienda, anyo, mes);

-- ── 3. Índices ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ventas_slug     ON ventas_mensuales(slug);
CREATE INDEX IF NOT EXISTS idx_ventas_anyo_mes ON ventas_mensuales(anyo, mes);

-- ── 4. RPCs: slug en ventas_mensuales → JOIN product_variants.codigo_interno
--      para obtener codigo_modelo y filtrar al catálogo actual ─────────────

CREATE OR REPLACE FUNCTION ventas_evolucion(
  p_anyo_desde integer, p_mes_desde integer,
  p_anyo_hasta integer, p_mes_hasta integer
)
RETURNS TABLE(anyo smallint, mes smallint, ingresos_netos numeric, unidades_vendidas bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT v.anyo, v.mes,
    COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos_netos,
    COALESCE(SUM(v.unidades_vendidas), 0) AS unidades_vendidas
  FROM ventas_mensuales v
  WHERE EXISTS (SELECT 1 FROM product_variants pv WHERE pv.codigo_interno = v.slug)
    AND (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY v.anyo, v.mes
  ORDER BY v.anyo, v.mes;
$$;

CREATE OR REPLACE FUNCTION ventas_kpis(
  p_cur_anyo integer, p_cur_mes integer, p_prev_anyo integer
)
RETURNS TABLE(
  ytd_ingresos numeric, ytd_unidades bigint, ytd_meses bigint,
  prev_ingresos numeric, prev_unidades bigint,
  last_anyo smallint, last_mes smallint,
  last_ingresos numeric, last_unidades bigint,
  lm_prev_ingresos numeric, lm_prev_unidades bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  cat AS (SELECT codigo_interno FROM product_variants),
  ytd AS (
    SELECT SUM(v.ingresos_netos) AS ing, SUM(v.unidades_vendidas) AS uds, COUNT(DISTINCT v.mes) AS meses
    FROM ventas_mensuales v JOIN cat ON cat.codigo_interno = v.slug
    WHERE v.anyo = p_cur_anyo
  ),
  prev AS (
    SELECT SUM(v.ingresos_netos) AS ing, SUM(v.unidades_vendidas) AS uds
    FROM ventas_mensuales v JOIN cat ON cat.codigo_interno = v.slug
    WHERE v.anyo = p_prev_anyo
  ),
  lp AS (
    SELECT v.anyo, v.mes FROM ventas_mensuales v
    JOIN cat ON cat.codigo_interno = v.slug
    ORDER BY v.anyo DESC, v.mes DESC LIMIT 1
  ),
  lm AS (
    SELECT SUM(v.ingresos_netos) AS ing, SUM(v.unidades_vendidas) AS uds
    FROM ventas_mensuales v JOIN cat ON cat.codigo_interno = v.slug
    WHERE v.anyo = (SELECT anyo FROM lp) AND v.mes = (SELECT mes FROM lp)
  ),
  lmp AS (
    SELECT SUM(v.ingresos_netos) AS ing, SUM(v.unidades_vendidas) AS uds
    FROM ventas_mensuales v JOIN cat ON cat.codigo_interno = v.slug
    WHERE v.anyo = (SELECT anyo FROM lp) - 1 AND v.mes = (SELECT mes FROM lp)
  )
  SELECT
    COALESCE(ytd.ing,  0)::numeric, COALESCE(ytd.uds,  0)::bigint, COALESCE(ytd.meses, 0)::bigint,
    COALESCE(prev.ing, 0)::numeric, COALESCE(prev.uds, 0)::bigint,
    COALESCE((SELECT anyo FROM lp), p_cur_anyo::smallint),
    COALESCE((SELECT mes  FROM lp), p_cur_mes::smallint),
    COALESCE(lm.ing,  0)::numeric, COALESCE(lm.uds,  0)::bigint,
    COALESCE(lmp.ing, 0)::numeric, COALESCE(lmp.uds, 0)::bigint
  FROM ytd, prev, lm, lmp;
$$;

CREATE OR REPLACE FUNCTION ventas_top_modelos(
  p_anyo_desde integer, p_mes_desde integer,
  p_anyo_hasta integer, p_mes_hasta integer,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(codigo_modelo text, ingresos_12m numeric, unidades_12m bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT pv.codigo_modelo,
    COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos_12m,
    COALESCE(SUM(v.unidades_vendidas), 0) AS unidades_12m
  FROM ventas_mensuales v
  JOIN product_variants pv ON pv.codigo_interno = v.slug
  WHERE (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY pv.codigo_modelo
  ORDER BY ingresos_12m DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION ventas_por_familia(
  p_anyo_desde integer, p_mes_desde integer,
  p_anyo_hasta integer, p_mes_hasta integer,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(familia text, ingresos numeric, unidades bigint, pct_ingresos numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH base AS (
    SELECT
      COALESCE(p.familia, 'Sin familia') AS familia,
      COALESCE(SUM(v.ingresos_netos), 0)    AS ingresos,
      COALESCE(SUM(v.unidades_vendidas), 0) AS unidades
    FROM ventas_mensuales v
    JOIN product_variants pv ON pv.codigo_interno = v.slug
    JOIN products p           ON p.codigo_modelo  = pv.codigo_modelo
    WHERE (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
      AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
    GROUP BY COALESCE(p.familia, 'Sin familia')
  ),
  total AS (SELECT SUM(ingresos) AS t FROM base)
  SELECT b.familia, b.ingresos, b.unidades,
    CASE WHEN t.t > 0 THEN ROUND((b.ingresos / t.t) * 100, 1) ELSE 0 END
  FROM base b, total t ORDER BY b.ingresos DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION ventas_por_modelo(
  p_anyo_12_desde integer, p_mes_12_desde integer,
  p_anyo_hasta integer, p_mes_hasta integer,
  p_anyo_prev_desde integer, p_mes_prev_desde integer,
  p_anyo_spark_desde integer, p_mes_spark_desde integer
)
RETURNS TABLE(
  codigo_modelo text, ingresos_12m numeric, unidades_12m bigint,
  ingresos_prev_12m numeric, meses_con_ventas bigint, spark_json jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH
  base AS (
    SELECT pv.codigo_modelo,
      v.anyo * 100 + v.mes AS period,
      v.anyo, v.mes,
      COALESCE(v.ingresos_netos, 0)    AS ingresos,
      COALESCE(v.unidades_vendidas, 0) AS unidades
    FROM ventas_mensuales v
    JOIN product_variants pv ON pv.codigo_interno = v.slug
    WHERE (v.anyo * 100 + v.mes) >= (p_anyo_prev_desde * 100 + p_mes_prev_desde)
      AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta      * 100 + p_mes_hasta)
  ),
  curr AS (
    SELECT codigo_modelo,
      SUM(ingresos)               AS ingresos_12m,
      SUM(unidades)               AS unidades_12m,
      COUNT(DISTINCT (anyo, mes)) AS meses_con_ventas
    FROM base
    WHERE period >= (p_anyo_12_desde * 100 + p_mes_12_desde)
      AND period <= (p_anyo_hasta    * 100 + p_mes_hasta)
    GROUP BY codigo_modelo
  ),
  prev AS (
    SELECT codigo_modelo, SUM(ingresos) AS ingresos_prev_12m
    FROM base
    WHERE period >= (p_anyo_prev_desde * 100 + p_mes_prev_desde)
      AND period <  (p_anyo_12_desde   * 100 + p_mes_12_desde)
    GROUP BY codigo_modelo
  ),
  spark AS (
    SELECT codigo_modelo,
      jsonb_agg(jsonb_build_object('period', period, 'ingresos', monthly_ing) ORDER BY period) AS spark_json
    FROM (
      SELECT codigo_modelo, period, SUM(ingresos) AS monthly_ing
      FROM base
      WHERE period >= (p_anyo_spark_desde * 100 + p_mes_spark_desde)
        AND period <= (p_anyo_hasta        * 100 + p_mes_hasta)
      GROUP BY codigo_modelo, period
    ) s
    GROUP BY codigo_modelo
  )
  SELECT c.codigo_modelo,
    COALESCE(c.ingresos_12m, 0)::numeric,
    COALESCE(c.unidades_12m, 0)::bigint,
    COALESCE(p.ingresos_prev_12m, 0)::numeric,
    COALESCE(c.meses_con_ventas, 0)::bigint,
    COALESCE(s.spark_json, '[]'::jsonb)
  FROM curr c
  LEFT JOIN prev  p ON p.codigo_modelo = c.codigo_modelo
  LEFT JOIN spark s ON s.codigo_modelo = c.codigo_modelo
  WHERE c.ingresos_12m > 0
  ORDER BY c.ingresos_12m DESC;
$$;

GRANT EXECUTE ON FUNCTION ventas_evolucion   TO anon;
GRANT EXECUTE ON FUNCTION ventas_kpis        TO anon;
GRANT EXECUTE ON FUNCTION ventas_top_modelos TO anon;
GRANT EXECUTE ON FUNCTION ventas_por_familia TO anon;
GRANT EXECUTE ON FUNCTION ventas_por_modelo  TO anon;
