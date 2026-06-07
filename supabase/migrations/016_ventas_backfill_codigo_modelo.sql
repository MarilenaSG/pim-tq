-- Migración 016: backfill codigo_modelo en ventas_mensuales
-- El sync anterior no escribía este campo. Se deriva de los primeros 5 chars del slug.
-- Ejemplo: slug "002AA08" → codigo_modelo "002AA"

UPDATE ventas_mensuales
SET    codigo_modelo = substring(slug, 1, 5)
WHERE  codigo_modelo IS NULL
  AND  length(slug) >= 5;
