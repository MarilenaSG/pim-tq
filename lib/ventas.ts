import { createServiceClient } from '@/lib/supabase/server'

function parseEuNum(s: string): number | null {
  const clean = s.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

function parseAnyo(s: string): number {
  // "2.026" → remove dots → "2026" → 2026
  return parseInt(s.trim().replace(/\./g, ''), 10)
}

export interface SyncVentasResult {
  rowsUpserted: number
  errors: string[]
}

export async function syncVentas(): Promise<SyncVentasResult> {
  const url = process.env.METABASE_VENTAS_CSV_URL
  if (!url) throw new Error('METABASE_VENTAS_CSV_URL no configurada')

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Error descargando CSV ventas: ${res.status} ${res.statusText}`)

  const text = await res.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV ventas vacío o sin datos')

  const header = lines[0].split(',').map(h => h.trim())
  const idx = {
    anyo:              header.indexOf('anyo'),
    mes:               header.indexOf('mes'),
    codigo_interno:    header.indexOf('codigo_interno'),
    unidades_vendidas: header.indexOf('unidades_vendidas'),
    ingresos_netos:    header.indexOf('ingresos_netos'),
    coste_total:       header.indexOf('coste_total'),
  }

  const rows: {
    codigo_interno: string
    anyo: number
    mes: number
    unidades_vendidas: number | null
    ingresos_netos: number | null
    coste_total: number | null
    synced_at: string
  }[] = []

  const errors: string[] = []
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    // CSV values may be quoted (e.g. "550,99")
    const cols = parseCSVLine(lines[i])
    if (cols.length < 4) continue

    const codigoInterno = cols[idx.codigo_interno]?.trim()
    if (!codigoInterno) continue

    const anyo = parseAnyo(cols[idx.anyo] ?? '')
    const mes  = parseInt((cols[idx.mes] ?? '').trim(), 10)

    if (isNaN(anyo) || isNaN(mes)) {
      errors.push(`Línea ${i + 1}: anyo/mes inválido`)
      continue
    }

    rows.push({
      codigo_interno:    codigoInterno,
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
    return { rowsUpserted: 0, errors }
  }

  const supabase = createServiceClient()
  let rowsUpserted = 0

  // Batch upsert in chunks of 500
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('ventas_mensuales')
      .upsert(chunk, { onConflict: 'codigo_interno,anyo,mes' })

    if (error) {
      errors.push(`Upsert ventas (chunk ${Math.floor(i / CHUNK) + 1}): ${error.message}`)
    } else {
      rowsUpserted += chunk.length
    }
  }

  return { rowsUpserted, errors }
}

// Handles quoted CSV values like: 001AA21,6,"149,94","57,4"
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
