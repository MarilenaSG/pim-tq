-- Migración 017: ventas_por_modelo optimizada
-- Fixes:
--   1. Filtro sargable en anyo/mes → Postgres puede usar índices
--   2. Alias interno "cm" para evitar ambigüedad con variable PLPGSQL RETURNS TABLE
--   3. SET LOCAL statement_timeout = 25s (supera el corte de 3s del API de Supabase)
--   4. Índice compuesto (slug, anyo, mes) para el JOIN + filtro de período

CREATE INDEX IF NOT EXISTS idx_ventas_slug_periodo
  ON ventas_mensuales(slug, anyo DESC, mes DESC);

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
LANGUAGE plpgsql VOLATILE SECURITY DEFINER AS $$
BEGIN
  SET LOCAL statement_timeout = '25000';

  RETURN QUERY
  WITH base AS (
    -- Alias "cm" to avoid PLPGSQL output-variable clash with "codigo_modelo"
    SELECT
      pv.codigo_modelo                     AS cm,
      v.anyo                               AS ba,
      v.mes                                AS bm,
      COALESCE(v.ingresos_netos,    0)     AS ingresos,
      COALESCE(v.unidades_vendidas, 0)     AS unidades
    FROM ventas_mensuales v
    JOIN product_variants pv ON pv.codigo_interno = v.slug
    WHERE (
      v.anyo  > p_anyo_prev_desde
      OR (v.anyo = p_anyo_prev_desde AND v.mes >= p_mes_prev_desde)
    )
    AND (
      v.anyo  < p_anyo_hasta
      OR (v.anyo = p_anyo_hasta AND v.mes <= p_mes_hasta)
    )
  ),
  curr AS (
    SELECT
      b.cm,
      SUM(b.ingresos)                              AS ingresos_12m,
      SUM(b.unidades)                              AS unidades_12m,
      COUNT(DISTINCT (b.ba, b.bm))::bigint         AS meses_con_ventas
    FROM base b
    WHERE (
      b.ba  > p_anyo_12_desde
      OR (b.ba = p_anyo_12_desde AND b.bm >= p_mes_12_desde)
    )
    AND (
      b.ba  < p_anyo_hasta
      OR (b.ba = p_anyo_hasta AND b.bm <= p_mes_hasta)
    )
    GROUP BY b.cm
  ),
  prev_agg AS (
    SELECT
      b.cm,
      SUM(b.ingresos) AS ingresos_prev_12m
    FROM base b
    WHERE (
      b.ba  > p_anyo_prev_desde
      OR (b.ba = p_anyo_prev_desde AND b.bm >= p_mes_prev_desde)
    )
    AND (
      b.ba  < p_anyo_12_desde
      OR (b.ba = p_anyo_12_desde AND b.bm < p_mes_12_desde)
    )
    GROUP BY b.cm
  ),
  spark AS (
    SELECT
      s.cm,
      jsonb_agg(
        jsonb_build_object('period', s.ba * 100 + s.bm, 'ingresos', s.monthly_ing)
        ORDER BY s.ba * 100 + s.bm
      ) AS spark_json
    FROM (
      SELECT b.cm, b.ba, b.bm, SUM(b.ingresos) AS monthly_ing
      FROM base b
      WHERE (
        b.ba  > p_anyo_spark_desde
        OR (b.ba = p_anyo_spark_desde AND b.bm >= p_mes_spark_desde)
      )
      GROUP BY b.cm, b.ba, b.bm
    ) s
    GROUP BY s.cm
  )
  SELECT
    c.cm,
    COALESCE(c.ingresos_12m,       0)::numeric,
    COALESCE(c.unidades_12m,       0)::bigint,
    COALESCE(pa.ingresos_prev_12m, 0)::numeric,
    COALESCE(c.meses_con_ventas,   0)::bigint,
    COALESCE(sk.spark_json, '[]'::jsonb)
  FROM curr c
  LEFT JOIN prev_agg pa ON pa.cm = c.cm
  LEFT JOIN spark    sk ON sk.cm = c.cm
  WHERE c.ingresos_12m > 0
  ORDER BY c.ingresos_12m DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION ventas_por_modelo TO anon;
