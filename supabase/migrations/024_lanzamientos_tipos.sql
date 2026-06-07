-- Migración 024: campos específicos para Drop y Marca
-- Drop:  familias_drop (jsonb) — array de { familia, uds, precio_medio }
-- Marca: posicionamiento_marca, arquitectura_precios, familias_marca

alter table lanzamientos
  add column if not exists familias_drop          jsonb,          -- Drop: [{familia,uds,precio_medio}]
  add column if not exists familias_marca         text[],         -- Marca: ['anillos','pendientes',...]
  add column if not exists posicionamiento_marca  text            -- Marca: 'premium'|'media'|'accesible'
    check (posicionamiento_marca in ('premium','media','accesible')),
  add column if not exists arquitectura_precios   jsonb,          -- Marca: {familia:{min,medio,max}}
  add column if not exists descripcion_marca      text;           -- Marca: concepto/descripción
