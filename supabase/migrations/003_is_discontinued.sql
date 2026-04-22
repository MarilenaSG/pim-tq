-- ============================================================
-- Migración 003: campo is_discontinued en products
-- ============================================================

alter table products
  add column if not exists is_discontinued boolean not null default false;

create index if not exists idx_products_is_discontinued
  on products (is_discontinued);

comment on column products.is_discontinued is
  'True = sin stock en almacén central. El producto sigue visible en catálogo
   mientras alguna variante tenga stock_variante > 0 en tiendas.';
