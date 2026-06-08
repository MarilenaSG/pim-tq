// ============================================================
// PIM Te Quiero — TypeScript Types
// ============================================================

// ── Shopify ───────────────────────────────────────────────────

export interface ProductShopifyData {
  codigo_modelo: string
  shopify_product_id: string | null
  shopify_title: string | null
  shopify_description: string | null
  shopify_tags: string[]
  shopify_status: 'active' | 'draft' | 'archived' | null
  shopify_handle: string | null
  shopify_vendor: string | null
  shopify_seo_title: string | null
  shopify_seo_desc: string | null
  synced_at: string | null
  created_at: string
  updated_at: string
}

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

  // Descatalogado
  is_discontinued: boolean

  // Lifecycle (Category Management)
  lifecycle_status: LifecycleStatus

  // Control
  metabase_synced_at: string | null
  created_at: string
  updated_at: string
}

export type LifecycleStatus = 'activo' | 'en_revision' | 'a_discontinuar' | 'descatalogado'

export interface ProductCDecision {
  id: string
  codigo_modelo: string
  decision: 'outlet' | 'promocion' | 'retirar' | 'mantener' | 'reubicar' | null
  descuento_sugerido: number | null
  descuento_aprobado: number | null
  precio_objetivo: number | null
  diagnostico: string | null
  notas: string | null
  estado: 'borrador' | 'aprobado' | 'ejecutado'
  ia_razonamiento: string | null
  created_at: string
  updated_at: string
}

export interface ProductStockSummary {
  codigo_modelo: string
  stock_total: number
  num_variantes: number
  variantes_con_stock: number
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

export interface ProductImage {
  id: string
  codigo_modelo: string
  url: string
  source: 's3' | 'manual'
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

export type SyncSource = 'metabase' | 'ventas' | 'reservas' | 'shopify'
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

// ── Boletín Tiendas ───────────────────────────────────────────

export type BoletinCategoria = 'campaña' | 'nuevo' | 'outlet' | 'retirar'

export interface BoletinOverride {
  codigo_modelo: string
  categoria: BoletinCategoria | 'excluir'
  nota_interna: string | null
  activo: boolean
  expira_en: string | null   // ISO date
  creado_por: string | null
  created_at: string
}

// ── Navigation (multi-zone) ───────────────────────────────────

export type Zone = 'cm' | 'ventas' | 'stock' | 'tiendas'

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: string
}

export interface ZoneNav {
  zone: Zone
  label: string
  icon: string
  items: NavItem[]
}

// ── UI helpers ────────────────────────────────────────────────

export type KpiColor = 'blue' | 'green' | 'amber' | 'red' | 'neutral'
export type StatusVariant = 'ok' | 'warn' | 'error' | 'info' | 'imagen' | 'discontinued' | 'liquidacion'

export interface ActivityItem {
  id: string
  title: string
  description?: string
  timestamp: string
  type: 'sync' | 'edit' | 'export' | 'ai'
}

// ── Alerts ───────────────────────────────────────────────────

export type AlertSeverity = 'critica' | 'media'
export type AlertCategory = 'stock' | 'sin_venta' | 'familias_sin_new'

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

// ── Lanzamientos ─────────────────────────────────────────────

export type LanzamientoTipo   = 'sku' | 'marca' | 'drop'
export type LanzamientoEstado = 'borrador' | 'confirmado'

export interface Lanzamiento {
  id:                         string
  created_by:                 string | null
  tipo:                       LanzamientoTipo | null
  nombre:                     string | null
  familia:                    string | null
  metal:                      string | null
  marca:                      string | null
  precio_venta:               number | null
  coste:                      number | null
  margen_objetivo:            number | null
  clusters_objetivo:          string[] | null
  n_tiendas:                  number | null
  unidades_por_tienda:        number | null   // legacy — usar unidades_compra_total
  unidades_compra_total:      number | null   // total del pedido al proveedor
  distribucion_personalizada: Record<string, number> | null
  semanas_rampa:              number | null
  crecimiento_semanal_pct:    number | null
  factor_ajuste_pct:          number | null
  referencia_analoga:         string | null
  descuento_promo_pct:        number | null
  semanas_promo:              number | null
  tipo_campana:               string | null
  notas_campana:              string | null
  escenarios:                 LanzamientoEscenario[] | null
  estado:                     LanzamientoEstado
  paso_actual:                number
  output_unidades_total:      number | null
  output_presupuesto_compra:  number | null
  output_margen_proyectado:   number | null
  output_breakeven_semanas:   number | null
  proveedor:                  string | null
  fecha_lanzamiento:          string | null   // ISO date
  lead_time_semanas:          number
  // Inversión y OPEX (añadidos en migración 022)
  presupuesto_marketing:      number | null
  opex_personal_pct:          number | null   // % ventas netas → personal, default 20
  opex_gastos_pct:            number | null   // % ventas netas → gastos op., default 12
  output_ebitda_pct:          number | null   // EBITDA % del escenario Base al confirmar
  output_payback_meses:       number | null   // meses de payback del escenario Base al confirmar
  // Drop-specific
  familias_drop:              FamiliaDropItem[] | null
  // Marca-specific
  familias_marca:             string[] | null
  posicionamiento_marca:      'premium' | 'media' | 'accesible' | null
  arquitectura_precios:       Record<string, ArquitecturaPreciosFamilia> | null
  descripcion_marca:          string | null
  created_at:                 string
  updated_at:                 string
}

/** Una familia dentro de un Drop (con cantidades y precio medio) */
export interface FamiliaDropItem {
  familia:      string
  uds:          number
  precio_medio: number | null
  coste_medio:  number | null
}

/** Arquitectura de precios de una familia para un lanzamiento de Marca */
export interface ArquitecturaPreciosFamilia {
  min:   number | null
  medio: number | null
  max:   number | null
}

export interface LanzamientoEscenario {
  id:          string
  nombre:      string
  params:      Record<string, number>
  kpis: {
    unidades_total:    number
    ingresos:          number
    margen_bruto:      number
    margen_pct:        number
    breakeven_semanas: number
  }
  confirmado: boolean
}

export interface SemanaProyeccion {
  semana:              number
  unidades:            number
  ingresos:            number
  margen:              number
  margenAcumulado:     number
  breakEvenAlcanzado:  boolean
}

export interface MbBenchmark {
  mb_medio: number | null
  mb_min:   number | null
  mb_max:   number | null
  n:        number
}

// ── Ventas por tienda ─────────────────────────────────────────

export interface VentasPorTienda {
  id: string
  slug: string
  codigo_modelo: string | null
  tienda_id: string
  tienda_nombre: string | null
  anyo: number
  mes: number
  unidades_vendidas: number | null
  ingresos_netos: number | null
  synced_at: string
}

// ── Stock por tienda ──────────────────────────────────────────

export interface StockPorTienda {
  id: string
  slug: string
  codigo_modelo: string | null
  tienda_id: string
  tienda_nombre: string | null
  stock_variante: number
  fecha_snapshot: string
  synced_at: string
}

// ── Tiendas ───────────────────────────────────────────────────

export type TiendaCluster = 'A' | 'B' | 'C'
export type TiendaZona    = 'Capital' | 'Periferia' | 'Turistica' | 'Ecommerce'
export type TiendaTipo    = 'Flagship' | 'Estandar' | 'Pequeña' | 'Almacen'

export interface Tienda {
  id:           string           // slug (ej: 'la_laguna')
  nombre:       string           // valor exacto en ventas_mensuales.tienda
  nombre_corto: string | null    // para UI compacta
  zona:         TiendaZona | null
  tipo:         TiendaTipo | null
  cluster:      TiendaCluster | null
  isla:         string | null    // isla canaria — default 'Tenerife', preparado para expansión
  activo:       boolean
  es_almacen:   boolean
  created_at:   string
}

// ── Tiendas Analytics ─────────────────────────────────────────

export interface TiendaKpi {
  tienda_nombre: string
  ingresos_12m:  number
  uds_12m:       number
  coste_12m:     number
  mb_pct:        number | null
  n_modelos:     number
}

export interface TiendaTendencia {
  anyo:     number
  mes:      number
  ingresos: number
  uds:      number
  coste:    number | null
  mb_pct:   number | null   // calculado en servidor; null si sin datos de coste
}

export interface TiendaFamilia {
  familia:   string
  ingresos:  number
  uds:       number
  coste:     number
  n_modelos: number
}

export interface TiendaMetal {
  metal:    string
  ingresos: number
  uds:      number
}

export interface TiendaTopProducto {
  codigo_modelo: string
  description:   string | null
  familia:       string | null
  metal:         string | null
  abc_ventas:    string | null
  ingresos:      number
  uds:           number
  coste:         number
  mb_pct:        number | null
}

export interface TiendaTopPorMetal {
  codigo_modelo: string
  description:   string | null
  familia:       string | null
  karat:         string | null
  abc_ventas:    string | null
  uds:           number
  ingresos:      number
  coste:         number
  mb_pct:        number | null
}
