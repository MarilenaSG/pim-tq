import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createServerClient } from '@/lib/supabase/server'
import type { BoletinCategoria } from '@/types'

// ── Categorization (mirrors /api/boletin/route.ts) ───────────
function autoCategorize(p: {
  en_campaña_activa: boolean
  dias_en_catalogo: number
  descuento_aplicado: number | null
  is_discontinued: boolean
  stock_total: number
}): BoletinCategoria | null {
  if (p.en_campaña_activa) return 'campaña'
  if (p.dias_en_catalogo <= 60) return 'nuevo'
  if ((p.descuento_aplicado ?? 0) >= 15) return 'outlet'
  if (p.is_discontinued && p.stock_total < 20) return 'retirar'
  return null
}

// ── Category display config ──────────────────────────────────
const CAT_CONFIG: Record<BoletinCategoria, { label: string; argb: string; bgArgb: string }> = {
  campaña: { label: 'Campaña',   argb: 'FF00557F', bgArgb: 'FFD6EAF4' },
  nuevo:   { label: 'Nuevo',     argb: 'FF3A9E6A', bgArgb: 'FFD5F0E5' },
  outlet:  { label: 'Outlet',    argb: 'FFC8842A', bgArgb: 'FFFAEBD7' },
  retirar: { label: 'A retirar', argb: 'FFC0392B', bgArgb: 'FFFDE8E8' },
}
const CAT_ORDER: BoletinCategoria[] = ['campaña', 'nuevo', 'outlet', 'retirar']

export async function GET(_req: NextRequest) {
  const supabase = createServerClient()
  const today = new Date()

  // ── 1. Active campaigns ──────────────────────────────────────
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('estado', 'activa')
    .lte('fecha_inicio', today.toISOString().slice(0, 10))
    .or(`fecha_fin.is.null,fecha_fin.gte.${today.toISOString().slice(0, 10)}`)

  const activeCampaignIds = (activeCampaigns ?? []).map(c => c.id as string)
  const productosEnCampaña = new Set<string>()
  if (activeCampaignIds.length > 0) {
    const { data: cpRows } = await supabase
      .from('campaign_products')
      .select('codigo_modelo')
      .in('campaign_id', activeCampaignIds)
    for (const r of cpRows ?? []) productosEnCampaña.add(r.codigo_modelo as string)
  }

  // ── 2. Products ──────────────────────────────────────────────
  const { data: products } = await supabase
    .from('products')
    .select(`
      codigo_modelo, description, familia, metal, karat,
      primera_entrada, is_discontinued,
      product_variants!inner(
        precio_venta, precio_tachado, descuento_aplicado, stock_variante, es_variante_lider
      )
    `)

  // ── 3. Images ────────────────────────────────────────────────
  const { data: images } = await supabase
    .from('product_images')
    .select('codigo_modelo, url')
    .eq('is_primary', true)
  const imageMap = Object.fromEntries(
    (images ?? []).map(img => [img.codigo_modelo as string, img.url as string])
  )

  // ── 4. Active overrides ──────────────────────────────────────
  const { data: overrides } = await supabase
    .from('boletin_overrides')
    .select('codigo_modelo, categoria, nota_interna, activo, expira_en')
    .eq('activo', true)
    .or(`expira_en.is.null,expira_en.gte.${today.toISOString().slice(0, 10)}`)
  const overrideMap = new Map<string, { categoria: BoletinCategoria; nota_interna: string | null }>(
    (overrides ?? []).map(o => [
      o.codigo_modelo as string,
      { categoria: o.categoria as BoletinCategoria, nota_interna: o.nota_interna as string | null },
    ])
  )

  // ── 5. Build items ───────────────────────────────────────────
  type BoletinRow = {
    categoria: BoletinCategoria
    codigo_modelo: string
    description: string
    familia: string
    metal: string
    karat: string
    precio_venta: number | null
    precio_tachado: number | null
    descuento_aplicado: number | null
    stock_total: number
    image_url: string
    nota_interna: string
  }

  const grouped: Record<BoletinCategoria, BoletinRow[]> = {
    campaña: [], nuevo: [], outlet: [], retirar: [],
  }

  for (const p of products ?? []) {
    const codigo = p.codigo_modelo as string
    const variants = (p as unknown as { product_variants: Record<string, unknown>[] }).product_variants ?? []
    const leader = variants.find(v => v.es_variante_lider) ?? variants[0]
    const stockTotal = variants.reduce((sum, v) => sum + ((v.stock_variante as number) ?? 0), 0)
    const diasEnCatalogo = p.primera_entrada
      ? Math.floor((today.getTime() - new Date(p.primera_entrada as string).getTime()) / 86_400_000)
      : 9999

    const autoCategoria = autoCategorize({
      en_campaña_activa:  productosEnCampaña.has(codigo),
      dias_en_catalogo:   diasEnCatalogo,
      descuento_aplicado: leader ? (leader.descuento_aplicado as number | null) : null,
      is_discontinued:    p.is_discontinued as boolean,
      stock_total:        stockTotal,
    })

    const override = overrideMap.get(codigo)
    const categoria = override?.categoria ?? autoCategoria
    if (!categoria) continue

    grouped[categoria].push({
      categoria,
      codigo_modelo:     codigo,
      description:       (p.description as string) ?? '',
      familia:           (p.familia as string) ?? '',
      metal:             (p.metal as string) ?? '',
      karat:             (p.karat as string) ?? '',
      precio_venta:      leader ? (leader.precio_venta as number | null) : null,
      precio_tachado:    leader ? (leader.precio_tachado as number | null) : null,
      descuento_aplicado: leader ? (leader.descuento_aplicado as number | null) : null,
      stock_total:       stockTotal,
      image_url:         imageMap[codigo] ?? '',
      nota_interna:      override?.nota_interna ?? '',
    })
  }

  // Sort each group alphabetically by description
  for (const cat of CAT_ORDER) {
    grouped[cat].sort((a, b) => a.description.localeCompare(b.description, 'es'))
  }

  // ── 6. Build workbook ────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PIM Te Quiero'
  wb.created = today

  const ws = wb.addWorksheet('Boletín Tiendas', {
    pageSetup: {
      orientation: 'landscape',
      fitToPage:   true,
      fitToWidth:  1,
      paperSize:   9, // A4
    },
  })

  const COLS = [
    { header: 'Categoría',    key: 'categoria',   width: 13 },
    { header: 'Código',       key: 'codigo',      width: 10 },
    { header: 'Descripción',  key: 'descripcion', width: 44 },
    { header: 'Familia',      key: 'familia',     width: 16 },
    { header: 'Metal',        key: 'metal',       width: 10 },
    { header: 'Quilates',     key: 'karat',       width: 9  },
    { header: 'Precio (€)',   key: 'precio',      width: 11 },
    { header: 'Precio ant.',  key: 'precioAnt',   width: 11 },
    { header: '% Dto',        key: 'descuento',   width: 8  },
    { header: 'Stock total',  key: 'stock',       width: 11 },
    { header: 'URL imagen',   key: 'imagen',      width: 40 },
    { header: 'Nota interna', key: 'nota',        width: 28 },
  ]

  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }))

  // Fila 1 — Título
  const titleRow = ws.addRow(['Te Quiero Jewels — Boletín de Tiendas'])
  ws.mergeCells(1, 1, 1, COLS.length)
  titleRow.height = 26
  const t1 = titleRow.getCell(1)
  t1.font      = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF00557F' } }
  t1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEAF2' } }
  t1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 2 — Fecha + totales
  const totalItems = CAT_ORDER.reduce((s, c) => s + grouped[c].length, 0)
  const metaRow = ws.addRow([
    `Generado: ${today.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}` +
    `   ·   ${totalItems} productos en total`,
  ])
  ws.mergeCells(2, 1, 2, COLS.length)
  metaRow.height = 15
  const t2 = metaRow.getCell(1)
  t2.font      = { name: 'Arial', size: 9, color: { argb: 'FF888888' } }
  t2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEAF2' } }
  t2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 3 — vacía
  ws.addRow([]).height = 6

  // Fila 4 — Cabeceras
  const headerRow = ws.addRow(COLS.map(c => c.header))
  headerRow.height = 20
  headerRow.eachCell(cell => {
    cell.font      = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00557F' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF00557F' } },
      bottom: { style: 'thin', color: { argb: 'FF00557F' } },
      left:   { style: 'thin', color: { argb: 'FF00557F' } },
      right:  { style: 'thin', color: { argb: 'FF00557F' } },
    }
  })
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }]

  // ── Data rows grouped by category ───────────────────────────
  const cellBorderHair: Partial<ExcelJS.Border> = { style: 'hair', color: { argb: 'FFDDDDDD' } }
  const hairBorder = { top: cellBorderHair, bottom: cellBorderHair, left: cellBorderHair, right: cellBorderHair }

  for (const cat of CAT_ORDER) {
    const items = grouped[cat]
    if (!items.length) continue

    const cfg = CAT_CONFIG[cat]

    // Category separator row
    const sepRow = ws.addRow([`${cfg.label.toUpperCase()}  (${items.length} productos)`])
    ws.mergeCells(sepRow.number, 1, sepRow.number, COLS.length)
    sepRow.height = 17
    const sepCell = sepRow.getCell(1)
    sepCell.font      = { name: 'Arial', bold: true, size: 9, color: { argb: cfg.argb } }
    sepCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: cfg.bgArgb } }
    sepCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

    // Data rows
    for (let i = 0; i < items.length; i++) {
      const r   = items[i]
      const row = ws.addRow({
        categoria:   cfg.label,
        codigo:      r.codigo_modelo,
        descripcion: r.description,
        familia:     r.familia,
        metal:       r.metal,
        karat:       r.karat,
        precio:      r.precio_venta ?? '',
        precioAnt:   r.precio_tachado ?? '',
        descuento:   r.descuento_aplicado != null ? Math.round(r.descuento_aplicado) : '',
        stock:       r.stock_total,
        imagen:      r.image_url,
        nota:        r.nota_interna,
      })
      row.height = 16

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.font      = { name: 'Arial', size: 9 }
        cell.border    = hairBorder
        cell.alignment = {
          vertical:   'middle',
          horizontal: col === 3 || col === 12 ? 'left' : col >= 7 && col <= 10 ? 'right' : 'left',
          wrapText:   false,
        }
        // Alternating rows
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FA' } }
        }
      })

      // Category badge: color the first cell
      const catCell = row.getCell('categoria')
      catCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: cfg.argb } }

      // Price formatting
      if (r.precio_venta != null)    row.getCell('precio').numFmt    = '#,##0.00 €'
      if (r.precio_tachado != null)  row.getCell('precioAnt').numFmt = '#,##0.00 €'
      if (r.descuento_aplicado != null && r.descuento_aplicado > 0) {
        row.getCell('descuento').numFmt = '0"%"'
      }

      // Stock highlight for "retirar" — red background if < 20
      if (cat === 'retirar') {
        const stockCell = row.getCell('stock')
        stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } }
        stockCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFC0392B' } }
      }
    }
  }

  ws.pageSetup.printTitlesRow = '4:4'

  // ── 7. Generate file ─────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const date   = today.toISOString().slice(0, 10)

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="boletin-tiendas-tq-${date}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  })
}
