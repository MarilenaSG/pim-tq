-- FASE 1.2: tabla product_c_decisions (decisiones de Category Management)
CREATE TABLE IF NOT EXISTS product_c_decisions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_modelo       TEXT REFERENCES products(codigo_modelo) ON DELETE CASCADE,
  decision            TEXT CHECK (decision IN ('outlet', 'promocion', 'retirar', 'mantener', 'reubicar')),
  descuento_sugerido  NUMERIC(5,2),
  descuento_aprobado  NUMERIC(5,2),
  precio_objetivo     NUMERIC(10,2),
  diagnostico         TEXT,
  notas               TEXT,
  estado              TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobado', 'ejecutado')),
  ia_razonamiento     TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS: lectura libre con anon key, escrituras via service role
ALTER TABLE product_c_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_product_c_decisions"
  ON product_c_decisions FOR SELECT USING (true);
