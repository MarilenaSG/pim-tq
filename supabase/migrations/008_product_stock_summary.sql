-- FASE 1.3: vista agregada de stock por modelo
CREATE OR REPLACE VIEW product_stock_summary AS
SELECT
  codigo_modelo,
  SUM(stock_variante)                                   AS stock_total,
  COUNT(codigo_interno)                                 AS num_variantes,
  COUNT(CASE WHEN stock_variante > 0 THEN 1 END)        AS variantes_con_stock
FROM product_variants
GROUP BY codigo_modelo;
