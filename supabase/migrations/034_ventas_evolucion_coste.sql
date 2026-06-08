-- Migración 034: añade coste_total a ventas_evolucion
-- Necesario para calcular MB% acumulado en el dashboard de ventas.

DROP FUNCTION IF EXISTS ventas_evolucion(integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION ventas_evolucion(
  p_anyo_desde integer, p_mes_desde integer,
  p_anyo_hasta integer, p_mes_hasta integer
)
RETURNS TABLE(
  anyo              smallint,
  mes               smallint,
  ingresos_netos    numeric,
  unidades_vendidas bigint,
  coste_total       numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    v.anyo,
    v.mes,
    COALESCE(SUM(v.ingresos_netos), 0)  AS ingresos_netos,
    COALESCE(SUM(v.unidades_vendidas), 0)::bigint AS unidades_vendidas,
    COALESCE(SUM(v.coste_total), 0)     AS coste_total
  FROM ventas_mensuales v
  WHERE EXISTS (SELECT 1 FROM product_variants pv WHERE pv.codigo_interno = v.slug)
    AND (v.anyo * 100 + v.mes) >= (p_anyo_desde * 100 + p_mes_desde)
    AND (v.anyo * 100 + v.mes) <= (p_anyo_hasta * 100 + p_mes_hasta)
  GROUP BY v.anyo, v.mes
  ORDER BY v.anyo, v.mes;
$$;

GRANT EXECUTE ON FUNCTION ventas_evolucion TO anon;
