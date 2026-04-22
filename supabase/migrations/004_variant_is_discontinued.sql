-- ============================================================
-- Migración 004: campo is_discontinued en product_variants
-- ============================================================

alter table product_variants
  add column if not exists is_discontinued boolean not null default false;

create index if not exists idx_product_variants_is_discontinued
  on product_variants (is_discontinued);

comment on column product_variants.is_discontinued is
  'True = esta talla/variante específica está descatalogada (sin reposición prevista),
   independientemente del estado del modelo padre.';
