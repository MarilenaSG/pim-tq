-- Migración 010: añadir tienda a ventas_mensuales
-- El CSV de Metabase tiene granularidad por tienda (columna: tienda_nombre)
-- La clave única pasa de (slug, anyo, mes) a (slug, tienda, anyo, mes)

-- 1. Añadir columna tienda (con default para filas existentes si las hubiera)
ALTER TABLE ventas_mensuales
  ADD COLUMN IF NOT EXISTS tienda text NOT NULL DEFAULT 'sin_tienda';

-- 2. Eliminar el índice único anterior (puede tener cualquiera de estos nombres)
ALTER TABLE ventas_mensuales
  DROP CONSTRAINT IF EXISTS ventas_mensuales_slug_anyo_mes_key;
ALTER TABLE ventas_mensuales
  DROP CONSTRAINT IF EXISTS ventas_mensuales_codigo_interno_anyo_mes_key;

-- 3. Nuevo índice único con tienda
ALTER TABLE ventas_mensuales
  ADD CONSTRAINT ventas_mensuales_slug_tienda_anyo_mes_key
  UNIQUE (slug, tienda, anyo, mes);

-- 4. Índice de consulta actualizado
DROP INDEX IF EXISTS idx_ventas_modelo;
CREATE INDEX IF NOT EXISTS idx_ventas_modelo ON ventas_mensuales(codigo_modelo, anyo, mes);
CREATE INDEX IF NOT EXISTS idx_ventas_tienda ON ventas_mensuales(tienda, anyo, mes);
