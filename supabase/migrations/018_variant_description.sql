-- Añadir columna description a product_variants
-- Cada variante tiene su propia descripción en Metabase (a nivel de codigo_interno).
-- Antes se descartaba al hacer upsert; ahora la almacenamos para exportarla directamente.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS description TEXT;
