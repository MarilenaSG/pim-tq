# CLAUDE.md — PIM Joyerías Te Quiero

Este archivo define el contexto completo del proyecto. Léelo íntegro antes de cada sesión.

---

## Qué es este proyecto

Un PIM (Product Information Manager) multi-zona para el equipo de una cadena de joyerías con **19 tiendas en Canarias**. Agrega datos de Metabase (solo lectura), permite enriquecer fichas con campos propios del equipo, y tiene módulos diferenciados por perfil de usuario (Category Manager, Ventas, Stock, Tiendas).

**No es** un ecommerce. **No es** un backoffice de Shopify. Es una fuente de verdad interna organizada por zonas funcionales, con integración Shopify para enriquecer fichas y exportar al canal ecommerce.

> **Shopify reintegrado (junio 2026):** la integración con Shopify Admin API fue recuperada. Existe tabla `product_shopify_data`, sync desde Shopify Admin API, tab Shopify en la ficha de producto, y export CSV para importación en Shopify. Los datos de catálogo base siguen viniendo de Metabase (CSV).

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 con App Router |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Sin autenticación — acceso libre por URL |
| Hosting | Vercel (free tier) |
| Estilos | Tailwind CSS |
| Gráficos | Recharts (siempre con `ResponsiveContainer`) |
| Fuentes externas | 3 CSVs de Metabase: productos · ventas mensuales · reservas |
| Exports | PDF via `@react-pdf/renderer` · Excel via `ExcelJS` |
| AI | Anthropic API (`claude-haiku-4-5` generación · `claude-sonnet-4-6` chat/precio) |

> Google Sheets fue eliminado. Los exports son ahora PDF y Excel descargables directamente.

---

## Arquitectura multi-zona

La app está dividida en **4 zonas** accesibles desde `ZoneSidebar`. Cada zona tiene su propio dashboard y navegación lateral contextual.

| Zona | Ruta home | Perfil |
|---|---|---|
| **CM** (Category Management) | `/` | Analítica de surtido, precio, ciclo de vida, rentabilidad |
| **Ventas** | `/ventas` | Sell-out por tienda, análisis de campañas |
| **Stock y Compras** | `/stock` | Cobertura, rotación, alertas de rotura y exceso |
| **Tiendas** | `/tiendas/boletin` | Boletín de novedades y catálogo para equipos de tienda |

La zona activa se guarda en `localStorage` y el `ZoneSidebar` la muestra con navegación secundaria propia.

---

## Concepto crítico: Marca ≠ Proveedor

> **Esta distinción es fundamental. No confundir nunca.**

| Campo | Columna DB | Origen | Significado |
|---|---|---|---|
| **Proveedor** | `products.supplier_name` | Metabase (CSV) | Fabricante/manufacturer del producto |
| **Marca** | `products.shopify_vendor` | Shopify Admin API | Marca que Te Quiero asigna en Shopify |

- Un proveedor puede fabricar productos de varias marcas TQ.
- `supplier_name` viene del sync de Metabase y nunca se edita manualmente.
- `shopify_vendor` viene del sync de Shopify y se propaga a `products` via migración 019.
- En los filtros de la app: "Proveedor" filtra por `supplier_name`, "Marca" filtra por `shopify_vendor`.
- Ambos filtros coexisten en `/products`. En `/analytics` solo existe el filtro Marca (`shopify_vendor`).

---

## Estructura de carpetas real

```
/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                        ← Dashboard CM home
│   │   ├── layout.tsx                      ← ZoneSidebar + ToastProvider
│   │   ├── products/
│   │   │   ├── page.tsx                    ← Lista de productos (global)
│   │   │   ├── ProductsTable.tsx           ← Tabla con .tq-table + checkbox + sort
│   │   │   ├── ProductFilters.tsx          ← Filtros: Marca (shopify_vendor) + Proveedor (supplier_name)
│   │   │   └── [codigo_modelo]/
│   │   │       └── page.tsx                ← Ficha de producto
│   │   ├── campaigns/
│   │   │   └── page.tsx                    ← Gestión de campañas
│   │   ├── alerts/
│   │   │   └── page.tsx                    ← Centro de alertas
│   │   ├── suppliers/
│   │   │   ├── page.tsx                    ← Proveedores (Server Component, agrega datos)
│   │   │   └── SuppliersClient.tsx         ← Tabla + panel lateral + ABC ingresos/rotación
│   │   ├── category/
│   │   │   └── page.tsx                    ← Category manager
│   │   ├── compare/
│   │   │   └── page.tsx                    ← Comparador de productos
│   │   ├── ventas/
│   │   │   ├── page.tsx                    ← Dashboard Ventas
│   │   │   └── sell-out/page.tsx           ← Sell-out por tienda
│   │   ├── stock/
│   │   │   └── page.tsx                    ← Dashboard Stock
│   │   ├── tiendas/
│   │   │   ├── boletin/page.tsx            ← Boletín para tiendas (client, con export Excel)
│   │   │   └── catalogo/page.tsx           ← Catálogo para tiendas
│   │   ├── analytics/
│   │   │   ├── layout.tsx                  ← Layout analítica con tabs + filtro Marca
│   │   │   ├── surtido/page.tsx
│   │   │   ├── precio/page.tsx
│   │   │   ├── price-ladder/page.tsx       ← Escalera de precios
│   │   │   ├── ciclo-vida/page.tsx
│   │   │   ├── rentabilidad/page.tsx
│   │   │   ├── stock/page.tsx              ← Analítica stock (≠ dashboard stock)
│   │   │   └── ventas/page.tsx
│   │   ├── settings/
│   │   │   ├── sync/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   └── alerts/page.tsx
│   │   └── help/page.tsx
│   └── api/
│       ├── sync/
│       │   ├── metabase/route.ts           ← Sync productos CSV
│       │   ├── ventas/route.ts             ← Sync ventas_mensuales CSV
│       │   ├── reservas/route.ts           ← Sync reservas CSV
│       │   └── run/route.ts               ← Cron endpoint
│       ├── ventas/
│       │   ├── summary/route.ts
│       │   └── por-modelo/route.ts
│       ├── stock/
│       │   ├── summary/route.ts
│       │   └── por-modelo/route.ts
│       ├── cm/
│       │   └── summary/route.ts
│       ├── campaigns/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── products/route.ts
│       │       └── export/
│       │           ├── pdf/route.ts
│       │           └── excel/route.ts
│       ├── alerts/
│       │   ├── list/route.ts
│       │   └── summary/route.ts
│       ├── catalog/
│       │   ├── export-pdf/route.ts         ← PDF catálogo tiendas
│       │   └── pedidos-excel/route.ts      ← Plantilla pedido Excel
│       ├── export/
│       │   ├── pdf/route.ts
│       │   ├── excel/route.ts
│       │   └── csv-template/route.ts
│       ├── ai/
│       │   ├── price-suggestion/route.ts
│       │   └── ladder-insights/route.ts
│       ├── boletin/
│       │   ├── route.ts                    ← GET boletín items + POST/DELETE overrides
│       │   └── excel/route.ts              ← Export Excel del boletín para tiendas
│       ├── batch/update/route.ts
│       └── products/
│           ├── filter/route.ts
│           ├── filter-options/route.ts
│           ├── search/route.ts
│           ├── lifecycle/route.ts
│           ├── by-codes/route.ts
│           └── [codigo_modelo]/
│               ├── lifecycle/route.ts
│               └── comments/route.ts
├── components/
│   └── ui/
│       ├── KpiCard.tsx
│       ├── StatusBadge.tsx
│       ├── SyncIndicator.tsx
│       ├── FeatureCard.tsx
│       ├── ActivityFeed.tsx
│       ├── PageHeader.tsx
│       ├── EmptyState.tsx
│       ├── Toast.tsx
│       ├── AnalyticsFilters.tsx
│       ├── FilterSelect.tsx            ← Select reutilizable con estado activo (azul)
│       ├── ZoneSidebar.tsx             ← Barra lateral multi-zona
│       ├── ZoneCardsSection.tsx        ← Cards de acceso rápido por zona
│       ├── ZoneSummaryWidget.tsx       ← Widget de resumen por zona en home
│       ├── SidebarAlertBadge.tsx       ← Badge de alertas en sidebar
│       └── index.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts                  ← createServerClient() + createServiceClient()
│   ├── metabase.ts                    ← Sync productos desde CSV
│   ├── ventas.ts                      ← Sync ventas_mensuales desde CSV
│   ├── reservas.ts                    ← Sync reservas desde CSV
│   ├── shopify.ts                     ← Sync Shopify API → product_shopify_data + products.shopify_vendor
│   ├── alerts.ts                      ← Lógica de alertas (stock crítico, etc.)
│   ├── completitud.ts                 ← Score de completitud de ficha
│   ├── zones.ts                       ← Configuración de zonas (ZONES[])
│   ├── catalog-pdf.tsx                ← Componente PDF catálogo tiendas
│   ├── campaign-pdf.tsx               ← Componente PDF campañas
│   └── pdf-catalog.tsx                ← (legacy, puede consolidarse)
├── types/
│   └── index.ts                       ← Todos los tipos TypeScript
├── supabase/
│   └── migrations/                    ← 19 migraciones (001–019)
├── public/
│   └── brand/
│       ├── icon_cream.png             ← Logo para fondos oscuros (PDF, etc.)
│       └── icon_navy.png              ← Logo para fondos blancos
├── CLAUDE.md
└── .env.local                         ← Nunca commitear
```

---

## Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Metabase — 3 CSVs separados
METABASE_CSV_URL=             # Productos + variantes (≈800 filas, una por SKU)
METABASE_VENTAS_CSV_URL=      # Ventas mensuales por tienda y SKU
METABASE_RESERVAS_CSV_URL=    # Reservas activas

# Anthropic
ANTHROPIC_API_KEY=

# Shopify Admin API
SHOPIFY_SHOP_DOMAIN=          # formato: mi-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=         # token de acceso (o usar OAuth)

# Seguridad
CRON_SECRET=                  # Protege /api/sync/run

# URLs (opcional en local, requerido en Vercel)
NEXT_PUBLIC_APP_URL=          # URL pública de la app
APP_URL=                      # Para callbacks internos
```

**Variables eliminadas:** `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, `MCP_SERVICE_TOKEN`.

**Regla crítica:** `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY` son secretos de servidor. Nunca en código cliente ni en variables `NEXT_PUBLIC_`.

---

## Modelo de datos (Supabase)

### Tablas principales

**`products`** — clave primaria: `codigo_modelo` (TEXT, ej: "002AA")
- `description`, `category`, `familia`, `metal`, `karat`, `supplier_name`
- `shopify_vendor` — Marca Shopify asignada por TQ (añadida en migración 019, backfill desde `product_shopify_data`)
- `primera_entrada`, `num_variantes`, `lista_variantes`, `variante_lider`
- Agregados: `ingresos_12m`, `unidades_12m`, `abc_ventas`, `abc_unidades`
- Estado: `is_discontinued` (AND de todas sus variantes), `lifecycle_status`
- Control: `metabase_synced_at`, `shopify_synced_at`, `created_at`, `updated_at`

**`product_variants`** — clave primaria: `codigo_interno` (TEXT, ej: "002AA08")
- `slug` (= `codigo_interno`), `codigo_modelo` FK, `variante`, `description` ← por variante
- `es_variante_lider`, `is_discontinued`
- Precios: `precio_venta`, `precio_tachado`, `descuento_aplicado`
- Costes: `cost_price_medio`, `ultimo_coste_compra`, `ultimo_precio_venta`
- Rentabilidad: `margen_bruto`, `pct_margen_bruto`
- Ventas: `abc_ventas`, `abc_unidades`, `ingresos_slug_12m`, `ingresos_variante_lider_12m`, `unidades_mes_anterior`
- Stock: `stock_variante`, `num_tiendas_activo`
- Control: `metabase_synced_at`, `updated_at`

> `description` en `product_variants` es la descripción específica de cada SKU (migración 018). Distinto del `description` de `products` que es el del modelo líder.

**`product_shopify_data`** — FK: `codigo_modelo`
- `shopify_product_id`, `shopify_vendor`, `shopify_status` (active|draft|archived)
- `shopify_tags`, `shopify_synced_at`
- Fuente de verdad Shopify por modelo. El campo `shopify_vendor` se copia a `products.shopify_vendor` en cada sync.

**`ventas_mensuales`** — ventas históricas por SKU, tienda y mes
- `slug` (= `codigo_interno`), `codigo_modelo`, `tienda`, `anyo`, `mes`
- `unidades_vendidas`, `ingresos_netos`, `coste_total`
- Clave única: `(slug, tienda, anyo, mes)`

**`product_images`** — FK: `codigo_modelo`
- `id` (UUID), `url`, `source` (s3|manual), `variante`, `alt_text`, `orden`, `is_primary`

**`product_custom_fields`** — FK: `codigo_modelo`
- `field_key`, `field_value`, `field_type` (text|textarea|date|boolean|select), `updated_by`, `updated_at`

**`custom_field_definitions`**
- `field_key` (UNIQUE), `label`, `field_type`, `options` (array), `is_active`

**`pricing_rules`** — reglas de pricing por category management
- `familia`, `metal`, `karat`, `margen_objetivo_pct`, `redondeo` (text|99|00), `descuento_minimo_pct`

**`boletin_overrides`** — overrides manuales de categoría del boletín
- `codigo_modelo`, `categoria` (campaña|nuevo|outlet|retirar), `nota_interna`, `activo`, `expira_en`, `creado_por`

**`sync_log`**
- `source` (metabase|ventas|reservas), `status` (success|error|running), `records_updated`, `error_message`, `triggered_by`, `started_at`, `finished_at`

### Vistas y RPCs
- `product_stock_summary` — vista: stock total por modelo
- RPCs de ventas: `ventas_por_modelo_v2`, otras funciones de agregación

### Migraciones aplicadas
- 001–018: schema base, variantes, imágenes, campañas, alertas, boletin_overrides, variant description
- **019** `019_products_shopify_vendor.sql`: añade `shopify_vendor` a `products` y backfill desde `product_shopify_data`
  - ⚠️ **Pendiente de aplicar en Supabase producción** (SQL Editor). Hasta que se aplique, cualquier query que seleccione `products.shopify_vendor` fallará.
  ```sql
  alter table products add column if not exists shopify_vendor text;
  update products p set shopify_vendor = sd.shopify_vendor
  from product_shopify_data sd
  where sd.codigo_modelo = p.codigo_modelo and sd.shopify_vendor is not null;
  ```

### Umbrales de stock (19 tiendas)
| ABC | Mínimo | Normal | Sobrante |
|---|---|---|---|
| A | < 57 uds → bajo | 57–114 uds | > 114 uds |
| B | < 38 uds → bajo | 38–76 uds | > 76 uds |
| C | < 19 uds → bajo | 19–38 uds | > 38 uds |

`bestAbc()`: toma el más estricto entre `abc_ventas` y `abc_unidades` (protege la plata, que tiene alta rotación por unidades).

---

## Integraciones externas

### Metabase CSV — Productos (`METABASE_CSV_URL`)
- ~800 filas (una por `codigo_interno`/SKU), ~440 modelos únicos
- Formato europeo para números: `"162.010,03"` → parsear con `parseFloat(val.replace(/\./g,'').replace(',','.'))`
- Sync en 3 pasos: UPSERT `products` (desde variante líder) → UPSERT `product_variants` → UPSERT `product_images` (solo líder, `source='s3'`)
- Un modelo es `is_discontinued` solo si **todas** sus variantes lo son (AND lógico)

### Metabase CSV — Ventas (`METABASE_VENTAS_CSV_URL`)
- Columnas: `codigo_interno, tienda_nombre, anyo, mes, unidades_vendidas, ingresos_netos, coste_total`
- UPSERT en `ventas_mensuales` con clave `(slug, tienda, anyo, mes)`
- `slug` = `codigo_interno` en la tabla

### Metabase CSV — Reservas (`METABASE_RESERVAS_CSV_URL`)
- Reservas activas de productos; sync en tabla `reservas`

### Shopify Admin API (`lib/shopify.ts`)
- Sync hacia `product_shopify_data` (shopify_product_id, shopify_vendor, shopify_status, shopify_tags)
- Paso 7 del sync propaga `shopify_vendor` agrupado a `products.shopify_vendor` (en batches de 250)
- Tras el sync de Shopify, los filtros de Marca en la app se rellenan automáticamente

### Exports (sin dependencias externas)
- **PDF catálogo tiendas:** `@react-pdf/renderer`, logo `icon_cream.png` (28px, fondos oscuros), cabecera en todas las páginas, numeración, disclaimer de precios
- **Excel plantilla pedido:** `ExcelJS`, columnas Metal / Familia / Descripción (por variante) / Uds. a pedir
- **Excel boletín tiendas:** `ExcelJS`, secciones por categoría con colores TQ, stock resaltado en rojo para "a retirar"
- **Export CM:** PDF y Excel del módulo de campañas y catálogo general

### Cron job (Vercel)
```json
// vercel.json
{
  "crons": [{ "path": "/api/sync/run", "schedule": "0 5 * * *" }]
}
```
Ejecuta a las 05:00 UTC. El endpoint `run` lanza sync de productos + ventas en secuencia.

---

## Integración con Claude AI

### Sugerencia de precio (`/api/ai/price-suggestion`)
- Modelo: `claude-sonnet-4-6`
- Input: datos del producto + reglas de pricing de la familia
- Output JSON: `{ precio_venta_sugerido, precio_tachado_sugerido, margen_resultante, razonamiento, alertas }`
- Los precios sugeridos se guardan como campos custom — nunca sobreescriben datos de Metabase

### Price Ladder Insights (`/api/ai/ladder-insights`)
- Modelo: `claude-haiku-4-5`
- Analiza la escalera de precios de una familia y detecta huecos o solapamientos

---

## Boletín de Tiendas — lógica de categorización

El boletín (`/tiendas/boletin`) auto-categoriza productos. Orden de prioridad (un producto solo entra en una categoría):

| Categoría | Condición | Color |
|---|---|---|
| **Campaña** | En campaña activa en este momento | Azul `#00557F` |
| **Nuevo** | `primera_entrada` ≤ 60 días | Verde `#3A9E6A` |
| **Outlet** | `descuento_aplicado` ≥ 15% | Ámbar `#C8842A` |
| **A retirar** | `is_discontinued = true` **AND** `stock_total < 20` uds. | Rojo `#C0392B` |

> **Regla "A retirar" (junio 2026):** Un descatalogado solo aparece en el boletín como "a retirar" si además tiene menos de 20 unidades en stock. Con stock alto no urge retirarlo.

Los overrides manuales (tabla `boletin_overrides`) sobreescriben la categoría auto-asignada. Tienen fecha de expiración opcional.

**Export Excel del boletín** (`/api/boletin/excel`): genera un `.xlsx` con secciones por categoría, colores corporativos TQ, stock resaltado en rojo para productos a retirar, y URL de imagen para referencia.

---

## Sistema de UI de tablas

Todas las tablas del proyecto usan las clases definidas en `app/globals.css`:

```
.tq-table-wrap   → contenedor blanco, rounded-xl, shadow-xs, border sutil
.tq-table        → la <table> en sí, font-size 13px
```

**Headers `<th>`:** 10px · font-weight 600 · uppercase · letter-spacing 0.11em · color `#8fa8b8`
- `.right` → text-align right
- `.sortable` → cursor pointer, hover a `var(--tq-snorkel)`
- `.sort-active` → color activo `var(--tq-snorkel)`

**Filas:** padding `9px 14px` · border `rgba(0,85,127,0.05)` · hover `rgba(0,85,127,0.022)`
- `.row-selected` → `rgba(0,153,242,0.045)` (checkboxes)
- `.row-active` → `rgba(0,85,127,0.045)` (panel abierto)

**Tfoot:** fondo `rgba(0,85,127,0.03)` · border-top 1.5px · font 11px bold · color snorkel

**Colores de texto en celdas:**
- Primario: `#00264d`
- Secundario/muted: `#8fa8b8` (NO usar `#b2b2b2`)
- Links/códigos: `#0099f2` (tq-sky)
- Nombres de proveedor: `font-medium` 13px color `#00557f`

**Badges:** `text-[11px] font-semibold px-2 py-0.5 rounded-full`
- ABC-A: bg `rgba(58,158,106,0.12)` color `#2d7a54`
- ABC-B: bg `rgba(0,153,242,0.12)` color `#006da3`
- ABC-C: bg `rgba(200,132,42,0.12)` color `#a06818`

Archivos de referencia: `app/(dashboard)/suppliers/SuppliersClient.tsx` · `app/(dashboard)/products/ProductsTable.tsx`

---

## Rutas y acceso

| Ruta | Zona | Descripción |
|---|---|---|
| `/` | CM | Dashboard Category Management |
| `/products` | Global | Lista de productos con filtros Marca + Proveedor |
| `/products/[codigo_modelo]` | Global | Ficha de producto |
| `/campaigns` | CM/Ventas | Gestión de campañas |
| `/alerts` | CM/Stock | Centro de alertas |
| `/suppliers` | Stock | Análisis de proveedores (eficiencia, surtido, ABC, margen) |
| `/category` | CM | Category manager |
| `/compare` | CM | Comparador de productos |
| `/ventas` | Ventas | Dashboard sell-out |
| `/ventas/sell-out` | Ventas | Sell-out por tienda |
| `/stock` | Stock | Dashboard stock operativo |
| `/tiendas/boletin` | Tiendas | Boletín de novedades (con export Excel) |
| `/tiendas/catalogo` | Tiendas | Catálogo para equipos de tienda |
| `/analytics/surtido` | CM | Amplitud, profundidad, Pareto |
| `/analytics/precio` | CM | Mapas de precio, márgenes, descuentos |
| `/analytics/price-ladder` | CM | Escalera de precios |
| `/analytics/ciclo-vida` | CM | Ciclo de vida, renovación, anomalías |
| `/analytics/rentabilidad` | CM | BCG, contribución por familia/metal |
| `/analytics/stock` | CM | Cobertura, rotación (analítica) |
| `/analytics/ventas` | Ventas | Analítica de ventas |
| `/settings/sync` | CM | Panel de sincronización |
| `/settings/pricing` | CM | Reglas de pricing |
| `/settings/alerts` | CM | Configuración alertas |
| `/help` | Global | Manual de usuario |
| `/api/sync/run` | 🔑 CRON_SECRET | Cron de Vercel |
| `/api/sync/*` | 🔑 CRON_SECRET | Sync manual por fuente |
| `/api/boletin/excel` | Tiendas | Export Excel del boletín |

Sin auth de usuario. Solo los endpoints de sync están protegidos (header `x-api-key: CRON_SECRET`).

---

## Componentes UI

| Componente | Props clave |
|---|---|
| `KpiCard` | `label`, `value`, `sub`, `color` (blue\|green\|amber\|red\|neutral) |
| `StatusBadge` | `status` (ok\|warn\|error\|info) |
| `SyncIndicator` | `lastSync: Date`, `status` |
| `PageHeader` | `title`, `subtitle`, `eyebrow?`, `actions?: ReactNode` |
| `EmptyState` | `icon`, `message`, `cta?: { label, href }` |
| `Toast` | Global via contexto. Variantes: success\|error\|info |
| `FilterSelect` | `placeholder`, `value`, `options: string[]`, `onChange`, `maxWidth?` — select con estado activo en azul |
| `ZoneSidebar` | Navegación lateral. Proveedores está bajo la sección Stock |
| `ZoneCardsSection` | Cards de acceso rápido en home de cada zona |
| `ZoneSummaryWidget` | Widget de KPIs de zona en el dashboard CM |
| `SidebarAlertBadge` | Badge numérico de alertas activas |

---

## Paleta de colores

```css
--tq-snorkel:      #00557f   /* Azul principal */
--tq-sky:          #0099f2   /* Azul acento / links */
--tq-gold:         #c8a164   /* Dorado */
--color-accent:    #C8842A   /* Dorado — acento corporativo */
--status-ok:       #3A9E6A
--status-warn:     #C8842A
--status-error:    #C0392B
--status-info:     #2A5F9E
--tq-bg:           #e8e3df   /* Fondo general (alyssum) */
--tq-shadow-xs:    0 1px 2px rgba(0,32,60,0.06)
--tq-shadow-sm:    0 2px 6px rgba(0,32,60,0.08)
```

---

## Reglas de desarrollo

1. **TypeScript estricto** — sin `any`. Todos los tipos en `types/index.ts`.
2. **Server Components por defecto** — `'use client'` solo cuando hay interactividad/hooks.
3. **Datos financieros: solo lectura** — margen, coste y ventas nunca tienen formulario de edición.
4. **`/tiendas/catalogo` nunca expone datos financieros** — excluir de la query: `cost_price_medio`, `ultimo_coste_compra`, `margen_bruto`, `pct_margen_bruto`, `ingresos_*`, `abc_ventas`, `abc_unidades`.
5. **Sin middleware de auth** — la app es completamente abierta salvo endpoints protegidos por `CRON_SECRET`.
6. **Imágenes como URL, nunca upload** — las imágenes se añaden pegando una URL.
7. **Errores visibles** — cualquier error de sync o guardado debe aparecer en la UI. No silenciar con `catch(() => {})`.
8. **Mobile-first solo en `/tiendas/catalogo`** — el resto es desktop-first.
9. **Recharts siempre con `ResponsiveContainer`** — nunca fijar width en píxeles.
10. **Redondear números** — `toFixed(1)` para %, `toLocaleString('es-ES')` para €, `Math.round()` para enteros.
11. **Agregaciones en servidor** — queries con sumas/medias/conteos se hacen en Supabase con RPC o vistas, no en cliente con arrays de JS.
12. **`/analytics` nunca expone costes en respuestas de API** — `cost_price_medio`, `coste_total` solo en cálculos server-side.
13. **`bestAbc()`** — siempre usar el más estricto entre `abc_ventas` y `abc_unidades` para umbrales de stock.
14. **`createServerClient()`** para lecturas (anon key) · **`createServiceClient()`** para escrituras (service role key). Nunca usar `createAuthServerClient()` — la app no tiene auth de usuario.
15. **Supabase límite 1000 filas** — cuando se fetchen variantes de múltiples modelos, siempre acotar con `.in('codigo_modelo', codes)` para evitar cortes silenciosos.
16. **Marca ≠ Proveedor** — `shopify_vendor` es la Marca TQ; `supplier_name` es el fabricante de Metabase. Nunca mezclarlos. Filtro "Marca" → `shopify_vendor`; filtro "Proveedor" → `supplier_name`.
17. **Tablas: usar siempre `.tq-table-wrap` + `.tq-table`** — nunca inline styles para bordes/hover/sombras de tabla. Ver sección "Sistema de UI de tablas".

---

## Estado actual del proyecto (junio 2026)

### Completado y funcionando
- ✅ Sync Metabase productos (CSV → `products` + `product_variants` + `product_images`)
- ✅ Sync Metabase ventas (CSV → `ventas_mensuales`)
- ✅ Lista de productos con filtros Marca (`shopify_vendor`) y Proveedor (`supplier_name`) separados
- ✅ Ficha de producto (datos Metabase + campos custom + precios + IA)
- ✅ Arquitectura multi-zona con `ZoneSidebar`
- ✅ Zona CM: dashboard + analítica completa (surtido, precio, ciclo vida, rentabilidad, stock, ventas)
- ✅ Zona Ventas: dashboard + sell-out por tienda
- ✅ Zona Stock: dashboard con alertas ABC, donut nivel stock, inventario expandible
- ✅ Zona Tiendas: catálogo (con exports PDF y Excel) + boletín (con export Excel)
- ✅ Campañas: CRUD + export PDF/Excel
- ✅ Alertas: stock crítico, sin ventas, precio anomalía
- ✅ Sugerencia de precio IA + price ladder insights
- ✅ Reglas de pricing por familia/metal/karat
- ✅ Settings de sync con panel de estado
- ✅ Página Proveedores: análisis de eficiencia, ABC por ingresos y por rotación, precio medio, margen
- ✅ Sistema de tabla unificado (`.tq-table` / `.tq-table-wrap`) aplicado en toda la app
- ✅ Boletín: regla "A retirar" = descatalogado AND stock < 20 uds.
- ✅ Boletín: export Excel con secciones por categoría y colores TQ

### Pendiente — acción requerida antes de que funcione Marca
- ⚠️ **Aplicar migración 019 en Supabase SQL Editor** — sin esto, cualquier página que lea `products.shopify_vendor` falla. SQL en `supabase/migrations/019_products_shopify_vendor.sql`
- ⚠️ **Ejecutar sync de Shopify** tras aplicar la migración — para poblar `shopify_vendor` en `products` y que el filtro Marca muestre opciones

### Pendiente — trabajo futuro
- ⏳ `product_variants.description` poblada por variante (migración 018 aplicada; **sync de Metabase pendiente** para rellenar los datos)
- ⏳ Sync de reservas (`METABASE_RESERVAS_CSV_URL` configurada, verificar en producción)
- ⏳ Manual de usuario `/help` — contenido real
- ⏳ Deploy final en Vercel + cron configurado
- ⏳ MCP Server (proyecto separado, no iniciado)

---

## Cómo iniciar cada sesión

```
Contexto: PIM Joyerías Te Quiero. Stack: Next.js 14 + Supabase + Tailwind + Vercel.
Lee el CLAUDE.md antes de empezar.
Rama activa: architecture/multi-zone-redesign (no mergeada a main aún)

Lo que ya funciona: zonas CM/Ventas/Stock/Tiendas · sync Metabase · exports PDF/Excel · IA precio
⚠️ Pendiente crítico: aplicar migración 019 en Supabase para que funcione el filtro Marca

Objetivo hoy: [descripción]
Primer paso: [acción concreta]
```

**Regla de oro entre sesiones:**
1. Prueba en el navegador que funciona
2. `git add . && git commit -m "..." && git push origin architecture/multi-zone-redesign`
3. Cuando esté listo para producción: PR de `architecture/multi-zone-redesign` → `main`

---

*Actualizado junio 2026. v2.2: Marca vs Proveedor (shopify_vendor ≠ supplier_name) · migración 019 products.shopify_vendor · sistema de tabla .tq-table unificado · FilterSelect component · Proveedores en sidebar Stock · regla boletín "a retirar" (descatalogado + stock < 20) · export Excel boletín tiendas.*
