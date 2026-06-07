-- Añadir shopify_vendor a products para poder filtrar por Marca sin JOIN
alter table products add column if not exists shopify_vendor text;

-- Backfill desde product_shopify_data
update products p
set    shopify_vendor = sd.shopify_vendor
from   product_shopify_data sd
where  sd.codigo_modelo = p.codigo_modelo
  and  sd.shopify_vendor is not null;
