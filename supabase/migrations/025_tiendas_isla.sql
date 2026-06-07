-- Migración 025: campo isla en tiendas
-- Preparación para expansión multi-isla (actualmente todas en Tenerife).
-- El campo permite filtrar, agrupar y distribuir stock por isla en el futuro.

alter table tiendas
  add column if not exists isla text default 'Tenerife';

-- Backfill: todas las tiendas actuales están en Tenerife
update tiendas set isla = 'Tenerife' where isla is null;

-- Restricción: solo islas canarias reconocidas
alter table tiendas
  add constraint tiendas_isla_check
  check (isla in (
    'Tenerife', 'Gran Canaria', 'Lanzarote', 'Fuerteventura',
    'La Palma', 'La Gomera', 'El Hierro', 'La Graciosa'
  ));

-- Índice para filtrado y agrupación futura por isla
create index if not exists idx_tiendas_isla on tiendas(isla);

comment on column tiendas.isla is
  'Isla canaria donde está la tienda. Default Tenerife. Permite expansión multi-isla.';
