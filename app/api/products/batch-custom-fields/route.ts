import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

// ── GET — Export Excel template with current custom field values ──

export async function GET(_: NextRequest) {
  const supabase = createServerClient()

  const [fieldDefsRes, productsRes] = await Promise.all([
    supabase
      .from('custom_field_definitions')
      .select('field_key, label, field_type')
      .eq('is_active', true)
      .order('field_key'),
    supabase
      .from('products')
      .select('codigo_modelo, description')
      .eq('is_discontinued', false)
      .order('codigo_modelo'),
  ])

  const fieldDefs = fieldDefsRes.data ?? []
  const products = productsRes.data ?? []

  if (!fieldDefs.length) {
    return NextResponse.json({ error: 'No hay campos custom activos definidos' }, { status: 400 })
  }

  const codes = products.map(p => p.codigo_modelo)

  const { data: customFields } = codes.length
    ? await supabase
        .from('product_custom_fields')
        .select('codigo_modelo, field_key, field_value')
        .in('codigo_modelo', codes)
    : { data: [] }

  const valueMap: Record<string, Record<string, string>> = {}
  for (const cf of customFields ?? []) {
    if (!valueMap[cf.codigo_modelo]) valueMap[cf.codigo_modelo] = {}
    valueMap[cf.codigo_modelo][cf.field_key] = cf.field_value ?? ''
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'PIM Te Quiero'
  const ws = wb.addWorksheet('Campos Custom')

  ws.columns = [
    { width: 13 },
    { width: 42 },
    ...fieldDefs.map(() => ({ width: 32 })),
  ]

  // Row 1 — human-readable labels
  const labelRow = ws.addRow(['Modelo', 'Descripción', ...fieldDefs.map(f => f.label)])
  labelRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00557F' } }
    cell.alignment = { vertical: 'middle' }
  })
  labelRow.height = 22

  // Row 2 — technical field_keys (used when importing)
  const keyRow = ws.addRow(['codigo_modelo', 'description', ...fieldDefs.map(f => f.field_key)])
  keyRow.eachCell(cell => {
    cell.font = { italic: true, size: 9, color: { argb: 'FF888888' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
  })
  keyRow.height = 14

  // Freeze first two columns and first two rows
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }]

  // Data rows
  for (const p of products) {
    const values = valueMap[p.codigo_modelo] ?? {}
    const row = ws.addRow([
      p.codigo_modelo,
      p.description ?? '',
      ...fieldDefs.map(f => values[f.field_key] ?? ''),
    ])
    // Shade the read-only identifier columns
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }
    row.getCell(1).font  = { bold: true, size: 10, color: { argb: 'FF00557F' } }
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }
    row.getCell(2).font  = { size: 10, color: { argb: 'FF555555' } }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="campos-custom-${date}.xlsx"`,
    },
  })
}

// ── POST — Parse uploaded Excel, return rows as JSON (no save) ──

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    // @ts-ignore — @types/node Buffer<ArrayBufferLike> vs ExcelJS Buffer mismatch (Node 22)
    await wb.xlsx.load(new Uint8Array(arrayBuffer))

    const ws = wb.worksheets[0]
    if (!ws) return NextResponse.json({ error: 'El Excel está vacío' }, { status: 400 })

    // Row 2 has the technical field_keys
    const keyRowValues = ws.getRow(2).values as (string | null | undefined)[]
    // ExcelJS uses 1-based index; index 0 is undefined
    const headers: string[] = (keyRowValues.slice(1) as string[]).map(v => (v ?? '').trim())

    if (!headers.includes('codigo_modelo')) {
      return NextResponse.json({ error: 'Columna "codigo_modelo" no encontrada en la fila 2' }, { status: 400 })
    }

    const fieldKeys = headers.filter(h => h && h !== 'codigo_modelo' && h !== 'description')

    const rows: Record<string, string>[] = []
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return
      const vals = row.values as (string | number | boolean | null | undefined)[]
      const rowData: Record<string, string> = {}
      headers.forEach((header, i) => {
        if (!header) return
        const raw = vals[i + 1]
        rowData[header] = raw != null ? String(raw).trim() : ''
      })
      if (rowData.codigo_modelo) rows.push(rowData)
    })

    return NextResponse.json({ rows, fields: fieldKeys })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
