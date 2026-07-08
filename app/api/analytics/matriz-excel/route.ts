import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface MatrizRow {
  codigo_modelo: string
  description: string | null
  familia: string | null
  metal: string | null
  marca: string | null
  escalon_precio: string | null
  precio_venta: number | null
  unidades_12m: number | null
  ingresos_12m: number | null
  clase_abc: string | null
  pct_margen_bruto: number | null
  margen_abc: string | null
  abc_cruzado: string | null
  num_tiendas_activo: number | null
  es_basico: boolean | null
  rol_surtido: string | null
  rol_categoria: string | null
  ciclo_vida: string | null
  dias_desde_alta: number | null
}

const SNORKEL = 'FF00557F'
const HEADER_BG = 'FF00557F'
const HEADER_FG = 'FFFFFFFF'
const ZEBRA_BG = 'FFF3F7FA'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const familia  = searchParams.get('familia')  || undefined
  const metal    = searchParams.get('metal')    || undefined
  const supplier = searchParams.get('supplier')  || undefined

  // Lectura paginada de la vista (límite 1000 filas de Supabase)
  const rows: MatrizRow[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('v_matriz_surtido')
      .select('codigo_modelo, description, familia, metal, marca, escalon_precio, precio_venta, unidades_12m, ingresos_12m, clase_abc, pct_margen_bruto, margen_abc, abc_cruzado, num_tiendas_activo, es_basico, rol_surtido, rol_categoria, ciclo_vida, dias_desde_alta')
      .order('ingresos_12m', { ascending: false, nullsFirst: false })
      .range(from, from + 999)
    if (familia)  q = q.eq('familia', familia)
    if (metal)    q = q.eq('metal', metal)
    if (supplier) q = q.eq('marca', supplier)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as MatrizRow[]))
    if (data.length < 1000) break
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'PIM Te Quiero'
  wb.created = new Date()

  // ── Hoja 1 · Catálogo (una fila por modelo) ──────────────────
  const ws = wb.addWorksheet('Análisis', {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 },
  })

  const COLS = [
    { header: 'Código',        key: 'codigo',    width: 10 },
    { header: 'Descripción',   key: 'desc',      width: 40 },
    { header: 'Familia',       key: 'familia',   width: 14 },
    { header: 'Metal',         key: 'metal',     width: 9  },
    { header: 'Marca',         key: 'marca',     width: 13 },
    { header: 'Escalón precio', key: 'escalon',  width: 13 },
    { header: 'PVP (€)',       key: 'pvp',       width: 10 },
    { header: 'Uds 12M',       key: 'uds',       width: 9  },
    { header: 'Ingresos 12M (€)', key: 'ingresos', width: 14 },
    { header: 'Clase ABC',     key: 'abc',       width: 10 },
    { header: 'Margen %',      key: 'margen',    width: 10 },
    { header: 'Margen ABC',    key: 'margenAbc', width: 11 },
    { header: 'ABC Cruzado',   key: 'cruzado',   width: 22 },
    { header: 'Tiendas activas', key: 'tiendas', width: 13 },
    { header: 'Rol surtido',   key: 'rol',       width: 20 },
    { header: 'Rol categoría', key: 'rolCat',    width: 14 },
    { header: 'Ciclo vida',    key: 'ciclo',     width: 11 },
    { header: 'Básico',        key: 'basico',    width: 8  },
    { header: 'Días desde alta', key: 'dias',    width: 12 },
  ]
  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }))

  // Fila 1 — Título
  const titleRow = ws.addRow(['Te Quiero Jewels — Análisis de rentabilidad y surtido'])
  ws.mergeCells(1, 1, 1, COLS.length)
  titleRow.height = 26
  const t1 = titleRow.getCell(1)
  t1.font = { name: 'Arial', bold: true, size: 14, color: { argb: SNORKEL } }
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEAF2' } }
  t1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 2 — Filtros + total
  const filtros = [
    familia  ? `Familia: ${familia}`   : null,
    metal    ? `Metal: ${metal}`       : null,
    supplier ? `Marca: ${supplier}`    : null,
  ].filter(Boolean)
  const metaRow = ws.addRow([
    `Generado: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}` +
    `   ·   ${rows.length} modelos${filtros.length ? '   ·   ' + filtros.join('  ·  ') : '   ·   catálogo completo'}`,
  ])
  ws.mergeCells(2, 1, 2, COLS.length)
  metaRow.height = 15
  const t2 = metaRow.getCell(1)
  t2.font = { name: 'Arial', size: 9, color: { argb: 'FF888888' } }
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEAF2' } }
  t2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 3 — Cabeceras
  const headerRow = ws.addRow(COLS.map(c => c.header))
  headerRow.height = 20
  headerRow.eachCell(cell => {
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: HEADER_FG } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  // Datos
  rows.forEach((r, i) => {
    const row = ws.addRow({
      codigo:   r.codigo_modelo,
      desc:     r.description ?? '',
      familia:  r.familia ?? '',
      metal:    r.metal ?? '',
      marca:    r.marca ?? '',
      escalon:  r.escalon_precio ?? '',
      pvp:      r.precio_venta ?? null,
      uds:      r.unidades_12m ?? 0,
      ingresos: r.ingresos_12m ?? 0,
      abc:      r.clase_abc ?? '',
      margen:   r.pct_margen_bruto != null ? r.pct_margen_bruto : null,
      margenAbc: r.margen_abc ?? '',
      cruzado:  r.abc_cruzado ?? '',
      tiendas:  r.num_tiendas_activo ?? null,
      rol:      r.rol_surtido ?? '',
      rolCat:   r.rol_categoria ?? '',
      ciclo:    r.ciclo_vida ?? '',
      basico:   r.es_basico ? 'Sí' : '',
      dias:     r.dias_desde_alta ?? null,
    })
    row.font = { name: 'Arial', size: 10 }
    if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } } })
    row.getCell('pvp').numFmt = '#,##0.00'
    row.getCell('ingresos').numFmt = '#,##0'
    row.getCell('margen').numFmt = '0.0%'
    row.getCell('uds').numFmt = '#,##0'
    row.getCell('pvp').alignment = { horizontal: 'right' }
    row.getCell('ingresos').alignment = { horizontal: 'right' }
    row.getCell('margen').alignment = { horizontal: 'right' }
    row.getCell('uds').alignment = { horizontal: 'right' }
    row.getCell('tiendas').alignment = { horizontal: 'center' }
  })

  // Autofiltro sobre la cabecera
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COLS.length } }

  // ── Hoja 2 · Resumen (distribuciones) ────────────────────────
  const rs = wb.addWorksheet('Resumen')
  rs.columns = [{ width: 28 }, { width: 12 }, { width: 12 }]

  const addDist = (titulo: string, counts: Map<string, number>, order?: string[]) => {
    const head = rs.addRow([titulo, 'Nº modelos', '% del total'])
    head.font = { name: 'Arial', bold: true, size: 11, color: { argb: HEADER_FG } }
    head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } } })
    const total = Array.from(counts.values()).reduce((s, n) => s + n, 0) || 1
    const keys = order ? order.filter(k => counts.has(k)) : Array.from(counts.keys()).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    for (const k of keys) {
      const n = counts.get(k) ?? 0
      const row = rs.addRow([k, n, n / total])
      row.getCell(3).numFmt = '0.0%'
      row.font = { name: 'Arial', size: 10 }
    }
    rs.addRow([])
  }

  const count = (field: keyof MatrizRow) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = (r[field] as string | null) ?? '—'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }

  const titleR = rs.addRow(['Resumen del análisis'])
  rs.mergeCells(1, 1, 1, 3)
  titleR.getCell(1).font = { name: 'Arial', bold: true, size: 13, color: { argb: SNORKEL } }
  rs.addRow([`${rows.length} modelos${filtros.length ? ' · ' + filtros.join(' · ') : ' · catálogo completo'}`])
    .getCell(1).font = { name: 'Arial', size: 9, color: { argb: 'FF888888' } }
  rs.addRow([])

  addDist('Rol de surtido', count('rol_surtido'),
    ['Core', 'Extendido', 'Cola larga (C)', 'Test/Local', 'Revisar (sin venta 12M)'])
  addDist('ABC Cruzado', count('abc_cruzado'),
    ['Estrella', 'Motor de tráfico', 'Gancho bajo margen', 'Joya oculta', 'Núcleo estable',
     'Revisar precio/coste', 'Nicho rentable', 'Cola larga aceptable', 'Candidato a descatalogar',
     'Sin venta 12M', 'Sin dato de margen'])
  addDist('Clase ABC (volumen)', count('clase_abc'), ['A', 'B', 'C', 'Sin venta'])
  addDist('Margen ABC (tercil)', count('margen_abc'), ['A', 'B', 'C', '—'])
  addDist('Rol de categoría', count('rol_categoria'), ['Destino', 'Rutina', 'Ocasional', 'Conveniencia'])

  const buffer = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="matriz-surtido-tq-${date}.xlsx"`,
    },
  })
}
