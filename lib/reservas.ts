import { createServiceClient } from '@/lib/supabase/server'

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

// "abril 21, 2026" → "2026-04-21"
function parseSpanishDate(s: string): string | null {
  const m = s.trim().match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!m) return null
  const month = MESES[m[1].toLowerCase()]
  if (!month) return null
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(parseInt(m[2], 10)).padStart(2, '0')}`
}

export interface SyncReservasResult {
  rowsInserted: number
  errors: string[]
}

export async function syncReservas(): Promise<SyncReservasResult> {
  const url = process.env.METABASE_RESERVAS_CSV_URL
  if (!url) throw new Error('METABASE_RESERVAS_CSV_URL no configurada')

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Error descargando CSV reservas: ${res.status} ${res.statusText}`)

  const text = await res.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV reservas vacío o sin datos')

  const header = lines[0].split(',').map(h => h.trim())
  const idx = {
    codigo_interno:      header.indexOf('codigo_interno'),
    fecha_snapshot:      header.indexOf('fecha_snapshot'),
    reservas_count:      header.indexOf('reservas_count'),
    unidades_reservadas: header.indexOf('unidades_reservadas'),
  }

  const rows: {
    codigo_interno: string
    fecha_snapshot: string | null
    reservas_count: number | null
    unidades_reservadas: number | null
    synced_at: string
  }[] = []

  const errors: string[] = []
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 2) continue

    const codigoInterno = cols[idx.codigo_interno]?.trim()
    if (!codigoInterno) continue

    const fechaRaw = cols[idx.fecha_snapshot]?.trim() ?? ''
    const fechaISO = parseSpanishDate(fechaRaw)
    if (!fechaISO) {
      errors.push(`Línea ${i + 1}: fecha inválida "${fechaRaw}"`)
      continue
    }

    rows.push({
      codigo_interno:      codigoInterno,
      fecha_snapshot:      fechaISO,
      reservas_count:      parseInt((cols[idx.reservas_count] ?? '').trim(), 10) || null,
      unidades_reservadas: parseInt((cols[idx.unidades_reservadas] ?? '').trim(), 10) || null,
      synced_at:           now,
    })
  }

  if (rows.length === 0) {
    errors.push('No se encontraron filas válidas en el CSV')
    return { rowsInserted: 0, errors }
  }

  const supabase = createServiceClient()

  // The CSV column is called "codigo_interno" but contains slug values (ERP catalog code).
  // Validate against product_variants.slug — skip rows with no match.
  const allSlugs = Array.from(new Set(rows.map(r => r.codigo_interno)))
  const validSlugs = new Set<string>()
  const LOOKUP_CHUNK = 500
  for (let i = 0; i < allSlugs.length; i += LOOKUP_CHUNK) {
    const { data } = await supabase
      .from('product_variants')
      .select('slug')
      .in('slug', allSlugs.slice(i, i + LOOKUP_CHUNK))
    for (const v of data ?? []) if (v.slug) validSlugs.add(v.slug)
  }

  const validRows = rows.filter(r => validSlugs.has(r.codigo_interno))
  // skipped rows are descatalogued variants — omit silently

  if (validRows.length === 0) {
    errors.push('Ningún slug de reservas coincide con product_variants. Ejecuta primero el sync de Metabase.')
    return { rowsInserted: 0, errors }
  }

  // Replace snapshot: delete all existing rows, then insert fresh
  const { error: deleteError } = await supabase
    .from('reservas_activas')
    .delete()
    .not('codigo_interno', 'is', null) // match all rows (codigo_interno is NOT NULL)

  if (deleteError) {
    errors.push(`Error limpiando reservas_activas: ${deleteError.message}`)
    return { rowsInserted: 0, errors }
  }

  // Insert in chunks
  const CHUNK = 500
  let rowsInserted = 0

  for (let i = 0; i < validRows.length; i += CHUNK) {
    const chunk = validRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('reservas_activas').insert(chunk)
    if (error) {
      errors.push(`Insert reservas (chunk ${Math.floor(i / CHUNK) + 1}): ${error.message}`)
    } else {
      rowsInserted += chunk.length
    }
  }

  return { rowsInserted, errors }
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
