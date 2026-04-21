// ============================================================
// PIM Te Quiero — TypeScript Types
// ============================================================

// ── Products ─────────────────────────────────────────────────

export type AbcRating = 'A' | 'B' | 'C' | null

export interface Product {
  codigo_modelo: string
  description: string | null
  category: string | null
  familia: string | null
  metal: string | null
  karat: string | null
  supplier_name: string | null
  primera_entrada: string | null   // ISO date string
  num_variantes: number | null
  lista_variantes: string | null
  variante_lider: string | null

  // Aggregated from variants
  ingresos_12m: number | null
  unidades_12m: number | null
  abc_ventas: AbcRating
  abc_unidades: AbcRating

  // Control
  metabase_synced_at: string | null
  shopify_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  codigo_interno: string            // PK — same as slug
  slug: string
  codigo_modelo: string             // FK → products
  variante: string | null
  es_variante_lider: boolean

  // Pricing
  precio_venta: number | null
  precio_tachado: number | null
  descuento_aplicado: number | null

  // Costs
  cost_price_medio: number | null
  ultimo_coste_compra: number | null
  ultimo_precio_venta: number | null

  // Profitability
  margen_bruto: number | null
  pct_margen_bruto: number | null

  // Sales
  abc_ventas: AbcRating
  abc_unidades: AbcRating
  ingresos_slug_12m: number | null
  ingresos_variante_lider_12m: number | null
  unidades_mes_anterior: number | null

  // Stock
  stock_variante: number | null

  // Distribution
  num_tiendas_activo: number | null

  // Control
  metabase_synced_at: string | null
  updated_at: string
}

export interface ProductShopifyData {
  id: string
  codigo_modelo: string
  shopify_product_id: string | null
  shopify_title: string | null
  shopify_description: string | null  // HTML
  shopify_tags: string[] | null
  shopify_seo_title: string | null
  shopify_seo_desc: string | null
  shopify_status: string | null
  shopify_handle: string | null
  shopify_vendor: string | null
  synced_at: string | null
}

export interface ProductImage {
  id: string
  codigo_modelo: string
  url: string
  source: 's3' | 'shopify' | 'manual'
  variante: string | null
  alt_text: string | null
  orden: number
  is_primary: boolean
  created_at: string
}

export type CustomFieldType = 'text' | 'textarea' | 'date' | 'boolean' | 'select'

export interface ProductCustomField {
  id: string
  codigo_modelo: string
  field_key: string
  field_value: string | null
  field_type: CustomFieldType
  updated_by: string | null
  updated_at: string
}

export interface CustomFieldDefinition {
  id: string
  field_key: string
  label: string
  field_type: CustomFieldType
  options: string[] | null
  is_active: boolean
  created_at: string
}

// ── Sync ─────────────────────────────────────────────────────

export type SyncSource = 'metabase' | 'shopify' | 'ventas' | 'reservas'
export type SyncStatus = 'success' | 'error' | 'running'
export type SyncTrigger = 'cron' | 'manual'

export interface SyncLog {
  id: string
  source: SyncSource
  status: SyncStatus
  records_updated: number | null
  error_message: string | null
  triggered_by: SyncTrigger
  started_at: string
  finished_at: string | null
}

// ── Pricing Rules ─────────────────────────────────────────────

export interface PricingRule {
  id: string
  familia: string | null
  metal: string | null
  karat: string | null
  margen_objetivo_pct: number | null
  redondeo: 'text' | '99' | '00' | null
  descuento_minimo_pct: number | null
  updated_by: string | null
  updated_at: string
}

// ── UI helpers ────────────────────────────────────────────────

export type KpiColor = 'blue' | 'green' | 'amber' | 'red' | 'neutral'
export type StatusVariant = 'ok' | 'warn' | 'error' | 'info' | 'shopify' | 'imagen'

export interface ActivityItem {
  id: string
  title: string
  description?: string
  timestamp: string
  type: 'sync' | 'edit' | 'export' | 'ai'
}

// ── Alerts ───────────────────────────────────────────────────

export type AlertSeverity = 'critica' | 'media'
export type AlertCategory = 'stock' | 'fichas' | 'ciclo_vida' | 'sync'

export interface AlertItem {
  id: string
  categoria: AlertCategory
  severidad: AlertSeverity
  titulo: string
  codigo_modelo: string | null
  descripcion: string | null
  href_accion: string
  campo_problema: string | null
}

export interface AlertSummary {
  total: number
  criticas: number
  medias: number
  byCategory: Record<AlertCategory, number>
}

export interface AlertSetting {
  id: string
  key: string
  value: string
  updated_at: string
}

// ── Campaigns ─────────────────────────────────────────────────

export interface Campaign {
  id: string
  nombre: string
  slug: string
  tipo: 'GTM' | 'Propia' | 'Estacional' | 'Liquidacion' | null
  descripcion: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: 'borrador' | 'activa' | 'finalizada'
  color: string | null
  created_at: string
  updated_at: string
}

// ── AI ────────────────────────────────────────────────────────

export type GenerationTarget =
  | 'shopify_description'
  | 'seo_title'
  | 'tags'
  | 'catalog_description'
  | 'price_suggestion'

export interface PriceSuggestionResult {
  precio_venta_sugerido: number
  precio_tachado_sugerido: number
  margen_resultante: number
  razonamiento: string
  alertas: string[]
}
