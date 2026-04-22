import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const metal    = searchParams.get('metal')    || undefined
  const familia  = searchParams.get('familia')  || undefined
  const category = searchParams.get('category') || undefined

  const supabase = createServerClient()

  // Only active (non-discontinued) variants
  const { data: variants } = await supabase
    .from('product_variants')
    .select('codigo_interno, codigo_modelo, variante, precio_venta, stock_variante')
    .eq('is_discontinued', false)

  if (!variants?.length) {
    return new Response('Sin datos', { status: 404 })
  }

  const codes = Array.from(new Set(variants.map(v => v.codigo_modelo)))

  let productsQuery = supabase
    .from('products')
    .select('codigo_modelo, description, category, familia, metal, karat')
    .in('codigo_modelo', codes)

  if (metal)    productsQuery = productsQuery.eq('metal',    metal)
  if (familia)  productsQuery = productsQuery.eq('familia',  familia)
  if (category) productsQuery = productsQuery.eq('category', category)

  const { data: products } = await productsQuery

  const productMap = Object.fromEntries(
    (products ?? []).map(p => [p.codigo_modelo, p])
  )

  // Build rows: one per variant, only for products that pass the filters
  const rows = variants
    .filter(v => productMap[v.codigo_modelo])
    .map(v => {
      const p = productMap[v.codigo_modelo]
      return {
        metal:       p.metal    ?? '',
        familia:     p.familia  ?? '',
        description: p.description ?? '',
        karat:       p.karat    ?? '',
        variante:    v.variante ?? '',
        precio:      v.precio_venta,
        stock:       v.stock_variante ?? 0,
        codigo:      v.codigo_interno,
      }
    })
    .sort((a, b) => {
      const mc = a.metal.localeCompare(b.metal, 'es')
      if (mc !== 0) return mc
      const fc = a.familia.localeCompare(b.familia, 'es')
      if (fc !== 0) return fc
      const dc = a.description.localeCompare(b.description, 'es')
      if (dc !== 0) return dc
      const na = parseFloat(a.variante), nb = parseFloat(b.variante)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.variante.localeCompare(b.variante, 'es')
    })

  const fecha = new Date().toISOString().slice(0, 10)

  const workbook  = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Pedido')

  worksheet.columns = [
    { key: 'metal',       width: 14 },
    { key: 'familia',     width: 18 },
    { key: 'description', width: 42 },
    { key: 'variante',    width: 12 },
    { key: 'precio',      width: 14 },
    { key: 'stock',       width: 10 },
    { key: 'uds',         width: 14 },
  ]

  // Row 1: title
  const titleRow = worksheet.addRow(['Joyerías Te Quiero — Plantilla de Pedido', '', '', '', '', '', ''])
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF00557F' } }
  worksheet.mergeCells('A1:G1')

  // Row 2: date
  const dateRow = worksheet.addRow([`Fecha de generación: ${fecha}`, '', '', '', '', '', ''])
  dateRow.getCell(1).font = { size: 10, color: { argb: 'FF888888' } }
  worksheet.mergeCells('A2:G2')

  // Row 3: empty
  worksheet.addRow([])

  // Row 4: column headers
  const headerRow = worksheet.addRow(['Metal', 'Familia', 'Descripción', 'Talla / Var.', 'Precio (€)', 'Stock', 'Uds. a pedir'])
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00557F' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF00557F' } },
      bottom: { style: 'thin', color: { argb: 'FF00557F' } },
      left:   { style: 'thin', color: { argb: 'FF00557F' } },
      right:  { style: 'thin', color: { argb: 'FF00557F' } },
    }
  })

  const borderStyle: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFDDDDDD' } }
  const cellBorder = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle }

  let lastMetal = ''

  for (const r of rows) {
    // Metal separator row
    if (r.metal !== lastMetal) {
      lastMetal = r.metal
      const sepRow = worksheet.addRow([r.metal, '', '', '', '', '', ''])
      sepRow.getCell(1).font      = { bold: true, color: { argb: 'FF5A3E1A' } }
      sepRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5E6CC' } }
      sepRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      sepRow.height = 18
      worksheet.mergeCells(`A${sepRow.number}:G${sepRow.number}`)
    }

    const dataRow = worksheet.addRow([
      r.metal,
      r.familia,
      r.description,
      r.variante,
      r.precio ?? '',
      r.stock,
      '',
    ])
    dataRow.height = 20
    dataRow.eachCell((cell, col) => {
      if (col <= 7) {
        cell.border    = cellBorder
        cell.alignment = { vertical: 'middle', wrapText: col === 3 }
        cell.font      = { size: 10 }
      }
    })

    // Format price cell
    const priceCell = dataRow.getCell(5)
    if (r.precio != null) {
      priceCell.numFmt = '#,##0.00 €'
    }

    // Highlight zero-stock in amber
    if (r.stock === 0) {
      dataRow.getCell(6).font = { size: 10, color: { argb: 'FFC8842A' } }
    }
  }

  // Print setup
  worksheet.pageSetup = {
    paperSize:      9,
    orientation:    'landscape',
    fitToPage:      true,
    fitToWidth:     1,
    fitToHeight:    0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    printTitlesRow: '4:4',
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Plantilla-Pedidos-TQ-${fecha}.xlsx"`,
    },
  })
}
