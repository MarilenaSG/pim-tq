import { createServiceClient } from '@/lib/supabase/server'

function parseEuNum(s: string): number | null {
  const clean = s.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

function parseAnyo(s: string): number {
  return parseInt(s.trim().replace(/\./g, ''), 10)
}

export interface SyncVentasResult {
  rowsUpserted: number
  rowsDropped:  number
  errors:       string[]
}

export async function syncVentas(): Promise<SyncVentasResult> {
  const url = process.env.METABASE_VENTAS_CSV_URL
  if (!url) throw new Error('METABASE_VENTAS_CSV_URL no configurada')

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Error descargando CSV ventas: ${res.status} ${res.statusText}`)

  const text  = await res.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV ventas vacío o sin datos')

  const header = lines[0].split(',').map(h => h.trim())
  const idx = {
    codigo_interno:    header.indexOf('codigo_interno'),   // CSV column → stored as slug
    tienda_nombre:     header.indexOf('tienda_nombre'),
    anyo:              header.indexOf('anyo'),
    mes:               header.indexOf('mes'),
    unidades_vendidas: header.indexOf('unidades_vendidas'),
    ingresos_netos:    header.indexOf('ingresos_netos'),
    coste_total:       header.indexOf('coste_total'),
  }

  const missing = (['codigo_interno', 'anyo', 'mes'] as const).filter(k => idx[k] === -1)
  if (missing.length > 0) {
    throw new Error(`CSV ventas: columnas no encontradas: ${missing.join(', ')}. Cabecera: ${header.join(', ')}`)
  }

  const hasTienda = idx.tienda_nombre >= 0

  // La tabla ventas_mensuales usa "slug" como nombre de columna
  // (mismo valor que codigo_interno del CSV). codigo_modelo = primeros 5 chars del slug.
  const rows: {
    slug:              string
    codigo_modelo:     string
    tienda:            string
    anyo:              number
    mes:               number
    unidades_vendidas: number | null
    ingresos_netos:    number | null
    coste_total:       number | null
    synced_at:         string
  }[] = []

  const errors: string[] = []
  let rowsDropped = 0
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 4) { rowsDropped++; continue }

    const slug = cols[idx.codigo_interno]?.trim()
    if (!slug) { rowsDropped++; continue }

    const anyo = parseAnyo(cols[idx.anyo] ?? '')
    const mes  = parseInt((cols[idx.mes] ?? '').trim(), 10)

    if (isNaN(anyo) || isNaN(mes) || mes < 1 || mes > 12) {
      errors.push(`Línea ${i + 1}: anyo/mes inválido`)
      rowsDropped++
      continue
    }

    const tienda = hasTienda
      ? (cols[idx.tienda_nombre]?.trim() || 'sin_tienda')
      : 'sin_tienda'

    rows.push({
      slug,
      codigo_modelo: slug.substring(0, 5),
      tienda,
      anyo,
      mes,
      unidades_vendidas: parseInt((cols[idx.unidades_vendidas] ?? '').trim(), 10) || null,
      ingresos_netos:    parseEuNum(cols[idx.ingresos_netos] ?? ''),
      coste_total:       parseEuNum(cols[idx.coste_total] ?? ''),
      synced_at:         now,
    })
  }

  if (rows.length === 0) {
    errors.push('No se encontraron filas válidas en el CSV')
    return { rowsUpserted: 0, rowsDropped, errors }
  }

  // Deduplicar por (slug, tienda, anyo, mes)
  const dedupeMap = new Map<string, typeof rows[0]>()
  for (const r of rows) {
    dedupeMap.set(`${r.slug}|${r.tienda}|${r.anyo}|${r.mes}`, r)
  }
  const dedupedRows = Array.from(dedupeMap.values())

  const supabase = createServiceClient()
  let rowsUpserted = 0
  const CHUNK = 500

  for (let i = 0; i < dedupedRows.length; i += CHUNK) {
    const chunk = dedupedRows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('ventas_mensuales')
      .upsert(chunk, { onConflict: 'slug,tienda,anyo,mes' })

    if (error) {
      errors.push(`Upsert ventas (chunk ${Math.floor(i / CHUNK) + 1}): ${error.message}`)
    } else {
      rowsUpserted += chunk.length
    }
  }

  return { rowsUpserted, rowsDropped, errors }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
