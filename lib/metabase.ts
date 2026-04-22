import { createServiceClient } from './supabase/server'
import type { AbcRating } from '@/types'

// ── CSV columns from Metabase ─────────────────────────────────
// slug, codigo_modelo, codigo_interno, variante, description,
// category, familia, metal, karat, supplier_name,
// primera_entrada_catalogo, image_url, imagen_formula_excel,
// num_variantes, lista_variantes, variante_lider, es_variante_lider,
// ingresos_variante_lider_12m, stock_variante,
// precio_venta, precio_tachado, descuento_aplicado,
// cost_price_medio, ultimo_coste_compra, ultimo_precio_venta,
// margen_bruto, pct_margen_bruto, abc_ventas, abc_unidades,
// ingresos_12m, unidades_12m, ingresos_slug_12m,
// unidades_mes_anterior, num_tiendas_activo

export interface MetabaseRow {
  slug: string
  codigo_modelo: string
  codigo_interno: string
  variante: string | null
  description: string | null
  category: string | null
  familia: string | null
  metal: string | null
  karat: string | null
  supplier_name: string | null
  primera_entrada_catalogo: string | null
  image_url: string | null
  num_variantes: number | null
  lista_variantes: string | null
  variante_lider: string | null
  es_variante_lider: boolean
  ingresos_variante_lider_12m: number | null
  stock_variante: number | null
  precio_venta: number | null
  precio_tachado: number | null
  descuento_aplicado: number | null
  cost_price_medio: number | null
  ultimo_coste_compra: number | null
  ultimo_precio_venta: number | null
  margen_bruto: number | null
  pct_margen_bruto: number | null
  abc_ventas: AbcRating
  abc_unidades: AbcRating
  ingresos_12m: number | null
  unidades_12m: number | null
  ingresos_slug_12m: number | null
  unidades_mes_anterior: number | null
  num_tiendas_activo: number | null
  is_discontinued: boolean
}

export interface SyncResult {
  recordsUpdated: number
  modelsUpserted: number
  variantsUpserted: number
  imagesUpserted: number
  errors: string[]
}

// ── Parsers ───────────────────────────────────────────────────

/** European number format: "162.010,03" → 162010.03 */
function parseEuNum(val: string | undefined): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null
  const cleaned = val.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseAbcRating(val: string | undefined): AbcRating {
  const letter = val?.trim().toUpperCase().charAt(0)
  if (letter === 'A' || letter === 'B' || letter === 'C') return letter
  return null
}

function parseBool(val: string | undefined): boolean {
  const v = val?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'verdadero'
}

function parseStr(val: string | undefined): string | null {
  const s = val?.trim()
  return s && s !== '' && s !== '-' ? s : null
}

function parseDate(val: string | undefined): string | null {
  const s = val?.trim()
  if (!s || s === '') return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const ddmm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`
  return null
}

// ── CSV parser ────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function parseCsv(text: string): MetabaseRow[] {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.filter(l => l.trim())
  if (nonEmpty.length < 2) return []

  const headers = parseCsvRow(nonEmpty[0]).map(h => h.trim())
  const rows: MetabaseRow[] = []

  for (let i = 1; i < nonEmpty.length; i++) {
    const vals = parseCsvRow(nonEmpty[i])
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => { raw[h] = vals[idx] ?? '' })

    const codigoModelo = parseStr(raw['codigo_modelo'])
    const codigoInterno = parseStr(raw['codigo_interno'])
    if (!codigoModelo || !codigoInterno) continue

    rows.push({
      slug:                      parseStr(raw['slug']) ?? codigoInterno,
      codigo_modelo:             codigoModelo,
      codigo_interno:            codigoInterno,
      variante:                  parseStr(raw['variante']),
      description:               parseStr(raw['description']),
      category:                  parseStr(raw['category']),
      familia:                   parseStr(raw['familia']),
      metal:                     parseStr(raw['metal']),
      karat:                     parseStr(raw['karat']),
      supplier_name:             parseStr(raw['supplier_name']),
      primera_entrada_catalogo:  parseDate(raw['primera_entrada_catalogo']),
      image_url:                 parseStr(raw['image_url']),
      num_variantes:             parseEuNum(raw['num_variantes']),
      lista_variantes:           parseStr(raw['lista_variantes']),
      variante_lider:            parseStr(raw['variante_lider']),
      es_variante_lider:         parseBool(raw['es_variante_lider']),
      is_discontinued:           raw['estado_catalogo']?.trim() === 'Descatalogado',
      ingresos_variante_lider_12m: parseEuNum(raw['ingresos_variante_lider_12m']),
      stock_variante:            parseEuNum(raw['stock_variante']),
      precio_venta:              parseEuNum(raw['precio_venta']),
      precio_tachado:            parseEuNum(raw['precio_tachado']),
      descuento_aplicado:        parseEuNum(raw['descuento_aplicado']),
      cost_price_medio:          parseEuNum(raw['cost_price_medio']),
      ultimo_coste_compra:       parseEuNum(raw['ultimo_coste_compra']),
      ultimo_precio_venta:       parseEuNum(raw['ultimo_precio_venta']),
      margen_bruto:              parseEuNum(raw['margen_bruto']),
      pct_margen_bruto:          parseEuNum(raw['pct_margen_bruto']),
      abc_ventas:                parseAbcRating(raw['abc_ventas']),
      abc_unidades:              parseAbcRating(raw['abc_unidades']),
      ingresos_12m:              parseEuNum(raw['ingresos_12m']),
      unidades_12m:       parseEuNum(raw['unidades_12m']),
      ingresos_slug_12m:         parseEuNum(raw['ingresos_slug_12m']),
      unidades_mes_anterior:     parseEuNum(raw['unidades_mes_anterior']),
      num_tiendas_activo:        parseEuNum(raw['num_tiendas_activo']),
    })
  }

  return rows
}

// ── Chunker ───────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

// ── Main sync function ────────────────────────────────────────

export async function syncMetabase(): Promise<SyncResult> {
  const csvUrl = process.env.METABASE_CSV_URL
  if (!csvUrl) throw new Error('METABASE_CSV_URL no está configurada')

  // 1 · Download CSV
  const response = await fetch(csvUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Error descargando CSV: ${response.status} ${response.statusText}`)
  }
  const csvText = await response.text()

  // 2 · Parse rows
  const rows = parseCsv(csvText)
  if (rows.length === 0) throw new Error('CSV vacío o sin filas válidas')

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const errors: string[] = []

  // 3 · Upsert product_variants (all rows)
  const variantRows = rows.map(r => ({
    codigo_interno:              r.codigo_interno,
    slug:                        r.slug,
    codigo_modelo:               r.codigo_modelo,
    variante:                    r.variante,
    es_variante_lider:           r.es_variante_lider,
    precio_venta:                r.precio_venta,
    precio_tachado:              r.precio_tachado,
    descuento_aplicado:          r.descuento_aplicado,
    cost_price_medio:            r.cost_price_medio,
    ultimo_coste_compra:         r.ultimo_coste_compra,
    ultimo_precio_venta:         r.ultimo_precio_venta,
    margen_bruto:                r.margen_bruto,
    pct_margen_bruto:            r.pct_margen_bruto,
    abc_ventas:                  r.abc_ventas,
    abc_unidades:                r.abc_unidades,
    ingresos_slug_12m:           r.ingresos_slug_12m,
    ingresos_variante_lider_12m: r.ingresos_variante_lider_12m,
    unidades_mes_anterior:       r.unidades_mes_anterior,
    stock_variante:              r.stock_variante !== null ? Math.round(r.stock_variante) : null,
    num_tiendas_activo:          r.num_tiendas_activo !== null ? Math.round(r.num_tiendas_activo) : null,
    metabase_synced_at:          now,
  }))

  // Deduplicate by codigo_interno — the CSV can have repeated rows for the same SKU,
  // which causes "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const uniqueVariantMap = new Map(variantRows.map(r => [r.codigo_interno, r]))
  const deduplicatedVariants = Array.from(uniqueVariantMap.values())

  let variantsUpserted = 0
  for (const batch of chunk(deduplicatedVariants, 250)) {
    const { error } = await supabase
      .from('product_variants')
      .upsert(batch, { onConflict: 'codigo_interno' })
    if (error) {
      errors.push(`Variantes batch error: ${error.message}`)
    } else {
      variantsUpserted += batch.length
    }
  }

  // 4 · Build products from leader variants
  // Use a Map to deduplicate by codigo_modelo (take first leader found)
  const productMap = new Map<string, typeof rows[number]>()
  for (const r of rows) {
    if (r.es_variante_lider && !productMap.has(r.codigo_modelo)) {
      productMap.set(r.codigo_modelo, r)
    }
  }
  // Fallback: if no leader found for a model, use first row
  for (const r of rows) {
    if (!productMap.has(r.codigo_modelo)) {
      productMap.set(r.codigo_modelo, r)
    }
  }

  const productRows = Array.from(productMap.values()).map(r => ({
    codigo_modelo:      r.codigo_modelo,
    description:        r.description,
    category:           r.category,
    familia:            r.familia,
    metal:              r.metal,
    karat:              r.karat,
    supplier_name:      r.supplier_name,
    primera_entrada:    r.primera_entrada_catalogo,
    num_variantes:      r.num_variantes !== null ? Math.round(r.num_variantes) : null,
    lista_variantes:    r.lista_variantes,
    variante_lider:     r.variante_lider,
    ingresos_12m:       r.ingresos_12m,
    unidades_12m:       r.unidades_12m !== null ? Math.round(r.unidades_12m) : null,
    abc_ventas:         r.abc_ventas,
    abc_unidades:       r.abc_unidades,
    is_discontinued:    r.is_discontinued,
    metabase_synced_at: now,
    updated_at:         now,
  }))

  let modelsUpserted = 0
  for (const batch of chunk(productRows, 250)) {
    const { error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'codigo_modelo' })
    if (error) {
      errors.push(`Productos batch error: ${error.message}`)
    } else {
      modelsUpserted += batch.length
    }
  }

  // 5 · Upsert product_images for leader variants with image_url
  const imageRows = rows
    .filter(r => r.es_variante_lider && r.image_url)
    .map(r => ({
      codigo_modelo: r.codigo_modelo,
      url:           r.image_url!,
      source:        's3' as const,
      variante:      r.variante,
      is_primary:    true,
      orden:         0,
    }))

  let imagesUpserted = 0
  if (imageRows.length > 0) {
    // Delete existing s3 primary images before reinserting to avoid duplicates
    const modelosConImagen = Array.from(new Set(imageRows.map(r => r.codigo_modelo)))
    for (const batch of chunk(modelosConImagen, 250)) {
      await supabase
        .from('product_images')
        .delete()
        .in('codigo_modelo', batch)
        .eq('source', 's3')
        .eq('is_primary', true)
    }

    for (const batch of chunk(imageRows, 250)) {
      const { error } = await supabase
        .from('product_images')
        .insert(batch)
      if (error) {
        errors.push(`Imágenes batch error: ${error.message}`)
      } else {
        imagesUpserted += batch.length
      }
    }
  }

  return {
    recordsUpdated: variantsUpserted + modelsUpserted,
    modelsUpserted,
    variantsUpserted,
    imagesUpserted,
    errors,
  }
}

// ── Download only (for testing) ───────────────────────────────

export async function downloadAndParseCsv(): Promise<MetabaseRow[]> {
  const csvUrl = process.env.METABASE_CSV_URL
  if (!csvUrl) throw new Error('METABASE_CSV_URL no está configurada')
  const response = await fetch(csvUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  return parseCsv(text)
}
