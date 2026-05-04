import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  // ── 1. Campaign ────────────────────────────────────────────────
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, nombre, tipo, descripcion, narrativa, objetivos, canales, soportes, fecha_inicio, fecha_fin, color')
    .eq('id', params.id)
    .single()

  if (campErr || !campaign) return new Response('Campaña no encontrada', { status: 404 })

  // ── 2. Products in campaign ─────────────────────────────────────
  const { data: campaignProducts } = await supabase
    .from('campaign_products')
    .select('codigo_modelo')
    .eq('campaign_id', params.id)
    .order('added_at', { ascending: true })

  const codes = (campaignProducts ?? []).map(cp => cp.codigo_modelo as string)
  if (!codes.length) return new Response('La campaña no tiene productos', { status: 404 })

  // ── 3. Product data ─────────────────────────────────────────────
  const [productsRes, shopifyRes, variantsRes, imagesRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, familia, metal, karat')
      .in('codigo_modelo', codes),
    supabase
      .from('product_shopify_data')
      .select('codigo_modelo, shopify_title, shopify_description, shopify_vendor, shopify_handle, shopify_tags')
      .in('codigo_modelo', codes),
    supabase
      .from('product_variants')
      .select('codigo_modelo, variante, precio_venta, precio_tachado, descuento_aplicado, es_variante_lider')
      .in('codigo_modelo', codes)
      .eq('is_discontinued', false),
    supabase
      .from('product_images')
      .select('codigo_modelo, url, is_primary, orden')
      .in('codigo_modelo', codes)
      .order('is_primary', { ascending: false })
      .order('orden',      { ascending: true }),
  ])

  const productMap = Object.fromEntries((productsRes.data ?? []).map(p => [p.codigo_modelo, p]))
  const shopifyMap = Object.fromEntries((shopifyRes.data ?? []).map(p => [p.codigo_modelo, p]))

  // Leader variant per model
  const leaderMap: Record<string, { precio_venta: number | null; precio_tachado: number | null; descuento_aplicado: number | null }> = {}
  const variantsByModel: Record<string, string[]> = {}
  for (const v of variantsRes.data ?? []) {
    const code = v.codigo_modelo as string
    if (v.es_variante_lider || !leaderMap[code]) {
      leaderMap[code] = { precio_venta: v.precio_venta, precio_tachado: v.precio_tachado, descuento_aplicado: v.descuento_aplicado }
    }
    if (v.variante) {
      if (!variantsByModel[code]) variantsByModel[code] = []
      variantsByModel[code].push(v.variante)
    }
  }

  // Up to 3 images per model
  const imagesByModel: Record<string, string[]> = {}
  for (const img of imagesRes.data ?? []) {
    const code = img.codigo_modelo as string
    if (!imagesByModel[code]) imagesByModel[code] = []
    if (imagesByModel[code].length < 3) imagesByModel[code].push(img.url as string)
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN ?? ''

  // ── 4. Build rows preserving campaign order ────────────────────
  const rows = codes.map(code => {
    const p  = productMap[code]
    const sh = shopifyMap[code]
    const lv = leaderMap[code]
    const imgs = imagesByModel[code] ?? []
    const vars = variantsByModel[code] ?? []

    // Sort sizes numerically when possible
    const sortedVars = [...vars].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b)
      return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b, 'es')
    })

    return {
      campaña:      campaign.nombre,
      fechaInicio:  fmtDate(campaign.fecha_inicio),
      fechaFin:     fmtDate(campaign.fecha_fin),
      codigo:       code,
      nombre:       sh?.shopify_title        ?? '',
      marca:        sh?.shopify_vendor        ?? '',
      metal:        p?.metal                  ?? '',
      karat:        p?.karat                  ?? '',
      familia:      p?.familia                ?? '',
      precio:       lv?.precio_venta          ?? null,
      precioAntes:  lv?.precio_tachado        ?? null,
      descuento:    lv?.descuento_aplicado    ?? null,
      descripcion:  stripHtml(sh?.shopify_description),
      tags:         Array.isArray(sh?.shopify_tags) ? (sh.shopify_tags as string[]).join(', ') : '',
      url:          sh?.shopify_handle ? `https://${shopDomain}/products/${sh.shopify_handle}` : '',
      tallas:       sortedVars.join(', '),
      imagen1:      imgs[0] ?? '',
      imagen2:      imgs[1] ?? '',
      imagen3:      imgs[2] ?? '',
    }
  })

  // ── 5. Build workbook ──────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Campaña')

  const TQ_BLUE  = 'FF00557F'
  const TQ_GOLD  = 'FFC8842A'
  const WHITE    = 'FFFFFFFF'
  const GRAY_BG  = 'FFF5F5F5'
  const LIGHT_BLUE = 'FFE8F4FB'

  // ── Metadata block ─────────────────────────────────────────────
  ws.mergeCells('A1:S1')
  const brandCell = ws.getCell('A1')
  brandCell.value = 'Te Quiero Jewels'
  brandCell.font  = { bold: true, size: 16, color: { argb: TQ_BLUE } }
  brandCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
  brandCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 30

  ws.mergeCells('A2:S2')
  const campCell = ws.getCell('A2')
  campCell.value = campaign.nombre
  campCell.font  = { bold: true, size: 13, color: { argb: TQ_BLUE } }
  campCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
  campCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(2).height = 24

  ws.mergeCells('A3:S3')
  const metaCell = ws.getCell('A3')
  const meta: string[] = []
  if (campaign.tipo)         meta.push(campaign.tipo)
  if (campaign.fecha_inicio) meta.push(`Del ${fmtDate(campaign.fecha_inicio)}`)
  if (campaign.fecha_fin)    meta.push(`al ${fmtDate(campaign.fecha_fin)}`)
  meta.push(`${codes.length} referencia${codes.length !== 1 ? 's' : ''}`)
  metaCell.value = meta.join('  ·  ')
  metaCell.font  = { size: 10, color: { argb: 'FF666666' } }
  metaCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(3).height = 18

  let nextRow = 4

  if (campaign.canales) {
    const canalesLabel = (campaign.canales as string).split(',').filter(Boolean).map((c: string) => c === 'online' ? 'Online' : 'Tiendas').join('  ·  ')
    ws.mergeCells(`A${nextRow}:S${nextRow}`)
    const canCell = ws.getCell(`A${nextRow}`)
    canCell.value = `Canales: ${canalesLabel}`
    canCell.font  = { bold: true, size: 9, color: { argb: 'FF0055FF' } }
    canCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    canCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(nextRow).height = 14
    nextRow++
  }

  if (campaign.objetivos) {
    ws.mergeCells(`A${nextRow}:S${nextRow}`)
    const objLabelCell = ws.getCell(`A${nextRow}`)
    objLabelCell.value = 'OBJETIVOS'
    objLabelCell.font  = { bold: true, size: 9, color: { argb: 'FF888888' } }
    objLabelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    objLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(nextRow).height = 14
    nextRow++

    ws.mergeCells(`A${nextRow}:S${nextRow + 1}`)
    const objCell = ws.getCell(`A${nextRow}`)
    objCell.value = campaign.objetivos
    objCell.font  = { size: 10, color: { argb: TQ_GOLD } }
    objCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    objCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 }
    ws.getRow(nextRow).height = 36
    nextRow += 2
  }

  if (campaign.soportes) {
    ws.mergeCells(`A${nextRow}:S${nextRow}`)
    const sopLabelCell = ws.getCell(`A${nextRow}`)
    sopLabelCell.value = 'SOPORTES'
    sopLabelCell.font  = { bold: true, size: 9, color: { argb: 'FF888888' } }
    sopLabelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    sopLabelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(nextRow).height = 14
    nextRow++

    ws.mergeCells(`A${nextRow}:S${nextRow + 1}`)
    const sopCell = ws.getCell(`A${nextRow}`)
    sopCell.value = campaign.soportes
    sopCell.font  = { size: 10, italic: true, color: { argb: TQ_BLUE } }
    sopCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    sopCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 }
    ws.getRow(nextRow).height = 36
    nextRow += 2
  }

  if (campaign.narrativa) {
    ws.mergeCells(`A${nextRow}:S${nextRow}`)
    const labelCell = ws.getCell(`A${nextRow}`)
    labelCell.value = 'NARRATIVA DE CAMPAÑA'
    labelCell.font  = { bold: true, size: 9, color: { argb: 'FF888888' } }
    labelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(nextRow).height = 14
    nextRow++

    ws.mergeCells(`A${nextRow}:S${nextRow + 2}`)
    const narCell = ws.getCell(`A${nextRow}`)
    narCell.value = campaign.narrativa
    narCell.font  = { size: 10, italic: true, color: { argb: TQ_BLUE } }
    narCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } }
    narCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 }
    ws.getRow(nextRow).height = 60
    nextRow += 3
  }

  // Empty separator
  ws.getRow(nextRow).height = 8
  nextRow++

  // ── Column headers ─────────────────────────────────────────────
  const COLS: { header: string; key: string; width: number }[] = [
    { header: 'Campaña',        key: 'campaña',     width: 18 },
    { header: 'Inicio',         key: 'fechaInicio', width: 14 },
    { header: 'Fin',            key: 'fechaFin',    width: 14 },
    { header: 'Código',         key: 'codigo',      width: 10 },
    { header: 'Nombre',         key: 'nombre',      width: 36 },
    { header: 'Marca',          key: 'marca',       width: 16 },
    { header: 'Metal',          key: 'metal',       width: 10 },
    { header: 'Quilates',       key: 'karat',       width: 10 },
    { header: 'Familia',        key: 'familia',     width: 14 },
    { header: 'Precio (€)',     key: 'precio',      width: 12 },
    { header: 'Antes (€)',      key: 'precioAntes', width: 12 },
    { header: '% Dto',          key: 'descuento',   width: 8  },
    { header: 'Descripción',    key: 'descripcion', width: 50 },
    { header: 'Tags',           key: 'tags',        width: 30 },
    { header: 'URL producto',   key: 'url',         width: 40 },
    { header: 'Tallas',         key: 'tallas',      width: 20 },
    { header: 'Imagen 1',       key: 'imagen1',     width: 40 },
    { header: 'Imagen 2',       key: 'imagen2',     width: 40 },
    { header: 'Imagen 3',       key: 'imagen3',     width: 40 },
  ]

  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }))

  const headerRow = ws.getRow(nextRow)
  headerRow.values = ['', ...COLS.map(c => c.header)]  // shift by 1 because columns start at A
  headerRow.values = COLS.map(c => c.header)
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, size: 10, color: { argb: WHITE } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: TQ_BLUE } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border    = { bottom: { style: 'thin', color: { argb: TQ_GOLD } } }
  })
  ws.getRow(nextRow).height = 22
  nextRow++

  // ── Data rows ─────────────────────────────────────────────────
  const border: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFEEEEEE' } }
  const cellBorder = { top: border, bottom: border, left: border, right: border }

  rows.forEach((r, i) => {
    const row = ws.getRow(nextRow + i)
    row.height = 18
    row.values = [
      r.campaña, r.fechaInicio, r.fechaFin, r.codigo, r.nombre,
      r.marca, r.metal, r.karat, r.familia,
      r.precio ?? '', r.precioAntes ?? '', r.descuento != null ? `${Math.round(r.descuento)}%` : '',
      r.descripcion, r.tags, r.url, r.tallas,
      r.imagen1, r.imagen2, r.imagen3,
    ]
    row.eachCell((cell, col) => {
      cell.border    = cellBorder
      cell.font      = { size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: col === 13 }
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }
    })
    // Price format
    if (r.precio != null)     row.getCell(10).numFmt = '#,##0.00 €'
    if (r.precioAntes != null) row.getCell(11).numFmt = '#,##0.00 €'
    // URL as hyperlink
    if (r.url) {
      const urlCell = row.getCell(15)
      urlCell.value = { text: r.url, hyperlink: r.url }
      urlCell.font  = { size: 10, color: { argb: 'FF0066CC' }, underline: true }
    }
  })

  // Freeze header area
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: nextRow - 1 }]

  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }

  const fecha = new Date().toISOString().slice(0, 10)
  const buffer = await wb.xlsx.writeBuffer()

  const safeName = campaign.nombre.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="TQ-Jewels-${safeName}-${fecha}.xlsx"`,
    },
  })
}
