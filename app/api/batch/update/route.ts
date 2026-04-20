import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface BatchRow {
  codigo_modelo: string
  [field: string]: string
}

interface BatchUpdateBody {
  rows:   BatchRow[]
  fields: string[]   // field names to update (excludes 'codigo_modelo')
}

interface UpsertRecord {
  codigo_modelo: string
  field_key:     string
  field_value:   string
  field_type:    'text'
  updated_at:    string
}

const BATCH_SIZE = 250

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as BatchUpdateBody

    if (!Array.isArray(body.rows) || !Array.isArray(body.fields)) {
      return NextResponse.json({ error: 'Body inválido: se requieren "rows" y "fields".' }, { status: 400 })
    }
    if (body.fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos a actualizar.' }, { status: 400 })
    }
    if (body.rows.length === 0) {
      return NextResponse.json({ error: 'No hay filas a procesar.' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // Build flat list of upsert records
    const records: UpsertRecord[] = []
    for (const row of body.rows) {
      const codigoModelo = (row.codigo_modelo ?? '').trim()
      if (!codigoModelo) continue
      for (const field of body.fields) {
        const value = (row[field] ?? '').trim()
        if (!value) continue  // skip empty cells — don't overwrite with blank
        records.push({
          codigo_modelo: codigoModelo,
          field_key:     field,
          field_value:   value,
          field_type:    'text',
          updated_at:    now,
        })
      }
    }

    if (records.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 })
    }

    // Upsert in batches of BATCH_SIZE
    let totalUpdated = 0
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('product_custom_fields')
        .upsert(batch, { onConflict: 'codigo_modelo,field_key' })
      if (error) throw new Error(error.message)
      totalUpdated += batch.length
    }

    return NextResponse.json({ ok: true, updated: totalUpdated })
  } catch (err) {
    console.error('[batch/update]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
