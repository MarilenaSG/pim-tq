-- FASE 1.1: lifecycle_status en tabla products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'activo'
CHECK (lifecycle_status IN ('activo', 'en_revision', 'a_discontinuar', 'descatalogado'));
