# 📋 PRD — PIM Joyerías Te Quiero
**Proyecto:** Lightweight PIM (Product Information Manager)  
**Cliente:** Joyerías Te Quiero · Departamento de Producto  
**Versión:** 1.1 · Discovery + UI spec completados abril 2026  
**Destinatario:** Claude Code

---

## 1. Contexto y problema a resolver

El equipo de producto de una cadena de joyerías con 17 tiendas en Canarias gestiona actualmente ~440 modelos de producto (≈800 SKUs con variantes) repartidos entre hojas de cálculo, Shopify y consultas de Power BI / Metabase. No existe una fuente de verdad única para la información de producto.

**Consecuencias del problema actual:**
- La información está fragmentada: datos comerciales en ERP/Metabase, datos de tienda en Shopify, anotaciones de equipo en Excel
- Solo el área de operaciones puede actualizar fichas; el resto del equipo de producto no tiene canal de input
- Generar un listado para la agencia o marketing requiere trabajo manual cada vez
- El catálogo para equipos de tienda no tiene una versión centralizada y siempre actualizada

**Solución:** Una aplicación web interna que actúe como PIM ligero — agrega datos de Shopify y Metabase (solo lectura), permite al equipo enriquecer fichas con campos propios, y genera outputs (catálogo para tienda, exports a Google Sheets).

---

## 2. Stack tecnológico recomendado

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend + Backend | **Next.js 14** (App Router) | Full-stack, óptimo para Vercel |
| Base de datos | **Supabase** (free tier) | PostgreSQL gestionado, Auth incluido, free tier suficiente |
| Hosting | **Vercel** (free tier) | Deploy automático desde GitHub, sin servidor propio |
| Auth | Sin autenticación de usuario | App interna, acceso libre por URL |
| Fuentes externas | Shopify Admin API + URL pública CSV de Metabase | Solo lectura |
| Exports | Google Sheets API (v4) | Genera Sheets nuevos en Drive con imágenes |
| Estilos | **Tailwind CSS** | Rápido, consistente, buen soporte en Vercel |

**Requisito:** Todo en free tier. Sin coste de infraestructura.

---

## 3. Modelo de datos

### 3.1 Tabla `products` (almacenada en Supabase)
Campos que provienen de Metabase CSV o son gestionados por el PIM:

```
codigo_modelo         TEXT PRIMARY KEY   -- Ej: "002AA"
description           TEXT               -- Nombre del modelo (de la variante líder)
category              TEXT               -- CLASSIC | NEW | OUTLET | TO_BE_DISCONTINUED
familia               TEXT               -- Colgantes, Pendientes, Anillos, etc.
metal                 TEXT               -- Oro | Plata
karat                 TEXT               -- AU18 | AU9 | AG926
supplier_name         TEXT
primera_entrada       TIMESTAMP
num_variantes         INTEGER
lista_variantes       TEXT               -- "08, 10, 12, 14..." (string CSV)
variante_lider        TEXT
-- Agregados del modelo (calculados al sync desde product_variants)
ingresos_modelo_12m   NUMERIC            -- suma de ingresos de todas las variantes
unidades_modelo_12m   INTEGER
abc_ventas            TEXT               -- A | B | C (del modelo)
abc_unidades          TEXT
-- Control de sync
metabase_synced_at    TIMESTAMP
shopify_synced_at     TIMESTAMP
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()
```

### 3.1b Tabla `product_variants` (nueva — nivel SKU)
Datos a nivel de variante individual. Clave de matching con Shopify y ERP.

```
codigo_interno        TEXT PRIMARY KEY   -- SKU del ERP, ej: "002AA08"
slug                  TEXT               -- igual que codigo_interno
codigo_modelo         TEXT REFERENCES products(codigo_modelo)
variante              TEXT               -- valor de la variante, ej: "8", "45", "M"
es_variante_lider     BOOLEAN
-- Precios (de Metabase, solo lectura)
precio_venta          NUMERIC
precio_tachado        NUMERIC
descuento_aplicado    NUMERIC
-- Costes (de Metabase, solo lectura)
cost_price_medio      NUMERIC
ultimo_coste_compra   NUMERIC
ultimo_precio_venta   NUMERIC
-- Rentabilidad (de Metabase, solo lectura)
margen_bruto          NUMERIC
pct_margen_bruto      NUMERIC
-- Ventas y distribución (de Metabase, solo lectura)
abc_ventas            TEXT
abc_unidades          TEXT
ingresos_slug_12m     NUMERIC
ingresos_variante_lider_12m NUMERIC
unidades_mes_anterior INTEGER
stock_variante        INTEGER
num_tiendas_activo    INTEGER
-- Control
metabase_synced_at    TIMESTAMP
updated_at            TIMESTAMP DEFAULT NOW()
```

### 3.2 Tabla `product_shopify_data` (datos leídos de Shopify)
```
codigo_modelo         TEXT REFERENCES products(codigo_modelo)
shopify_product_id    TEXT
shopify_title         TEXT
shopify_description   TEXT               -- HTML
shopify_tags          TEXT[]             -- Array de tags
shopify_seo_title     TEXT
shopify_seo_desc      TEXT
shopify_status        TEXT               -- active | draft | archived
shopify_handle        TEXT
shopify_vendor        TEXT
synced_at             TIMESTAMP
```

### 3.3 Tabla `product_images`
```
id                    UUID PRIMARY KEY
codigo_modelo         TEXT REFERENCES products(codigo_modelo)
url                   TEXT NOT NULL
source                TEXT               -- "s3" | "shopify" | "manual"
variante              TEXT               -- NULL si es imagen del modelo general
alt_text              TEXT
orden                 INTEGER            -- Para ordenar las imágenes
is_primary            BOOLEAN DEFAULT FALSE
created_at            TIMESTAMP
```

### 3.4 Tabla `product_custom_fields` (campos propios del equipo)
```
id                    UUID PRIMARY KEY
codigo_modelo         TEXT REFERENCES products(codigo_modelo)
field_key             TEXT               -- Ej: "campana_activa", "anotacion"
field_value           TEXT
field_type            TEXT               -- "text" | "textarea" | "date" | "boolean" | "select"
created_at            TIMESTAMP
updated_at            TIMESTAMP
updated_by            TEXT               -- email del usuario
```

### 3.5 Tabla `custom_field_definitions` (definición de campos custom)
```
id                    UUID PRIMARY KEY
field_key             TEXT UNIQUE
label                 TEXT               -- Nombre visible en UI
field_type            TEXT
options               TEXT[]             -- Para tipo "select"
is_active             BOOLEAN DEFAULT TRUE
created_at            TIMESTAMP
```

### 3.6 Tabla `sync_log`
```
id                    UUID PRIMARY KEY
source                TEXT               -- "metabase" | "shopify"
status                TEXT               -- "success" | "error"
records_updated       INTEGER
error_message         TEXT
triggered_by          TEXT               -- "cron" | "manual" | email usuario
started_at            TIMESTAMP
finished_at           TIMESTAMP
```

---

## 4. Integraciones externas

### 4.1 Metabase (CSV público)
- **Tipo:** URL pública que devuelve un CSV (no acceso libre)
- **Frecuencia:** 1 vez al día (cron job) + botón manual en UI
- **Estructura del CSV:** nivel de variante — 788 filas (una por SKU), 440 modelos únicos
- **Campos exactos del CSV:** `slug, codigo_modelo, codigo_interno, variante, description, category, familia, metal, karat, supplier_name, primera_entrada_catalogo, image_url, imagen_formula_excel, num_variantes, lista_variantes, variante_lider, es_variante_lider, ingresos_variante_lider_12m, stock_variante, precio_venta, precio_tachado, descuento_aplicado, cost_price_medio, ultimo_coste_compra, ultimo_precio_venta, margen_bruto, pct_margen_bruto, abc_ventas, abc_unidades, ingresos_modelo_12m, unidades_modelo_12m, ingresos_slug_12m, unidades_mes_anterior, num_tiendas_activo`
- **Atención formato numérico:** los números usan formato europeo (coma decimal, punto miles). Parsear con `parseFloat(value.replace(/\./g, '').replace(',', '.'))`
- **Lógica de sync en dos pasos:**
  1. Descargar y parsear el CSV
  2. UPSERT en `product_variants` usando `codigo_interno` como clave
  3. UPSERT en `products` usando `codigo_modelo` como clave — tomar description, category, familia, metal, karat, supplier_name, primera_entrada de la variante líder (`es_variante_lider = true`)
  4. Guardar `image_url` en `product_images` con `source='s3'` e `is_primary=true` solo para la variante líder
  5. Registrar resultado en `sync_log`
- **Variable de entorno:** `METABASE_CSV_URL`

### 4.2 Shopify Admin API
- **Auth:** Access Token (variable de entorno `SHOPIFY_ACCESS_TOKEN` + `SHOPIFY_SHOP_DOMAIN`)
- **Frecuencia:** 1 vez al día (cron job) + botón manual en UI
- **Datos a traer:** title, body_html, tags, handle, status, vendor, metafields SEO (seo_title, seo_description), images
- **Datos a NO traer:** inventory/stock (viene de Metabase/ERP)
- **Matching:** El matching se hace por SKU directo. El SKU del variant de Shopify coincide exactamente con `codigo_interno` en `product_variants` (ej: SKU "002AA08" → `codigo_interno` "002AA08"). Sin necesidad de extraer prefijos.
- **Lógica de sync:**
  1. Paginar todos los productos de Shopify (REST API o GraphQL)
  2. Para cada producto, extraer codigo_modelo del primer variant SKU
  3. UPSERT en `product_shopify_data`
  4. Guardar imágenes en `product_images` con source="shopify"
  5. Registrar en `sync_log`

### 4.3 Cron Job (sync diario)
- Usar **Vercel Cron Jobs** (disponible en free tier, máximo 1 ejecución/día)
- Configurar en `vercel.json` para ejecutar a las 6:00 AM (hora Canarias = UTC+1 en invierno, UTC+2 en verano — usar 05:00 UTC como base segura)
- Endpoint: `POST /api/sync/run` protegido con `CRON_SECRET`

---

## 5. Funcionalidades de la aplicación

### 5.1 Autenticación
- Login con **magic link por email** (Supabase Auth) — sin contraseñas
- Un único rol: **Product Team** — acceso total a lectura y escritura de campos propios
- La ruta `/catalog` (catálogo para tienda) es **pública** — no requiere login
- El resto de rutas requieren autenticación
- Lista de emails autorizados gestionada por el admin (Supabase dashboard o tabla `allowed_users`)

### 5.2 Vista: Lista de productos (`/products`)
**Funcionalidades:**
- Tabla paginada con todos los productos (25 por página)
- Columnas visibles por defecto: imagen principal, codigo_modelo, descripción, familia, metal, karat, category, ABC ventas, precio venta medio
- **Filtros laterales o superiores:**
  - Metal (Oro / Plata)
  - Karat (AU18 / AU9 / AG926)
  - Familia (multiselect)
  - Category (multiselect)
  - ABC ventas (A / B / C)
  - Proveedor (multiselect)
  - Búsqueda por texto libre (busca en codigo_modelo y description)
- Toggle de columnas visibles
- Indicador visual de última sincronización (Metabase y Shopify por separado)

### 5.3 Vista: Ficha de producto (`/products/[codigo_modelo]`)
Ficha completa organizada en **pestañas o secciones**:

**Sección 1 — Información base** (de Metabase, solo lectura)
- codigo_modelo, descripción, familia, metal, karat, category
- Proveedor, fecha primera entrada catálogo
- Variantes: número, lista, variante líder

**Sección 2 — Datos comerciales** (de Metabase, solo lectura)
- Precio venta medio, precio tachado, descuento %
- Coste ponderado, margen bruto €, margen bruto %
- ABC ventas y unidades
- Ingresos 12m, unidades 12m
- Stock total
- Mostrar en cards visuales, no en tabla plana

**Sección 3 — Datos Shopify** (de Shopify, solo lectura)
- Título Shopify, descripción HTML (renderizada)
- Tags, handle, status, vendor
- SEO title y SEO description
- Enlace directo al producto en Shopify admin

**Sección 4 — Imágenes y assets**
- Grid de imágenes del producto
- Imágenes agrupadas por: modelo general / variante
- Botón para añadir imagen (introduce URL manualmente — no upload de archivo)
- Indicar fuente (S3, Shopify, manual)
- Marcar imagen principal
- Ordenar imágenes (drag or up/down arrows)
- Eliminar imagen manual (no puede eliminar las sincronizadas de Shopify)

**Sección 5 — Campos del equipo** (editables)
- Mostrar todos los campos custom definidos para este producto
- Editor inline: click para editar, guardar con botón o blur
- Botón "Añadir campo" → desplegable con campos definidos en la configuración
- Historial simple: mostrar quién editó y cuándo (último update)

### 5.4 Vista: Configuración de campos custom (`/settings/fields`)
- Lista de campos custom definidos (label, tipo, opciones si es select)
- Botón "Crear campo" → formulario:
  - Label (nombre visible)
  - Tipo: texto corto / texto largo / fecha / sí/no / lista de opciones
  - Si es lista: definir opciones
- Activar / desactivar campo (no borrar, para no perder datos)
- **Ejemplos de campos que el equipo querrá crear:** "Campaña activa", "Anotaciones internas", "Lanzamiento previsto", "Colección", "Estado fotografía", "Aprobado para catálogo"

### 5.5 Vista: Sincronización (`/settings/sync`)
- Estado de última sincronización de cada fuente (Metabase, Shopify) con timestamp
- Botón "Sincronizar ahora" para cada fuente por separado
- Botón "Sincronizar todo"
- Log de las últimas 20 sincronizaciones (fuente, estado, registros actualizados, duración, quién lo lanzó)
- Indicador visual de si el cron está activo

### 5.6 Export a Google Sheets (`/export`)
**Flujo de uso:**
1. El usuario selecciona qué productos exportar (todos, o filtrando igual que en la lista)
2. Selecciona qué campos incluir en el export (checklist organizado por sección)
3. Pulsa "Generar Google Sheet"
4. La app crea un Google Sheet nuevo en el Drive configurado
5. El Sheet incluye:
   - Columna de imagen usando fórmula `=IMAGE("url")` para los campos de imagen
   - Formato básico: cabeceras en negrita, primera fila fija
   - Nombre del fichero: `Catálogo TQ Export - {fecha}`
6. Se redirige al usuario directamente al Sheet creado (nueva pestaña)

**Requisitos técnicos:**
- Google Service Account con acceso a Drive (variable de entorno: `GOOGLE_SERVICE_ACCOUNT_KEY`)
- La carpeta de destino en Drive es configurable (`GOOGLE_DRIVE_FOLDER_ID`)
- El Sheet se comparte automáticamente con "cualquiera con el enlace puede ver"

**Campos exportables disponibles:**
- De identificación: codigo_modelo, descripción, familia, metal, karat, category, proveedor
- De variantes: num_variantes, lista_variantes, variante_lider
- De precio: precio_venta_medio, precio_tachado_medio, descuento_medio
- De margen: coste ponderado, margen bruto €, %
- De ventas: ABC, ingresos 12m, unidades 12m, stock
- De Shopify: título, descripción, tags, SEO title
- Imágenes: URL imagen principal, fórmula IMAGE imagen principal
- Campos custom: cualquiera de los definidos por el equipo

### 5.7 Catálogo público para tiendas (`/catalog`)
- **Ruta pública** — sin login
- URL compartible (ej: `tudominio.vercel.app/catalog`)
- Diseño limpio orientado a consulta rápida
- Filtros: familia, metal, category, búsqueda por texto
- Vista de producto: imagen, nombre, codigo_modelo, familia, metal, variantes disponibles, precio de venta
- **NO muestra:** datos financieros (costes, márgenes, ABC, ingresos)
- Indicador de "Actualizado: hace X horas" (fecha último sync)
- Responsive — funciona bien en móvil (el personal de tienda puede consultarlo desde el teléfono)
- NO tiene botón de exportar ni de editar

### 5.8 Dashboard home (`/`)
Pantalla de inicio tras login:
- Resumen rápido: total productos, productos NEW, productos OUTLET, productos TO_BE_DISCONTINUED
- Estado de sincronizaciones (última vez sync Metabase + Shopify)
- Accesos directos a: Lista productos, Export, Catálogo tienda, Configuración
- Últimas modificaciones del equipo (actividad reciente en campos custom)

---

## 6. Navegación y estructura de rutas

```
/                          → Dashboard (acceso libre)
/products                  → Lista de productos (acceso libre)
/products/[codigo_modelo]  → Ficha de producto (acceso libre)
/export                    → Generador de exports (acceso libre)
/catalog                   → Catálogo para tiendas (PÚBLICO)
/settings/fields           → Gestión de campos custom (acceso libre)
/settings/sync             → Panel de sincronización (acceso libre)
/login                     → No existe — sin login
/api/sync/metabase         → Endpoint sync Metabase (protegido con secret)
/api/sync/shopify          → Endpoint sync Shopify (protegido con secret)
/api/sync/run              → Endpoint cron diario (protegido con CRON_SECRET)
/api/export/sheets         → Endpoint generación Google Sheets
```

---

## 7. Variables de entorno necesarias

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Metabase
METABASE_CSV_URL=               # URL pública del CSV en Metabase

# Shopify
SHOPIFY_SHOP_DOMAIN=            # ej: mi-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=           # Admin API token

# Google
GOOGLE_SERVICE_ACCOUNT_KEY=     # JSON completo de la service account (en base64 o como JSON string)
GOOGLE_DRIVE_FOLDER_ID=         # ID de la carpeta de Drive donde se crearán los Sheets

# Seguridad
CRON_SECRET=                    # Secret para proteger el endpoint del cron job
```

---

## 8. Diseño y UX

### 8.1 Principios generales

- **Estética:** Profesional, limpio, orientado a datos. Referencia visual: Notion + Linear. Paleta neutra con acento dorado/champagne corporativo extraído del manual de marca de TQ Jewels.
- **Manual de marca:** El cliente entregará un ZIP con logo (SVG/PNG), paleta hex oficial y tipografías. Claude Code debe aplicar los colores y el logo de TQ Jewels en la interfaz. El acento principal es dorado/champagne; los colores de estado (error, warning, ok) pueden ser estándar.
- **Tipografía:** Sin serifa, moderna y legible para entornos de datos. Usar la tipografía del manual de marca si se proporciona; si no, usar una sans-serif con personalidad (no Inter, no Roboto).
- **Responsive:** La app de gestión (autenticada) es desktop-first — las pantallas de producto y dashboard son complejas. El catálogo `/catalog` debe ser completamente responsive y funcionar bien en móvil, ya que el personal de tienda lo consulta desde el teléfono.
- **Estados vacíos:** Mensajes claros cuando no hay datos, cuando el sync no se ha ejecutado nunca, o cuando un filtro no devuelve resultados.
- **Feedback:** Toasts/notificaciones para todas las acciones con resultado (guardado exitoso, sync completado, export generado, error).
- **Carga:** Skeleton loaders para vistas de datos. Sin spinners genéricos.

### 8.2 Layout global (app autenticada)

La aplicación tiene un layout de **dos columnas fijas**:

- **Sidebar izquierdo** (220px, fijo): logo TQ Jewels arriba, navegación principal en el centro, información del usuario logado abajo. No colapsa en desktop.
- **Área principal** (resto del ancho): scrollable, con padding generoso. Cada página define su propio header interior con título y acciones contextuales.

**Sidebar — secciones y orden:**
```
[Logo TQ Jewels + subtítulo "Product Manager"]
─── Principal ───
  · Inicio           → /
  · Productos        → /products
  · Exportar         → /export
  · Catálogo tienda  → /catalog  (abre en nueva pestaña)
─── Configuración ───
  · Sincronización   → /settings/sync
  · Campos del equipo → /settings/fields
  · Manual de uso    → /help
─── (pie) ───
  [Avatar inicial + Nombre + Rol]
```

### 8.3 Dashboard home (`/`) — especificación detallada

Esta es la pantalla de inicio tras el login. Debe comunicar el estado del sistema de un vistazo y dar acceso rápido a los flujos más frecuentes.

**Header de la página:**
- Saludo personalizado con nombre del usuario: "Buenos días, [nombre]"
- Subtítulo con fecha actual y estado de datos: "Hoy es [fecha] · Los datos están al día" (o "· Revisar errores" si hay fallos)
- Botón/badge en la esquina derecha: indicador de última sincronización con punto de color (verde = ok, amarillo = hace más de 24h, rojo = error) y texto "Última sincronización: hoy HH:MM · Sincronizar ahora"

**Fila de KPIs (5 tarjetas en grid horizontal):**

| Tarjeta | Valor | Subtexto |
|---|---|---|
| Referencias totales | Nº total de `codigo_modelo` en BD | "≈ {n} SKUs con variantes" |
| Productos nuevos | Nº con `category = 'NEW'` | "Añadidos este mes" (filtro por `primera_entrada` del mes en curso) |
| Fichas incompletas | Nº de productos sin descripción Shopify O sin imagen | "Sin descripción o imagen" |
| Errores de carga | Nº de entradas en `sync_log` con `status = 'error'` en últimas 24h | "Ver detalle →" (enlace a /settings/sync) |
| Última actualización | Hora del último sync exitoso | "Hoy · Metabase + Shopify" o la fecha si fue ayer |

Estilo de las KPI cards: fondo secundario, sin borde, número grande (26px/500), label en mayúsculas pequeñas. Colores del valor: azul para totales neutros, verde para positivos, ámbar para pendientes, rojo para errores.

**Sección "Accesos rápidos" (4 tarjetas en grid 2x2 o 1x4):**

Cada tarjeta tiene: icono con fondo de color suave, nombre en negrita, descripción corta de una línea. Al hacer click navegan a la ruta correspondiente.

| Tarjeta | Icono | Descripción |
|---|---|---|
| Lista de productos | Icono lista (azul) | "Busca, filtra y consulta el catálogo completo" |
| Exportar a Sheets | Icono documento (verde) | "Genera un Google Sheet para agencia o marketing" |
| Catálogo tienda | Icono círculo/joya (dorado) | "Vista pública para el equipo de tienda" |
| Campos del equipo | Icono cuadrícula (morado) | "Crea campos propios: campañas, notas, estados" |

**Panel inferior izquierdo — "Fichas con pendientes":**
- Lista de hasta 5 productos con algún campo incompleto
- Por cada fila: `codigo_modelo` en negrita, descripción del problema, badge de color con el tipo (Shopify / Imagen / Error)
- Enlace "Ver todas →" que lleva a `/products` con filtro de incompletas activo
- Colores de badges: azul para pendientes de Shopify, ámbar para imágenes, rojo para errores de sync

**Panel inferior derecho — "Actividad reciente del equipo":**
- Lista de hasta 5 entradas de actividad reciente (últimas ediciones de campos custom + últimos syncs)
- Por cada fila: avatar con iniciales del usuario, texto descriptivo de la acción, timestamp relativo ("hace 2h", "ayer")
- El sync automático aparece como una entrada del sistema: "Sync automático completado · 440 productos · 0 errores"
- Enlace "Ver historial →"

### 8.4 Paleta de colores de la interfaz

Hasta recibir el manual de marca oficial, usar esta paleta provisional inspirada en joyería:

```css
--color-accent-gold:        #C8842A   /* Dorado principal — acento corporativo */
--color-accent-gold-light:  #FDF3E4   /* Fondo suave dorado */
--color-accent-gold-text:   #8B5E1A   /* Texto sobre fondo dorado */
--color-status-ok:          #3A9E6A   /* Verde — sync ok, estado correcto */
--color-status-warn:        #C8842A   /* Ámbar — pendientes, advertencias */
--color-status-error:       #C0392B   /* Rojo — errores, crítico */
--color-status-info:        #2A5F9E   /* Azul — información, Shopify */
```

Cuando se entregue el manual de marca, reemplazar `--color-accent-gold` y derivados con los valores hex oficiales de TQ Jewels.

### 8.5 Componentes reutilizables requeridos

Claude Code debe construir y usar consistentemente estos componentes en toda la app:

- `<KpiCard>` — tarjeta de métrica con label, valor, subtexto y color de valor
- `<StatusBadge>` — pill de estado con variantes: ok / warn / error / info / shopify / imagen
- `<SyncIndicator>` — punto de color + texto de última sincronización
- `<FeatureCard>` — tarjeta de acceso rápido con icono, nombre y descripción
- `<ActivityFeed>` — lista de actividad con avatar, texto y timestamp
- `<PageHeader>` — título de página + subtítulo + slot para acciones derechas
- `<EmptyState>` — pantalla vacía con icono, mensaje y CTA opcional
- `<Toast>` — notificación temporal (success / error / info)

---

## 9. Manual de usuario (requisito de entrega)

El proyecto debe incluir un manual de usuario en formato Markdown o web estática accesible desde la propia app (ruta `/help`).

**El manual debe:**
- Estar escrito en español
- Usar lenguaje no técnico — orientado a usuarios sin perfil developer
- Incluir capturas de pantalla o mockups de cada sección (al menos descripciones visuales detalladas si no hay capturas)
- Organizarse por casos de uso, no por funcionalidades técnicas

**Secciones del manual:**

1. **Primeros pasos** — Cómo acceder, qué es el magic link, qué ver nada más entrar
2. **Buscar y filtrar productos** — Cómo usar los filtros, cómo buscar por referencia
3. **Entender una ficha de producto** — Qué significa cada sección, de dónde vienen los datos
4. **Añadir información del equipo** — Cómo editar campos propios, cómo crear campos nuevos
5. **Gestionar imágenes** — Cómo añadir URLs de imagen, cómo ordenarlas
6. **Sincronizar datos** — Qué hace el botón de sync, cuándo usarlo, qué pasa si hay un error
7. **Exportar a Google Sheets** — Paso a paso para generar un export para la agencia o marketing
8. **El catálogo de tienda** — Cómo compartir el enlace, qué ve el personal de tienda
9. **Crear campos personalizados** — Cómo añadir campos como "Campaña activa" o "Anotaciones"
10. **Preguntas frecuentes** — Los 10 escenarios más probables de confusión

---

## 10. Criterios de aceptación (MVP)

El proyecto se considera funcional cuando:

- [ ] La página de inicio carga correctamente sin login
- [ ] La sincronización con Metabase CSV funciona y popula la lista de productos
- [ ] La sincronización con Shopify funciona y enriquece las fichas
- [ ] El cron diario está configurado en Vercel
- [ ] Se pueden crear campos custom y rellenarlos en las fichas
- [ ] Se pueden añadir imágenes (por URL) a un producto
- [ ] El export a Google Sheets genera un fichero accesible con imágenes visibles
- [ ] El catálogo `/catalog` es accesible sin login y muestra productos con filtros
- [ ] El manual de usuario está disponible en `/help`
- [ ] Todo desplegado en Vercel y Supabase en free tier

---

## 11. Integración con Claude AI

### 11.1 Nivel 1 — Generación de contenido por producto (incluido en v1)

**Qué hace:** Claude lee los datos de una ficha y genera o mejora contenido y sugerencias analíticas: descripción para Shopify, título SEO, tags, descripción para catálogo de tienda y sugerencia de precio de venta basada en la estrategia de category management. El usuario acepta, edita o descarta la propuesta — nunca se guarda sin confirmación.

**Dónde aparece en la UI:** Botones "✨ Generar con IA" dentro de la ficha de producto, en la Sección 3 (Datos Shopify), Sección 2 (Datos comerciales) y Sección 5 (Campos del equipo). Específicamente:
- "Generar descripción Shopify" → produce un `body_html` listo para copiar a Shopify
- "Generar título SEO" → propuesta de título optimizado
- "Sugerir tags" → lista de tags relevantes basada en familia, metal, karat y descripción
- "Generar descripción para catálogo" → versión corta orientada al personal de tienda
- "Sugerir precio" → propuesta de precio de venta y precio tachado basada en la estrategia de category management (ver detalle abajo)

**Funcionalidad: Sugerencia de precio (category management)**

Esta es la funcionalidad más estratégica del Nivel 1. Claude aplica la lógica de pricing del equipo de forma consistente a cada referencia.

Contexto que recibe Claude para esta función:
- Datos del producto: `familia`, `metal`, `karat`, `category`, `supplier_name`
- Datos financieros: `cost_price_ponderado` (coste promediado), coste de última compra (cuando esté disponible en Metabase), `precio_venta_medio` actual, `precio_tachado_medio` actual, `pct_margen_bruto` actual
- Datos de ventas: `abc_ventas`, `abc_unidades`, `ingresos_12m`
- Reglas de pricing definidas por el equipo (ver abajo)

**Reglas de pricing configurables** — editables desde `/settings/pricing` (añadir esta ruta al scope):
- Margen objetivo mínimo por familia (ej: Alianzas Oro AU18 → 55%, Cadenas Plata → 45%...)
- Posicionamiento de marca: "precio más asequible del mercado canario"
- Redondeo de precios (ej: siempre terminar en .99 o en .00)
- Diferencial mínimo precio venta / precio tachado (ej: mínimo 15% de descuento aparente)
- Tratamiento por ABC: productos A mantienen precio, productos C pueden tener margen reducido para rotar stock

Respuesta de Claude para esta función (JSON estructurado que la UI renderiza):
```json
{
  "precio_venta_sugerido": 149.99,
  "precio_tachado_sugerido": 179.99,
  "margen_resultante": 52.3,
  "razonamiento": "Basado en coste de 69.50€ y margen objetivo del 52% para Cadenas Plata. Precio tachado con 16.7% de descuento aparente. Producto ABC-B, mantener posicionamiento competitivo.",
  "alertas": ["El margen actual (48%) está por debajo del objetivo (52%)"]
}
```

La UI muestra el razonamiento de Claude junto con la propuesta — el equipo entiende por qué se sugiere ese precio, no solo el número. Si el usuario acepta, el precio sugerido se guarda como campo custom (`precio_sugerido_ia`, `precio_tachado_sugerido_ia`) — nunca sobreescribe los datos de Metabase.

**Nueva ruta añadida al scope:** `/settings/pricing` — formulario para configurar las reglas de pricing por familia/metal/karat. Acceso libre.

**Implementación técnica:**
- API route: `POST /api/ai/generate-content`
- Modelo: `claude-haiku-4-5` para contenido de texto; `claude-sonnet-4-6` para sugerencia de precio (requiere más razonamiento numérico)
- El prompt incluye los datos del producto + las reglas de pricing activas + instrucciones de marca
- Para sugerencia de precio: el prompt instruye a responder únicamente en JSON válido (sin texto adicional)
- Variable de entorno: `ANTHROPIC_API_KEY`
- La respuesta se muestra en un panel editable — el usuario debe guardar explícitamente

**Coste estimado:**
- Generación de texto (haiku): ~800 tokens → < €0,001 por producto
- Sugerencia de precio (sonnet): ~1.500 tokens → ~€0,005 por producto
- Uso mensual del equipo (~50 generaciones mixtas): < €0,20/mes

### 11.2 Nivel 2 — Chat analítico sobre el catálogo (incluido en v1)

**Qué hace:** Un panel de chat integrado en el dashboard donde el equipo puede hacer preguntas en lenguaje natural sobre el catálogo. Claude recibe como contexto los datos relevantes y responde con análisis, listas o textos listos para usar. No escribe en la base de datos — solo responde.

**Ejemplos de uso real:**
- *"¿Qué productos de Oro AU18 no tienen descripción en Shopify?"*
- *"Lista los 10 productos con peor margen que siguen en estado CLASSIC"*
- *"Redacta un email para la agencia con los productos nuevos de esta temporada"*
- *"¿Cuántos productos de Plata tenemos sin imagen?"*

**Dónde aparece en la UI:** Panel de chat colapsable en el dashboard home (`/`), accesible también desde `/products` como sidebar derecho. Historial de conversación durante la sesión (no persiste entre sesiones).

**Implementación técnica:**
- API route: `POST /api/ai/chat`
- Modelo: `claude-sonnet-4-6` (mejor razonamiento sobre datos)
- Contexto inyectado según la pregunta detectada:
  - Preguntas sobre conteos/filtros → resumen agregado del catálogo (no todos los registros)
  - Preguntas sobre productos específicos → fichas completas de los productos mencionados
  - Preguntas sobre generación de texto → datos relevantes + instrucciones de marca
- Contexto máximo por consulta: ~8.000 tokens (suficiente para ~80 fichas resumidas)
- Variable de entorno: `ANTHROPIC_API_KEY` (la misma que Nivel 1)

**Coste estimado:**
- Por consulta: ~5.000-10.000 tokens → €0,05-0,10
- Uso mensual estimado (20 consultas): €1-3/mes

### 11.3 Nivel 3 — Claude como agente (fuera de alcance v1, propuesto para v2)

Claude ejecutaría acciones reales en la app (actualizar campos, lanzar syncs, generar exports) a través de un sistema de tools. Requiere rediseño parcial de la arquitectura. Estimado 2+ semanas adicionales de desarrollo y €3-10/mes de uso. Pospuesto a v2.

### 11.4 Variable de entorno adicional

```env
# Claude AI
ANTHROPIC_API_KEY=              # API key de Anthropic (console.anthropic.com)
```

---

## 12. MCP Server para Cowork (módulo paralelo opcional)

### 12.1 Qué es y para qué sirve

Un servidor MCP (Model Context Protocol) que expone los datos y acciones del PIM como herramientas que Claude puede usar desde Cowork o desde Claude.ai directamente. Una vez conectado, desde Cowork se puede preguntar: *"¿Cuántos productos tenemos sin imagen esta semana?"* y Claude consultará el PIM en tiempo real.

### 12.2 Herramientas que expone el MCP

```
get_product(codigo_modelo)
  → Devuelve la ficha completa de un producto (todos los campos, imágenes, campos custom)

search_products(filtros)
  → Filtra el catálogo por metal, familia, category, karat, abc, proveedor
  → Devuelve lista paginada con campos clave

get_pending_products()
  → Lista de productos con fichas incompletas (sin imagen, sin descripción Shopify, con errores)

get_catalog_summary()
  → Resumen estadístico: totales por familia, metal, category, ABC, errores de sync

get_sync_status()
  → Estado y timestamp de la última sincronización de Metabase y Shopify

update_custom_field(codigo_modelo, field_key, field_value)
  → Actualiza un campo custom de un producto (requiere confirmación del usuario en Cowork)
```

### 12.3 Implementación técnica

- Servidor Node.js independiente que implementa el protocolo MCP sobre HTTP/SSE
- Desplegable en Vercel como proyecto separado (free tier)
- Se autentica contra la API del PIM usando un token de servicio (`MCP_SERVICE_TOKEN`)
- El PIM expone endpoints internos dedicados: `GET /api/mcp/product/[id]`, `GET /api/mcp/search`, etc.
- Una vez desplegado, el usuario añade la URL del MCP server en los conectores de Cowork

### 12.4 Coste

- Desarrollo: 2-3 días adicionales sobre el proyecto base
- Infraestructura: €0 en free tier de Vercel
- Uso: sin coste adicional — el MCP solo mueve datos; las llamadas a Claude las gestiona la suscripción existente de Cowork

### 12.5 Variable de entorno adicional (MCP server)

```env
MCP_SERVICE_TOKEN=              # Token que usa el MCP para autenticarse contra el PIM
```

### 12.6 Criterios de aceptación del módulo MCP

- [ ] Las 6 herramientas responden correctamente desde un cliente MCP de prueba
- [ ] Se puede conectar desde Cowork y Claude responde preguntas sobre el catálogo en tiempo real
- [ ] La herramienta `update_custom_field` requiere confirmación explícita antes de escribir
- [ ] El servidor está desplegado en Vercel con URL pública documentada

---


## 16. Módulo analítico de Category Management (`/analytics`)

### 16.1 Descripción general

Módulo propio con 5 sub-vistas de análisis estratégico del catálogo. Todos los gráficos son interactivos, filtrables y exportables a Google Sheets con el mismo mecanismo de la sección `/export`. Los datos provienen exclusivamente de Supabase — no requiere llamadas adicionales a Metabase o Shopify en tiempo real.

**Entrada en sidebar:**
```
─── Analítica ───
  · Surtido          → /analytics/surtido
  · Precio           → /analytics/precio
  · Ciclo de vida    → /analytics/ciclo-vida
  · Rentabilidad     → /analytics/rentabilidad
  · Stock            → /analytics/stock
```

**Filtros globales del módulo** (persisten entre sub-vistas dentro de la sesión):
- Familia (multiselect)
- Metal (Oro / Plata)
- Karat (multiselect)
- Proveedor (multiselect)
- Category (multiselect)
- ABC ventas (A / B / C)

**Todos los gráficos:** usar librería Recharts (compatible con Next.js, sin dependencias adicionales). Colores usando la paleta corporativa dorada + colores de estado definidos en sección 8.4.

---

### 16.2 Dashboard home — widgets analíticos ampliados

El dashboard home (`/`) incorpora los siguientes widgets además de los KPIs y paneles existentes (sección 8.3):

**Fila KPIs — ampliar con 2 métricas nuevas:**
- Ratio NEW / TO_BE_DISCONTINUED (número decimal, verde si > 1, rojo si < 1)
- Cobertura stock ABC-A (% de productos ABC-A con stock_total > 0, rojo si < 90%)

**Fila widgets analíticos (grid 2x2):**

| Widget | Tipo | Datos |
|---|---|---|
| Distribución ABC | Donut chart | Conteo de productos por abc_ventas (A/B/C) con % y €ingresos_12m |
| Ingresos 12m por familia | Barras horizontales | suma(ingresos_12m) agrupado por familia, ordenado desc |
| Fichas incompletas por tipo | Barras horizontales | Sin imagen / Sin desc Shopify / Sin SEO / Sin tags |
| Alertas críticas | Lista | ABC-A con stock_total < 5 unidades (configurable) |

**Fila alertas (cards de color):**
- Productos ABC-A sin stock: número en rojo + lista en hover
- Capital inmovilizado en ABC-C: sum(stock_total × cost_price_ponderado) de productos ABC-C
- Productos activos sin ventas 12m: count de unidades_12m = 0 con stock > 0

---

### 16.3 Sub-vista: Surtido (`/analytics/surtido`)

**Métricas y visualizaciones:**

**Amplitud vs profundidad por familia**
- Scatter plot: eje X = num_modelos por familia, eje Y = num_variantes_medio por modelo
- Cada punto es una familia, tamaño del punto = ingresos_12m
- Cuadrantes: Amplio+Profundo (ok), Amplio+Plano (fragmentado), Estrecho+Profundo (concentrado), Estrecho+Plano (subdesarrollado)

**Curva de Pareto del catálogo**
- Línea acumulada de % de ingresos vs % de productos ordenados por ingresos desc
- Marcar el punto donde se alcanza el 80% de ingresos
- Número destacado: "X productos generan el 80% de los ingresos"

**Distribución de referencias por proveedor**
- Barras apiladas: num_modelos por proveedor, coloreadas por category
- Ordenado por total de referencias desc

**Tabla: modelos con más variantes sin rendimiento**
- Productos con num_variantes > 5 y abc_ventas = C
- Columnas: codigo_modelo, descripción, familia, num_variantes, ingresos_12m, stock_total

---

### 16.4 Sub-vista: Precio (`/analytics/precio`)

**Métricas y visualizaciones:**

**Mapa de precios por familia**
- Box plot o range chart por familia: mínimo, percentil 25, mediana, percentil 75, máximo de precio_venta_medio
- Detecta visualmente familias con dispersión de precio excesiva o sin cobertura en algún rango

**Price ladder por familia** (selector de familia)
- Histograma de distribución de precios en rangos configurables (ej: 0-50, 50-100, 100-200, 200-500, 500+)
- Identifica huecos de precio dentro de una familia

**Coherencia de descuentos**
- Scatter: eje X = descuento_medio, eje Y = pct_margen_bruto, coloreado por abc_ventas
- Cuadrante peligroso: descuento alto + margen bajo = productos en riesgo de pérdida

**Margen promedio vs objetivo por familia**
- Barras horizontales con el pct_margen_bruto promedio por familia
- Línea de referencia en el margen objetivo (extraído de `/settings/pricing`)
- Color rojo si está por debajo del objetivo, verde si lo supera

**Tabla: productos con margen por debajo del objetivo**
- Productos donde pct_margen_bruto < margen_objetivo de su familia (según /settings/pricing)
- Columnas: codigo_modelo, familia, metal, precio_venta_medio, cost_price_ponderado, pct_margen_bruto, objetivo, diferencia
- Botón "Sugerir precio con IA" en cada fila (llama al Nivel 1 de Claude)

---

### 16.5 Sub-vista: Ciclo de vida (`/analytics/ciclo-vida`)

**Métricas y visualizaciones:**

**Mapa de ciclo de vida**
- Matriz: filas = category (NEW / CLASSIC / OUTLET / TO_BE_DISCONTINUED), columnas = abc_ventas (A / B / C)
- Cada celda muestra count de productos y sum(ingresos_12m)
- Las celdas con combinaciones "anómalas" resaltadas: ABC-A en OUTLET, ABC-A en TO_BE_DISCONTINUED, NEW en ABC-C

**Antigüedad del catálogo**
- Histograma de productos por año de primera_entrada_catalogo
- Coloreado por category actual
- Permite ver si el catálogo está envejeciendo o renovándose

**Tasa de renovación**
- Tarjeta con tres métricas: entradas nuevas este año (NEW), salidas previstas (TO_BE_DISCONTINUED), ratio
- Gráfico de línea histórico si hay datos de años anteriores

**Tiempo medio en estado NEW** (aproximado)
- Para productos que ya son CLASSIC, calcular diferencia entre primera_entrada y fecha actual como proxy
- Distribución por familia: qué familias "maduran" más rápido

**Tabla: anomalías de ciclo de vida**
- ABC-A marcados como TO_BE_DISCONTINUED: requieren revisión urgente
- NEW con más de 6 meses sin alcanzar ABC-A o B: posibles fallos de lanzamiento
- CLASSIC con > 3 años sin ventas últimos 12m: zombies del catálogo

---

### 16.6 Sub-vista: Rentabilidad (`/analytics/rentabilidad`)

**Métricas y visualizaciones:**

**Contribución marginal por familia**
- Barras apiladas: suma margen_bruto por familia
- Comparativa con % de referencias que representa esa familia sobre el total
- Revela familias que tienen muchas referencias pero poca contribución real

**Contribución marginal por metal y karat**
- Treemap o barras agrupadas: Oro AU18 / Oro AU9 / Plata AG926
- Métricas: ingresos_12m, margen_bruto total, pct_margen_bruto promedio

**Análisis por proveedor**
- Tabla ordenable: proveedor, num_referencias, pct_abc_a (% de sus productos que son ABC-A), margen_bruto_total, pct_margen_bruto_promedio
- Identifica proveedores estratégicos vs proveedores con bajo rendimiento

**Matriz BCG adaptada**
- Scatter plot: eje X = % ingresos del modelo sobre su familia (cuota relativa), eje Y = pct_margen_bruto
- Tamaño de burbuja = stock_total × cost_price_ponderado (capital inmovilizado)
- Coloreado por abc_ventas
- Cuadrantes: Stars (cuota alta + margen alto), Cash Cows (cuota alta + margen medio), Question Marks (cuota baja + margen alto), Dogs (cuota baja + margen bajo)

---

### 16.7 Sub-vista: Stock (`/analytics/stock`)

**Métricas y visualizaciones:**

**Cobertura de stock por segmento ABC**
- Tres KPI cards: % ABC-A con stock > 0, % ABC-B con stock > 0, % ABC-C con stock > 0
- Umbral de alerta configurable (por defecto: ABC-A < 90% → rojo)

**Índice de rotación por familia**
- Barras: unidades_12m / stock_total por familia (rotación anual)
- Ordenado de mayor a menor rotación
- Identifica familias con stock sobredimensionado vs familias con riesgo de rotura

**Capital inmovilizado por segmento**
- Donut: sum(stock_total × cost_price_ponderado) agrupado por abc_ventas
- El segmento ABC-C en rojo — es capital parado en productos que no venden

**Mapa de calor stock × ventas**
- Grid: filas = familias, columnas = rangos de stock (0, 1-5, 6-20, 20+)
- Coloreado por ingresos_12m promedio
- Revela dónde hay desajuste entre stock disponible y demanda

**Tabla: acciones prioritarias de stock**
Tres secciones dentro de la misma tabla con tabs:
- "Roturas de riesgo": ABC-A con stock_total < 5
- "Stock muerto": unidades_12m = 0 con stock_total > 0, ordenado por valor inmovilizado desc
- "Sobrestock": stock_total > (unidades_12m × 2) en productos ABC-C

---

### 16.8 Campos adicionales en Metabase necesarios para el módulo

Para activar el 100% de las funcionalidades analíticas, añadir estas columnas a la consulta de Metabase antes de arrancar el desarrollo:

| Campo | Descripción | Impacto |
|---|---|---|
| `cost_ultima_compra` | Coste de la última orden de compra | Sub-vista Precio: detectar erosión de márgenes |
| `fecha_ultima_venta` | Fecha de la última transacción del modelo | Sub-vista Stock: productos zombies |
| `unidades_mes_anterior` | Unidades vendidas el mes anterior | Sub-vista Ciclo de vida: tendencia aceleración/freno |
| `num_tiendas_activo` | Número de tiendas donde el modelo está disponible | Sub-vista Surtido: distribución del modelo |

Sin estos campos el módulo funciona, pero con ellos se habilitan análisis de tendencia y distribución que de otra forma no son posibles.

---

### 16.9 Criterios de aceptación del módulo analítico

- [ ] Las 5 sub-vistas cargan correctamente con datos reales de Supabase
- [ ] Los filtros globales afectan a todos los gráficos de la sub-vista activa
- [ ] Todos los gráficos son exportables a Google Sheets con un clic
- [ ] El dashboard home muestra los 4 widgets analíticos y las 3 alertas nuevas
- [ ] La tabla de anomalías de ciclo de vida identifica correctamente los productos en combinaciones anómalas
- [ ] La tabla de rentabilidad por proveedor está ordenable por todas las columnas
- [ ] Las alertas críticas de stock usan el umbral configurable (no hardcodeado)

---

## 13. Fuera de alcance (v1)

Los siguientes elementos quedan fuera de la versión 1 para mantener el scope controlado:

- ❌ Escritura/push de datos a Shopify o Metabase
- ❌ Subida directa de archivos (upload) — imágenes solo por URL
- ❌ Múltiples roles o permisos granulares
- ❌ App móvil nativa
- ❌ Conexión directa a ERP
- ❌ Generación de PDFs de catálogo
- ❌ Workflow de aprobación de fichas (propuesto para v2)
- ❌ Historial de cambios completo (propuesto para v2)
- ❌ Importación masiva de campos custom desde Excel

---

## 14. Consideraciones de seguridad

- Las rutas `/api/sync/*` deben validar el header `x-cron-secret` contra `CRON_SECRET`
- El `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor (nunca en cliente)
- Las credenciales de Google Service Account nunca se exponen al cliente
- El Shopify Access Token solo se usa en API routes del servidor
- Row Level Security (RLS) de Supabase activado en todas las tablas
- La ruta `/catalog` no expone datos financieros bajo ningún concepto

---

## 15. Datos de ejemplo para desarrollo

El archivo `consulta_para_aplicacion_claude.xlsx` contiene 440 registros reales del catálogo (anonimizados para desarrollo si se considera necesario). Usar como seed data para la tabla `products` y validar que la UI renderiza correctamente con datos reales.

Campos del CSV de Metabase que se deben mapear exactamente:
`codigo_modelo, description, category, familia, metal, karat, supplier_name, primera_entrada_catalogo, image_url, num_variantes, lista_variantes, variante_lider, ingresos_variante_lider_12m, stock_total, precio_venta_medio, precio_tachado_medio, descuento_medio, cost_price_ponderado, margen_bruto, pct_margen_bruto, abc_ventas, abc_unidades, ingresos_12m, unidades_12m`

---

*Documento generado tras sesión de discovery completa con el equipo de producto. Versión 1.5 — abril 2026. Sin autenticación de usuario · modelo de datos a nivel de variante con tabla product_variants · matching Shopify por codigo_interno · campos definitivos de Metabase · módulo analítico de Category Management.*
