-- ============================================================
-- PIM Te Quiero — Migración 035: Matriz de Surtido
-- Ejecutar en Supabase → SQL Editor DESPUÉS de la 034.
--
-- Reproduce la lógica del Excel "Matriz_Surtido_TQ" (964 modelos):
--   · margen_abc  = terciles (ntile 3) sobre margen del modelo (variante líder)
--   · abc_cruzado = Clase_ABC (volumen) × margen_abc  (9 celdas + 2 bordes)
--   · rol_surtido = 5 reglas en orden (Test → Sin venta → Core → Extendido → Cola)
--   · escalon_precio / ciclo_vida derivados
--
-- Decisiones (validadas contra el Excel):
--   · Reutiliza abc_unidades y pct_margen_bruto del sync (no recalcula Pareto).
--   · stores.cluster y rol_categoria_familia son EJES DE REFERENCIA (no clasifican).
--   · es_basico es una lista curada a mano (semilla del Excel + toggle en el PIM).
--   · Umbral Core = num_tiendas_activo >= 15 (18 tiendas físicas).
-- ============================================================

-- ── 1 · Flag manual es_basico en products ────────────────────
alter table products add column if not exists es_basico boolean not null default false;

-- Semilla: 48 modelos "básicos" del Excel (no-op para códigos que no existan)
update products set es_basico = true where codigo_modelo in (
  '002AA','007A2','002AB','042AB','040AB','092AC','091AC','089AC','090AC','105AC',
  '068AC','028AC','035AE','014AN','191AF','082AF','077AF','071AJ','020AJ','008AY',
  '005AI','004AI','001AI','007AI','003AM','004AM','006AN','003AN','002AN','004AN',
  '127AP','413AP','298AP','183AP','027AQ','003AQ','007AQ','023AQ','008AR','010AR',
  '044AT','021AT','004AU','012AU','002AU','057AB','007AX','003AX'
);

-- ── 2 · Tabla de referencia: stores (cluster de tienda) ──────
-- Analítica para CM. NO interfiere con la zona Tiendas store-facing.
-- Carga manual; cluster editable a mano (patrón pricing_rules).
create table if not exists stores (
  tienda            text primary key,
  tamano_m2         text,
  tipo_localizacion text,          -- Urbana | Periferia | Turistica
  cluster           text,          -- 'A' | 'B' | 'C'
  ingresos_12m      numeric,
  unidades_12m      integer,
  updated_at        timestamptz default now()
);

insert into stores (tienda, tamano_m2, tipo_localizacion, cluster, ingresos_12m, unidades_12m) values
  ('San Isidro', 'Grande', 'Periferia', 'A', 160914.3, 3686),
  ('Galeón', 'Media', 'Turistica', 'A', 120227.07, 3001),
  ('La Laguna', 'Grande', 'Urbana', 'A', 99672.64, 2498),
  ('Chicharro', 'Pequeña', 'Urbana', 'A', 94252.69, 2053),
  ('Taco', 'Grande', 'Periferia', 'A', 75297.06, 1334),
  ('Villalba', 'Grande', 'Urbana', 'A', 60767.95, 1162),
  ('Icod', 'Media', 'Periferia', 'A', 58595.65, 3228),
  ('Cupido', 'Media', 'Turistica', 'A', 54618.03, 1090),
  ('La Cuesta', 'Grande', 'Periferia', 'A', 48917.6, 1453),
  ('Las Galletas', 'Media', 'Periferia', 'A', 46955.21, 973),
  ('Guargacho', 'Media', 'Periferia', 'B', 43195.16, 891),
  ('Candelaria', 'Media', 'Periferia', 'B', 40777.19, 1230),
  ('Salud', 'Media', 'Periferia', 'B', 38225.65, 1016),
  ('Gigantes', 'Grande', 'Turistica', 'B', 35594.75, 728),
  ('Realejos', 'Media', 'Periferia', 'B', 25624.51, 814),
  ('San Agustín', 'Media', 'Periferia', 'C', 24740, 515),
  ('Ofra', 'Pequeña', 'Periferia', 'C', 17309.45, 545),
  ('Puerto de la Cruz', 'Pequeña', 'Turistica', 'C', 14840.89, 454)
on conflict (tienda) do nothing;

-- ── 3 · Tabla de referencia: rol_categoria_familia ───────────
create table if not exists rol_categoria_familia (
  familia        text primary key,
  rol_categoria  text,             -- Destino | Rutina | Ocasional | Conveniencia
  justificacion  text,
  updated_at     timestamptz default now()
);

insert into rol_categoria_familia (familia, rol_categoria, justificacion) values
  ('Solitarios', 'Destino', 'Producto de decisión/compromiso, alto ticket, define la percepción de la joyería'),
  ('Alianzas', 'Destino', 'Compra planificada de alto valor emocional, tráfico dirigido'),
  ('Cadenas', 'Rutina', 'Alta recurrencia, rotación estable todo el año'),
  ('Pendientes', 'Rutina', 'Categoría de mayor unidades vendidas, recurrencia alta'),
  ('Anillos', 'Rutina', 'Amplia base de referencias, compra frecuente'),
  ('Pulseras', 'Rutina', 'Recurrencia media-alta, buen ticket medio'),
  ('Colgantes', 'Ocasional', 'Ligado a regalo/fecha señalada'),
  ('Collares', 'Ocasional', 'Compra de regalo u ocasión'),
  ('Medallas', 'Ocasional', 'Bautizos, comuniones, fechas religiosas'),
  ('Placas', 'Ocasional', 'Regalo bebé/bautizo'),
  ('Esclavas', 'Ocasional', 'Regalo, menor recurrencia'),
  ('Aros', 'Conveniencia', 'Ticket bajo, compra de relleno/impulso'),
  ('Piercings', 'Conveniencia', 'Ticket bajo, target joven, impulso'),
  ('Ear Cuff', 'Conveniencia', 'Tendencia moda, ticket bajo'),
  ('Sellos', 'Conveniencia', 'Nicho, baja recurrencia'),
  ('Tobillera', 'Conveniencia', 'Nicho estacional (verano)'),
  ('Otros', 'Conveniencia', 'Accesorios y varios')
on conflict (familia) do nothing;

-- ── 4 · RLS para las tablas nuevas (patrón pricing_rules) ────
alter table stores                enable row level security;
alter table rol_categoria_familia enable row level security;

drop policy if exists "read_stores"  on stores;
drop policy if exists "write_stores" on stores;
create policy "read_stores"  on stores for select
  using (auth.role() in ('authenticated','service_role','anon'));
create policy "write_stores" on stores for all
  using (auth.role() in ('authenticated','service_role'));

drop policy if exists "read_rol_cat"  on rol_categoria_familia;
drop policy if exists "write_rol_cat" on rol_categoria_familia;
create policy "read_rol_cat"  on rol_categoria_familia for select
  using (auth.role() in ('authenticated','service_role','anon'));
create policy "write_rol_cat" on rol_categoria_familia for all
  using (auth.role() in ('authenticated','service_role'));

-- ── 5 · Vista v_matriz_surtido (calcula todos los ejes) ──────
-- Universo = modelos activos (is_discontinued no true), como los 964 del Excel.
drop view if exists v_matriz_surtido;
create view v_matriz_surtido as
with lider as (
  select distinct on (codigo_modelo)
    codigo_modelo, precio_venta, pct_margen_bruto, num_tiendas_activo
  from product_variants
  where es_variante_lider = true
),
base as (
  select
    p.codigo_modelo,
    p.description,
    p.familia,
    p.metal,
    coalesce(p.shopify_vendor, 'Tradicional')            as marca,
    p.unidades_12m,
    p.ingresos_12m,
    p.abc_unidades,
    coalesce(p.es_basico, false)                         as es_basico,
    l.precio_venta,
    l.pct_margen_bruto,
    l.num_tiendas_activo,
    (current_date - p.primera_entrada::date)             as dias_desde_alta,
    case when coalesce(p.unidades_12m, 0) = 0 then 'Sin venta'
         else p.abc_unidades::text end                    as clase_abc
  from products p
  left join lider l on l.codigo_modelo = p.codigo_modelo
  where p.is_discontinued is not true
),
terciles as (
  select codigo_modelo,
         ntile(3) over (order by pct_margen_bruto) as t
  from base
  where pct_margen_bruto is not null
),
enr as (
  select
    b.*,
    case t.t when 3 then 'A' when 2 then 'B' when 1 then 'C' end as margen_abc,
    -- escalón de precio (escaleras heredadas del pricing, distintas por metal)
    case
      when b.precio_venta is null then null
      when b.metal = 'Oro' then case
        when b.precio_venta < 80   then '<80€'
        when b.precio_venta < 120  then '80-120€'
        when b.precio_venta < 180  then '120-180€'
        when b.precio_venta < 250  then '180-250€'
        when b.precio_venta < 400  then '250-400€'
        when b.precio_venta < 600  then '400-600€'
        when b.precio_venta < 1000 then '600-1000€'
        else '>1000€' end
      else case
        when b.precio_venta < 10   then '<10€'
        when b.precio_venta < 20   then '10-20€'
        when b.precio_venta < 35   then '20-35€'
        when b.precio_venta < 60   then '35-60€'
        when b.precio_venta < 100  then '60-100€'
        when b.precio_venta < 150  then '100-150€'
        else '>150€' end
    end as escalon_precio,
    case when b.dias_desde_alta is not null and b.dias_desde_alta <= 90
         then 'Nuevo' else 'Vigente' end as ciclo_vida,
    -- rol de surtido: primera regla que se cumple
    case
      when b.dias_desde_alta is not null and b.dias_desde_alta <= 90 then 'Test/Local'
      when coalesce(b.unidades_12m, 0) = 0                           then 'Revisar (sin venta 12M)'
      when b.clase_abc = 'A' and coalesce(b.num_tiendas_activo,0) >= 15 then 'Core'
      when b.clase_abc in ('A','B')                                 then 'Extendido'
      when b.clase_abc = 'C'                                         then 'Cola larga (C)'
      else null
    end as rol_surtido
  from base b
  left join terciles t on t.codigo_modelo = b.codigo_modelo
)
select
  e.*,
  rcf.rol_categoria,
  -- ABC cruzado: volumen × margen (9 celdas + 2 bordes)
  case
    when e.clase_abc = 'Sin venta' then 'Sin venta 12M'
    when e.margen_abc is null       then 'Sin dato de margen'
    when e.clase_abc = 'A' and e.margen_abc = 'A' then 'Estrella'
    when e.clase_abc = 'A' and e.margen_abc = 'B' then 'Motor de tráfico'
    when e.clase_abc = 'A' and e.margen_abc = 'C' then 'Gancho bajo margen'
    when e.clase_abc = 'B' and e.margen_abc = 'A' then 'Joya oculta'
    when e.clase_abc = 'B' and e.margen_abc = 'B' then 'Núcleo estable'
    when e.clase_abc = 'B' and e.margen_abc = 'C' then 'Revisar precio/coste'
    when e.clase_abc = 'C' and e.margen_abc = 'A' then 'Nicho rentable'
    when e.clase_abc = 'C' and e.margen_abc = 'B' then 'Cola larga aceptable'
    when e.clase_abc = 'C' and e.margen_abc = 'C' then 'Candidato a descatalogar'
    else null
  end as abc_cruzado
from enr e
left join rol_categoria_familia rcf on rcf.familia = e.familia;

grant select on v_matriz_surtido to anon, authenticated, service_role;
