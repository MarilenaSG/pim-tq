-- Migración 014: índices + RPC optimizada para sell-out por modelo
-- El timeout venía de un JOIN sin índice en ventas_mensuales.slug
-- Solución: índice en slug + usar codigo_modelo directamente (ya en la tabla)

-- ── Índices necesarios ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ventas_slug
  ON ventas_mensuales(slug);

CREATE INDEX IF NOT EXISTS idx_ventas_cm_periodo
  ON ventas_mensuales(codigo_modelo, anyo, mes);

-- ── RPC sell-out por modelo ──────────────────────────────────────────────
-- Filtra al catálogo actual usando codigo_modelo (ya precalculado en el sync),
-- sin JOIN costoso a product_variants.

CREATE OR REPLACE FUNCTION ventas_por_modelo(
  p_anyo_12_desde    integer,
  p_mes_12_desde     integer,
  p_anyo_hasta       integer,
  p_mes_hasta        integer,
  p_anyo_prev_desde  integer,
  p_mes_prev_desde   integer,
  p_anyo_spark_desde integer,
  p_mes_spark_desde  integer
)
RETURNS TABLE(
  codigo_modelo     text,
  ingresos_12m      numeric,
  unidades_12m      bigint,
  ingresos_prev_12m numeric,
  meses_con_ventas  bigint,
  spark_json        jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH
  -- Modelos del catálogo actual (PK indexada → muy rápido)
  cat AS (
    SELECT codigo_modelo FROM products
  ),
  -- Solo filas del período relevante (24m) del catálogo actual
  base AS (
    SELECT
      v.codigo_modelo,
      v.anyo * 100 + v.mes  AS period,
      v.anyo,
      v.mes,
      COALESCE(v.ingresos_netos, 0)    AS ingresos,
      COALESCE(v.unidades_vendidas, 0) AS unidades
    FROM ventas_mensuales v
    WHERE v.codigo_modelo IN (SELECT codigo_modelo FROM cat)
      AND (v.anyo * 100 + v.mes) >= (p_anyo_prev_desde * 100 + p_mes_prev_desde)
      AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta      * 100 + p_mes_hasta)
  ),
  curr AS (
    SELECT
      codigo_modelo,
      SUM(ingresos)                AS ingresos_12m,
      SUM(unidades)                AS unidades_12m,
      COUNT(DISTINCT (anyo, mes))  AS meses_con_ventas
    FROM base
    WHERE period >= (p_anyo_12_desde * 100 + p_mes_12_desde)
      AND period <= (p_anyo_hasta    * 100 + p_mes_hasta)
    GROUP BY codigo_modelo
  ),
  prev AS (
    SELECT
      codigo_modelo,
      SUM(ingresos) AS ingresos_prev_12m
    FROM base
    WHERE period >= (p_anyo_prev_desde * 100 + p_mes_prev_desde)
      AND period <  (p_anyo_12_desde   * 100 + p_mes_12_desde)
    GROUP BY codigo_modelo
  ),
  spark AS (
    SELECT
      codigo_modelo,
      jsonb_agg(
        jsonb_build_object('period', period, 'ingresos', monthly_ing)
        ORDER BY period
      ) AS spark_json
    FROM (
      SELECT codigo_modelo, period, SUM(ingresos) AS monthly_ing
      FROM base
      WHERE period >= (p_anyo_spark_desde * 100 + p_mes_spark_desde)
        AND period <= (p_anyo_hasta        * 100 + p_mes_hasta)
      GROUP BY codigo_modelo, period
    ) s
    GROUP BY codigo_modelo
  )
  SELECT
    c.codigo_modelo,
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

GRANT EXECUTE ON FUNCTION ventas_por_modelo TO anon;
