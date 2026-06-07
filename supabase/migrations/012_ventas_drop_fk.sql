-- Migración 012: eliminar FK constraints en ventas_mensuales
-- Motivo: el CSV de ventas incluye variantes descatalogadas (~529 extra)
-- que no existen en product_variants pero cuya facturación es real y debe contabilizarse.
-- codigo_modelo se deriva ahora de los primeros 5 chars de codigo_interno (patrón fijo).

ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_slug_fkey;
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_codigo_interno_fkey;
ALTER TABLE ventas_mensuales DROP CONSTRAINT IF EXISTS ventas_mensuales_codigo_modelo_fkey;

-- Permitir codigo_modelo nullable para variantes cuyo modelo tampoco exista ya en products
ALTER TABLE ventas_mensuales ALTER COLUMN codigo_modelo DROP NOT NULL;
