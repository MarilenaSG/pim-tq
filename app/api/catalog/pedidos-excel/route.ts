import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createServerClient } from '@/lib/supabase/server'

// Columnas: Metal | Familia | Descripción (nivel variante, de codigo_interno) | Uds. a pedir

const NCOLS = 4

function sortVar(a: string | null, b: string | null): number {
  const na = parseFloat(a ?? ''), nb = parseFloat(b ?? '')
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return (a ?? '').localeCompare(b ?? '', 'es')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const metal    = searchParams.get('metal')    || undefined
  const familia  = searchParams.get('familia')  || undefined
  const category = searchParams.get('category') || undefined

  const supabase = createServerClient()

  let prodQuery = supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal, karat')
    .neq('is_discontinued', true)
    .order('metal',       { ascending: true, nullsFirst: false })
    .order('familia',     { ascending: true, nullsFirst: false })
    .order('description', { ascending: true, nullsFirst: false })

  if (metal)    prodQuery = prodQuery.eq('metal',    metal)
  if (familia)  prodQuery = prodQuery.eq('familia',  familia)
  if (category) prodQuery = prodQuery.eq('category', category)

  const { data: products, error } = await prodQuery
  if (error || !products?.length) {
    return NextResponse.json({ error: 'Sin productos' }, { status: 404 })
  }

  const codes = products.map(p => p.codigo_modelo)
  const productMap = Object.fromEntries(products.map(p => [p.codigo_modelo, p]))

  const { data: variants } = await supabase
    .from('product_variants')
    .select('codigo_modelo, codigo_interno, variante, description, is_discontinued')
    .in('codigo_modelo', codes)
    .neq('is_discontinued', true)

  const variantsByModel = new Map<string, typeof variants>()
  for (const v of variants ?? []) {
    if (!variantsByModel.has(v.codigo_modelo)) variantsByModel.set(v.codigo_modelo, [])
    variantsByModel.get(v.codigo_modelo)!.push(v)
  }

  // Construir filas: una fila por variante (codigo_interno), descripción de la variante
  type Row = {
    metal:       string
    familia:     string
    description: string
  }

  const rows: Row[] = []
  for (const p of products) {
    const pvs = (variantsByModel.get(p.codigo_modelo) ?? [])
      .slice()
      .sort((a, b) => sortVar(a.variante, b.variante))

    for (const v of pvs) {
      // Usar la descripción propia de la variante (nivel codigo_interno, de Metabase).
      // Si aún no se ha hecho sync con la nueva columna, fallback al modelo + variante.
      const desc = v.description?.trim()
        || (v.variante ? `${p.description ?? ''} (${v.variante.trim()})` : (p.description ?? ''))

      rows.push({
        metal:       p.metal   ?? '',
        familia:     p.familia ?? '',
        description: desc,
      })
    }
  }

  // ── Excel ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PIM Te Quiero'
  wb.created = new Date()

  const ws = wb.addWorksheet('Plantilla Pedido', {
    pageSetup: {
      orientation: 'portrait',
      fitToPage:   true,
      fitToWidth:  1,
      paperSize:   9, // A4
    },
  })

  ws.columns = [
    { key: 'metal',       width: 14 },
    { key: 'familia',     width: 20 },
    { key: 'description', width: 52 },
    { key: 'uds',         width: 16 },
  ]

  // Fila 1 — título
  const titleRow = ws.addRow(['TE QUIERO JEWELS — Plantilla de Pedido', '', '', ''])
  ws.mergeCells(1, 1, 1, NCOLS)
  titleRow.getCell(1).font      = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF00557F' } }
  titleRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEAF2' } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  titleRow.height = 24

  // Fila 2 — fecha y filtros
  const filterParts: string[] = [`Generado: ${new Date().toLocaleDateString('es-ES')}`]
  if (metal)   filterParts.push(`Metal: ${metal}`)
  if (familia) filterParts.push(`Familia: ${familia}`)
  const metaRow = ws.addRow([filterParts.join('   ·   '), '', '', ''])
  ws.mergeCells(2, 1, 2, NCOLS)
  metaRow.getCell(1).font      = { name: 'Arial', size: 9, color: { argb: 'FF888888' } }
  metaRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  metaRow.height = 16

  // Fila 3 — vacía
  ws.addRow([])

  // Fila 4 — cabeceras
  const headerRow = ws.addRow(['Metal', 'Familia', 'Descripción', 'Uds. a pedir'])
  headerRow.height = 20
  headerRow.eachCell(cell => {
    cell.font      = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00557F' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF00557F' } },
      bottom: { style: 'thin', color: { argb: 'FF00557F' } },
      left:   { style: 'thin', color: { argb: 'FF00557F' } },
      right:  { style: 'thin', color: { argb: 'FF00557F' } },
    }
  })
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }]

  // Datos — separadores por metal
  let currentMetal = ''
  for (const r of rows) {
    if (r.metal !== currentMetal) {
      currentMetal = r.metal
      const sepRow = ws.addRow([r.metal.toUpperCase(), '', '', ''])
      ws.mergeCells(sepRow.number, 1, sepRow.number, NCOLS)
      sepRow.getCell(1).font      = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF5A3E1A' } }
      sepRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5E6CC' } }
      sepRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      sepRow.height = 16
    }

    const dataRow = ws.addRow({
      metal:       r.metal,
      familia:     r.familia,
      description: r.description,
      uds:         '',
    })
    dataRow.height = 16

    dataRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font      = { name: 'Arial', size: 9 }
      cell.alignment = {
        vertical:   'middle',
        horizontal: col === 3 ? 'left' : col === 4 ? 'center' : 'left',
        wrapText:   false,
      }
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left:   { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right:  { style: 'hair', color: { argb: 'FFDDDDDD' } },
      }
    })

    // Columna "Uds. a pedir" — fondo verde suave, campo editable
    const udsCell = dataRow.getCell('uds')
    udsCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FBF5' } }
    udsCell.numFmt = '0'
  }

  ws.pageSetup.printTitlesRow = '4:4'

  const buffer = await wb.xlsx.writeBuffer()
  const date   = new Date().toISOString().slice(0, 10)

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla-pedido-tq-${date}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  })
}
