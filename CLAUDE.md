# CLAUDE.md — PIM Joyerías Te Quiero

Este archivo define el contexto completo del proyecto. Léelo íntegro antes de cada sesión.

---

## Qué es este proyecto

Un PIM (Product Information Manager) ligero para el equipo de producto de una cadena de joyerías con 17 tiendas en Canarias. Agrega datos de Shopify y Metabase (solo lectura), permite enriquecer fichas con campos propios del equipo, y genera exports a Google Sheets y un catálogo público para tiendas.

**No es** un ecommerce. **No es** un backoffice de Shopify. Es una fuente de verdad interna para el equipo de producto.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 con App Router |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Sin autenticación — aplicación interna, acceso libre por URL |
| Hosting | Vercel (free tier) |
| Estilos | Tailwind CSS |
| Gráficos | Recharts (compatible con Next.js, sin config adicional) |
| Fuentes externas | Shopify Admin API + CSV público de Metabase |
| Exports | Google Sheets API v4 via Service Account |
| AI | Anthropic API (`claude-haiku-4-5` para generación, `claude-sonnet-4-6` para chat) |

---

## Estructura de carpetas esperada

```
/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                  ← Dashboard home
│   │   ├── products/
│   │   │   ├── page.tsx              ← Lista de productos
│   │   │   └── [codigo_modelo]/
│   │   │       └── page.tsx          ← Ficha de producto
│   │   ├── export/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   ├── sync/page.tsx
│   │   │   ├── fields/page.tsx
│   │   │   └── pricing/page.tsx
│   │   ├── analytics/
│   │   │   ├── surtido/page.tsx
│   │   │   ├── precio/page.tsx
│   │   │   ├── ciclo-vida/page.tsx
│   │   │   ├── rentabilidad/page.tsx
│   │   │   └── stock/page.tsx
│   │   └── help/page.tsx
│   ├── catalog/
│   │   └── page.tsx                  ← PÚBLICO, sin auth
│   └── api/
│       ├── sync/
│       │   ├── metabase/route.ts
│       │   ├── shopify/route.ts
│       │   └── run/route.ts          ← Endpoint cron
│       ├── export/
│       │   └── sheets/route.ts
│       ├── ai/
│       │   ├── generate-content/route.ts
│       │   └── chat/route.ts
│       └── mcp/                      ← Endpoints para el MCP server
│           ├── product/[id]/route.ts
│           ├── search/route.ts
│           ├── pending/route.ts
│           ├── summary/route.ts
│           └── sync-status/route.ts
├── components/
│   ├── ui/
│   │   ├── KpiCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── SyncIndicator.tsx
│   │   ├── FeatureCard.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── PageHeader.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Toast.tsx
│   │   └── AnalyticsFilters.tsx     ← Filtros globales del módulo analítico
│   ├── products/
│   ├── export/
│   ├── analytics/                   ← Gráficos reutilizables (Recharts wrappers)
│   └── catalog/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── shopify.ts
│   ├── metabase.ts
│   ├── google-sheets.ts
│   └── anthropic.ts
├── types/
│   └── index.ts                      ← Todos los tipos TypeScript
├── CLAUDE.md                         ← Este archivo
└── .env.local                        ← Nunca commitear
```

---

## Variables de entorno

Todas deben estar en `.env.local` (local) y en Vercel Dashboard → Settings → Environment Variables (producción).

```env
# Supabase (sin auth de usuarios)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Metabase
METABASE_CSV_URL=

# Shopify
SHOPIFY_SHOP_DOMAIN=            # formato: mi-tienda.myshopify.com (sin https://)
SHOPIFY_ACCESS_TOKEN=

# Google
GOOGLE_SERVICE_ACCOUNT_KEY=     # JSON completo en base64
GOOGLE_DRIVE_FOLDER_ID=

# Anthropic
ANTHROPIC_API_KEY=

# Seguridad
CRON_SECRET=                    # string aleatorio largo, protege el endpoint del cron
MCP_SERVICE_TOKEN=              # token para autenticar el MCP server contra esta app
```

**Regla crítica:** `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `ANTHROPIC_API_KEY` y `MCP_SERVICE_TOKEN` son secretos de servidor. Nunca deben aparecer en código cliente ni en variables con prefijo `NEXT_PUBLIC_`.

---

## Modelo de datos (Supabase)

### Tablas principales

**`products`** — clave primaria: `codigo_modelo` (TEXT, ej: "002AA")
- Campos base: `description`, `category`, `familia`, `metal`, `karat`, `supplier_name`, `primera_entrada`, `num_variantes`, `lista_variantes`, `variante_lider`
- Agregados calculados al hacer sync (de las variantes): `ingresos_modelo_12m`, `abc_ventas`, `abc_unidades`
- Control: `metabase_synced_at`, `shopify_synced_at`, `created_at`, `updated_at`

**`product_variants`** — clave primaria: `codigo_interno` (TEXT, ej: "002AA08") — el SKU real del ERP
- `slug` (TEXT) — igual que `codigo_interno`
- `codigo_modelo` (TEXT) FK → `products`
- `variante` (TEXT) — el valor de la variante (ej: "8", "45", "M")
- `es_variante_lider` (BOOLEAN)
- Precios: `precio_venta`, `precio_tachado`, `descuento_aplicado`
- Costes: `cost_price_medio`, `ultimo_coste_compra`, `ultimo_precio_venta`
- Rentabilidad: `margen_bruto`, `pct_margen_bruto`
- Ventas: `abc_ventas`, `abc_unidades`, `ingresos_slug_12m`, `ingresos_variante_lider_12m`, `unidades_mes_anterior`
- Stock: `stock_variante`
- Distribución: `num_tiendas_activo`
- Control: `metabase_synced_at`, `updated_at`

**`product_shopify_data`** — FK: `codigo_modelo`
- `shopify_product_id`, `shopify_title`, `shopify_description` (HTML), `shopify_tags` (array), `shopify_seo_title`, `shopify_seo_desc`, `shopify_status`, `shopify_handle`, `shopify_vendor`, `synced_at`

**`product_images`** — FK: `codigo_modelo`
- `id` (UUID), `url`, `source` (s3|shopify|manual), `variante`, `alt_text`, `orden`, `is_primary`, `created_at`

**`product_custom_fields`** — FK: `codigo_modelo`
- `id` (UUID), `field_key`, `field_value`, `field_type` (text|textarea|date|boolean|select), `updated_by` (email), `updated_at`

**`custom_field_definitions`**
- `id` (UUID), `field_key` (UNIQUE), `label`, `field_type`, `options` (array), `is_active`, `created_at`

**`sync_log`**
- `id` (UUID), `source` (metabase|shopify), `status` (success|error), `records_updated`, `error_message`, `triggered_by` (cron|manual|email), `started_at`, `finished_at`

**`pricing_rules`** — reglas de category management para sugerencia de precios IA
- `id` (UUID), `familia` (TEXT), `metal` (TEXT), `karat` (TEXT), `margen_objetivo_pct` (NUMERIC), `redondeo` (text|99|00), `descuento_minimo_pct` (NUMERIC), `updated_by` (email), `updated_at`

### Campos adicionales en `products` para analítica avanzada
Añadir cuando estén disponibles en Metabase (no bloquean el arranque del proyecto):
- `cost_ultima_compra` NUMERIC — coste de la última orden de compra
- `fecha_ultima_venta` DATE — fecha de la última transacción
- `unidades_mes_anterior` INTEGER — unidades vendidas el mes anterior
- `num_tiendas_activo` INTEGER — número de tiendas donde está disponible

### RLS (Row Level Security)
- Usar el cliente `anon` de Supabase para todas las queries de la app (sin auth de usuario)
- RLS desactivado o con política de lectura libre para todas las tablas excepto escrituras sensibles
- Las escrituras (sync, campos custom, pricing rules) se hacen desde API routes del servidor usando `SUPABASE_SERVICE_ROLE_KEY` — nunca desde el cliente
- El catálogo público nunca selecciona campos financieros (ver regla 4)

---

## Rutas y autenticación

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | 🌐 Libre | Dashboard home |
| `/products` | 🌐 Libre | Lista de productos |
| `/products/[codigo_modelo]` | 🌐 Libre | Ficha de producto |
| `/export` | 🌐 Libre | Generador de exports |
| `/settings/sync` | 🌐 Libre | Panel de sincronización |
| `/settings/fields` | 🌐 Libre | Gestión de campos custom |
| `/settings/pricing` | 🌐 Libre | Reglas de pricing por category management |
| `/analytics/surtido` | 🌐 Libre | Analítica: amplitud, profundidad, Pareto |
| `/analytics/precio` | 🌐 Libre | Analítica: mapas de precio, márgenes, descuentos |
| `/analytics/ciclo-vida` | 🌐 Libre | Analítica: ciclo de vida, renovación, anomalías |
| `/analytics/rentabilidad` | 🌐 Libre | Analítica: BCG, contribución por familia/metal/proveedor |
| `/analytics/stock` | 🌐 Libre | Analítica: cobertura, rotación, capital inmovilizado |
| `/help` | 🌐 Libre | Manual de usuario |
| `/catalog` | 🌐 Libre | Catálogo para equipos de tienda |
| `/api/sync/run` | 🔑 CRON_SECRET | Endpoint del cron de Vercel |
| `/api/sync/metabase` | 🔑 CRON_SECRET | Sync manual Metabase |
| `/api/sync/shopify` | 🔑 CRON_SECRET | Sync manual Shopify |
| `/api/mcp/*` | 🔑 MCP_SERVICE_TOKEN | Endpoints para el MCP server |

Sin autenticación de usuario. Los únicos endpoints protegidos son los de sync y MCP (via header `x-api-key`).

---

## Integraciones externas

### Metabase CSV
- Descarga el CSV desde `METABASE_CSV_URL`
- El CSV es a nivel de **variante** — 788 filas (una por SKU), 440 modelos únicos
- Columnas exactas: `slug, codigo_modelo, codigo_interno, variante, description, category, familia, metal, karat, supplier_name, primera_entrada_catalogo, image_url, imagen_formula_excel, num_variantes, lista_variantes, variante_lider, es_variante_lider, ingresos_variante_lider_12m, stock_variante, precio_venta, precio_tachado, descuento_aplicado, cost_price_medio, ultimo_coste_compra, ultimo_precio_venta, margen_bruto, pct_margen_bruto, abc_ventas, abc_unidades, ingresos_modelo_12m, unidades_modelo_12m, ingresos_slug_12m, unidades_mes_anterior, num_tiendas_activo`
- **Atención:** los números usan formato europeo (coma decimal, punto miles) — ej: "162.010,03". Parsear con `parseFloat(value.replace(/\./g, '').replace(',', '.'))`
- Lógica de sync en dos pasos:
  1. UPSERT en `products` usando `codigo_modelo` como clave (campos del modelo + imagen de la variante líder)
  2. UPSERT en `product_variants` usando `codigo_interno` como clave
- Guardar `image_url` en `product_images` con `source='s3'` e `is_primary=true` solo para la variante líder (`es_variante_lider = true`)

### Shopify Admin API
- Endpoint base: `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01`
- Autenticación: header `X-Shopify-Access-Token: ${SHOPIFY_ACCESS_TOKEN}`
- Paginar todos los productos con `GET /products.json?limit=250`
- **Matching con el PIM:** usar el SKU del variant de Shopify para hacer match directo contra `codigo_interno` en `product_variants` (ej: SKU "002AA08" → `codigo_interno` "002AA08"). El `codigo_modelo` se obtiene del campo homónimo en `product_variants`.
- Guardar en `product_shopify_data` + imágenes en `product_images` con `source='shopify'`
- **No traer:** inventory/stock (viene de Metabase)

### Google Sheets export
- Usar Google Service Account (decodificar `GOOGLE_SERVICE_ACCOUNT_KEY` desde base64)
- Crear un nuevo Spreadsheet en la carpeta `GOOGLE_DRIVE_FOLDER_ID`
- Nombre: `Catálogo TQ Export - ${fecha}`
- Compartir automáticamente con "anyone with link can view"
- Columnas de imagen: usar fórmula `=IMAGE("url")` — esto hace visible la foto en Sheets
- Cabeceras en negrita, primera fila fija (freeze)
- Devolver la URL del Sheet creado para redirigir al usuario

### Cron job (Vercel)
```json
// vercel.json
{
  "crons": [{
    "path": "/api/sync/run",
    "schedule": "0 5 * * *"
  }]
}
```
Ejecuta a las 05:00 UTC (06:00-07:00 hora Canarias según época del año).

---

## Integración con Claude AI

### Nivel 1 — Generación de contenido y sugerencia de precios (`/api/ai/generate-content`)
- Modelo: `claude-haiku-4-5` para texto; `claude-sonnet-4-6` para sugerencia de precio
- Tipos de generación: `shopify_description`, `seo_title`, `tags`, `catalog_description`, `price_suggestion`
- El prompt incluye los datos del producto + instrucciones de marca TQ Jewels
- Para `price_suggestion`: incluir también las reglas de pricing de `/settings/pricing` + datos financieros del producto. Respuesta en JSON estricto: `{ precio_venta_sugerido, precio_tachado_sugerido, margen_resultante, razonamiento, alertas }`
- Los precios sugeridos se guardan como campos custom (`precio_sugerido_ia`, `precio_tachado_sugerido_ia`) — nunca sobreescriben datos de Metabase
- Nueva ruta en scope: `/settings/pricing` — reglas de pricing configurables por familia/metal/karat

### Nivel 2 — Chat analítico (`/api/ai/chat`)
- Modelo: `claude-sonnet-4-6`
- Contexto inyectado dinámicamente según el tipo de pregunta detectada
- Máximo ~8.000 tokens de contexto por consulta
- No persiste historial entre sesiones
- No escribe en la BD — solo responde

---

## Componentes UI obligatorios

Construir estos componentes en `components/ui/` antes de empezar las páginas. Todas las páginas deben usarlos — no reinventar en cada vista.

| Componente | Props clave |
|---|---|
| `KpiCard` | `label`, `value`, `sub`, `color` (blue\|green\|amber\|red\|neutral) |
| `StatusBadge` | `status` (ok\|warn\|error\|info\|shopify\|imagen) |
| `SyncIndicator` | `lastSync: Date`, `status` |
| `FeatureCard` | `icon`, `name`, `description`, `href` |
| `ActivityFeed` | `items: ActivityItem[]` |
| `PageHeader` | `title`, `subtitle`, `actions?: ReactNode` |
| `EmptyState` | `icon`, `message`, `cta?: { label, href }` |
| `Toast` | Global, via contexto. Variantes: success\|error\|info |

---

## Paleta de colores (provisional hasta recibir manual de marca)

```css
--color-accent:       #C8842A   /* Dorado — acento corporativo */
--color-accent-light: #FDF3E4   /* Fondo suave dorado */
--color-accent-text:  #8B5E1A   /* Texto sobre fondo dorado */
--status-ok:          #3A9E6A
--status-warn:        #C8842A
--status-error:       #C0392B
--status-info:        #2A5F9E
```

Cuando el cliente entregue el manual de marca oficial, reemplazar estos valores con los hex corporativos de TQ Jewels sin cambiar los nombres de las variables.

---

## Reglas de desarrollo

1. **TypeScript estricto** — sin `any`. Todos los tipos en `types/index.ts`.
2. **Server Components por defecto** — usar Client Components (`'use client'`) solo cuando sea imprescindible (interactividad, hooks de estado).
3. **Datos financieros: solo lectura** — los campos de margen, coste y ventas nunca tienen formulario de edición. Se muestran, nunca se modifican desde la UI.
4. **`/catalog` nunca expone datos financieros** — la query de Supabase para el catálogo no debe seleccionar: `cost_price_medio`, `ultimo_coste_compra`, `margen_bruto`, `pct_margen_bruto`, `ingresos_modelo_12m`, `abc_ventas`, `abc_unidades`.
5b. **Sin middleware de auth** — no usar `middleware.ts` para proteger rutas de usuario. La app es completamente abierta salvo los endpoints de API protegidos con `CRON_SECRET` y `MCP_SERVICE_TOKEN`.
5. **Imágenes como URL, nunca upload** — no hay funcionalidad de subida de archivos. Las imágenes se añaden pegando una URL.
6. **Un rol único** — no hay sistema de permisos granular. Todos los usuarios autenticados tienen los mismos permisos.
7. **Errores visibles** — cualquier error de sync, de API o de guardado debe aparecer en la UI con un mensaje claro. No silenciar errores con `catch(() => {})`.
8. **Mobile-first solo en `/catalog`** — el resto de la app es desktop-first.
9. **Recharts siempre con ResponsiveContainer** — todos los gráficos deben adaptarse al ancho del contenedor. Nunca fijar width en píxeles en un gráfico Recharts.
10. **Redondear todos los números mostrados** — sin decimales flotantes de JS. Usar `toFixed(1)` para porcentajes, `toLocaleString('es-ES')` para euros, `Math.round()` para enteros.
11. **Módulo analítico: datos calculados en servidor** — las queries de agregación (sumas, medias, conteos por grupo) se hacen en Supabase con RPC o vistas, no en el cliente con arrays de JS. Esto evita transferir los 440 productos al cliente para cada gráfico.
12. **`/analytics` nunca expone costes a usuarios no autorizados** — los campos `cost_price_ponderado`, `cost_ultima_compra` solo se usan en cálculos server-side. No incluirlos en respuestas de API que puedan ser interceptadas.

---

## Orden de construcción recomendado

Seguir este orden. No saltar fases.

```
── BLOQUE 1: FUNDAMENTOS ──────────────────────────────────────────
Sesión 1  → Setup Next.js 14 + Supabase + Tailwind (sin auth de usuario)
             Verificar: página de inicio carga · conexión a Supabase funciona

Sesión 2  → Esquema BD completo en Supabase + tipos TypeScript + componentes UI base
             (KpiCard, StatusBadge, PageHeader, EmptyState, Toast, AnalyticsFilters)
             Verificar: tablas visibles en Supabase · página /test con todos los componentes

── BLOQUE 2: DATOS ────────────────────────────────────────────────
Sesión 3  → Sync Metabase CSV → tabla products + panel /settings/sync
             Verificar: 440 productos en Supabase tras ejecutar sync manual

Sesión 4  → Sync Shopify → product_shopify_data + product_images
             Verificar: fichas enriquecidas con datos de Shopify visibles en Supabase

── BLOQUE 3: PRODUCTO CORE ────────────────────────────────────────
Sesión 5  → Lista de productos /products con filtros funcionales
             Verificar: filtrar por metal=Oro devuelve solo productos de Oro

Sesión 6  → Ficha de producto /products/[codigo_modelo] — las 5 secciones/tabs
             Verificar: ficha de "002AA" muestra datos de las 3 fuentes correctamente

Sesión 7  → Campos custom: /settings/fields + edición inline en ficha
             Verificar: crear campo "Campaña activa" y rellenarlo en una ficha

Sesión 8  → Reglas de pricing /settings/pricing
             Verificar: guardar márgenes objetivo por familia y recuperarlos

── BLOQUE 4: OUTPUTS ──────────────────────────────────────────────
Sesión 9  → Dashboard home / con KPIs reales + widgets analíticos básicos + alertas
             Verificar: los KPIs cuadran con los datos reales de Supabase

Sesión 10 → Export a Google Sheets /export
             Verificar: Sheet generado con imágenes visibles (fórmula IMAGE)

Sesión 11 → Catálogo público /catalog (responsive, mobile-first)
             Verificar: accesible sin login · se ve bien en móvil · sin datos financieros

── BLOQUE 5: ANALÍTICA ────────────────────────────────────────────
Sesión 12 → /analytics/surtido + /analytics/precio
             Verificar: Pareto real · scatter amplitud/profundidad · margen vs objetivo

Sesión 13 → /analytics/ciclo-vida + /analytics/rentabilidad + /analytics/stock
             Verificar: mapa de ciclo de vida · tabla anomalías · alertas de stock

── BLOQUE 6: IA ───────────────────────────────────────────────────
Sesión 14 → Claude AI Nivel 1: generación de contenido (haiku)
             Verificar: botón "Generar descripción" devuelve texto real de Anthropic

Sesión 15 → Claude AI Nivel 1: sugerencia de precio (sonnet) + Nivel 2: chat analítico
             Verificar: panel de precio con razonamiento · chat responde sobre el catálogo

── BLOQUE 7: EXTENSIONES ──────────────────────────────────────────
Sesión 16 → MCP Server (proyecto separado en Vercel)
             Verificar: conectado desde Cowork · responde preguntas sobre el catálogo

Sesión 17 → Manual de usuario /help + polish + bugs + deploy final
             Verificar: manual accesible · deploy en Vercel · cron configurado
```

---

## Cómo iniciar cada sesión

Empieza siempre con este bloque (adaptando lo que ya esté hecho):

```
Contexto: PIM Joyerías Te Quiero. Stack: Next.js 14 + Supabase + Tailwind + Vercel.
Lee el CLAUDE.md antes de empezar.

Sesiones completadas: [ej: 1, 2, 3]
Lo que ya funciona: [ej: auth magic link · 440 productos en BD · lista con filtros]
Objetivo hoy: Sesión X — [nombre de la sesión]
Primer paso: [acción concreta, ej: "crear la API route /api/sync/shopify"]
```

**Regla de oro entre sesiones:**
1. Termina la sesión → prueba en el navegador que funciona
2. `git add . && git commit -m "Sesión X: [qué hiciste]" && git push`
3. Siguiente sesión → `git pull` si cambias de PC → arranca con el bloque de contexto de arriba

---

*Generado en sesión de discovery — abril 2026. v1.2: sin autenticación de usuario · modelo de datos a nivel de variante · matching Shopify por codigo_interno · campos definitivos de Metabase · módulo analítico. Actualizar si cambia el stack, el esquema o las reglas de desarrollo.*
