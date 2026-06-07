-- Migración 023: reemplaza unidades_por_tienda por unidades_compra_total
-- El nuevo modelo recibe el total del pedido y distribuye automáticamente
-- por cluster en el wizard (Flagship 1.5×, Estándar 1×, Pequeña 0.5×).

alter table lanzamientos
  add column if not exists unidades_compra_total numeric;

-- Backfill: recuperar el total de borradores existentes
update lanzamientos
set unidades_compra_total = unidades_por_tienda * n_tiendas
where unidades_por_tienda is not null
  and n_tiendas           is not null
  and unidades_compra_total is null;
