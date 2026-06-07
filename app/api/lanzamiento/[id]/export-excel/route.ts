import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createServerClient } from '@/lib/supabase/server'
import { calcularCurva, calcularKpis, fmtEur } from '@/lib/lanzamiento'
import type { CalcularCurvaParams } from '@/lib/lanzamiento'
import type { LanzamientoEscenario } from '@/types'

// ── Paleta TQ ─────────────────────────────────────────────────────
const NAVY   = '00557F'
const CREAM  = 'E8E3DF'
const WHITE  = 'FFFFFF'
const GOLD   = 'C8A164'
const OK     = '3A9E6A'
const WARN   = 'C8842A'
const ERR    = 'C0392B'
const LIGHT  = 'F4F2F0'

function cell(ws: ExcelJS.Worksheet, row: number, col: number) {
  return ws.getRow(row).getCell(col)
}

function styleHeader(c: ExcelJS.Cell, text: string) {
  c.value = text
  c.font  = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 11 }
  c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

function styleSubheader(c: ExcelJS.Cell, text: string) {
  c.value = text
  c.font  = { name: 'Calibri', bold: true, color: { argb: NAVY }, size: 10 }
  c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

function styleLabel(c: ExcelJS.Cell, text: string) {
  c.value = text
  c.font  = { name: 'Calibri', color: { argb: '8FA8B8' }, size: 10 }
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 }
}

function styleValue(c: ExcelJS.Cell, value: string | number | boolean | null) {
  c.value = value as ExcelJS.CellValue
  c.font  = { name: 'Calibri', bold: true, color: { argb: '00264D' }, size: 10 }
  c.alignment = { vertical: 'middle', horizontal: 'left' }
}

/**
 * POST /api/lanzamiento/[id]/export-excel
 * Genera el briefing Excel del lanzamiento con 3 hojas:
 *   1. Briefing — resumen del lanzamiento
 *   2. Escenarios — comparativa Pesimista / Base / Optimista
 *   3. Curva base — proyección semanal 16 semanas
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: lanz } = await supabase
    .from('lanzamientos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!lanz) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Escenarios y OPEX del body (estado actual del simulador, puede no estar en DB aún)
  const escenarios: LanzamientoEscenario[] = body.escenarios ?? lanz.escenarios ?? []
  const opexPersonalPct: number = body.opexPersonalPct ?? lanz.opex_personal_pct ?? 20
  const opexGastosPct:   number = body.opexGastosPct   ?? lanz.opex_gastos_pct   ?? 12

  // Escenario Base (índice 1)
  const escBase = escenarios[1] ?? escenarios[0] ?? null
  const escBaseParams = escBase?.params as unknown as CalcularCurvaParams | null

  // Curva base (16 semanas)
  const curvaSinPromo = escBaseParams ? calcularCurva(escBaseParams) : []
  const kpisBase      = escBaseParams ? calcularKpis(curvaSinPromo, escBaseParams) : null

  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Workbook ──────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'PIM Te Quiero Jewels'
  wb.created  = new Date()

  // ── Hoja 1: Briefing ──────────────────────────────────────────
  const ws1 = wb.addWorksheet('Briefing', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  })
  ws1.columns = [
    { width: 6 }, { width: 28 }, { width: 32 }, { width: 16 }, { width: 16 }, { width: 16 },
  ]

  let r = 1

  // Título
  ws1.mergeCells(r, 1, r, 6)
  const titleCell = ws1.getRow(r).getCell(1)
  titleCell.value = 'BRIEFING DE LANZAMIENTO'
  titleCell.font  = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 16 }
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws1.getRow(r).height = 36
  r++

  ws1.mergeCells(r, 1, r, 6)
  const nameCell = ws1.getRow(r).getCell(1)
  nameCell.value = lanz.nombre ?? '(Sin nombre)'
  nameCell.font  = { name: 'Calibri', bold: true, color: { argb: NAVY }, size: 14 }
  nameCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
  nameCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws1.getRow(r).height = 28
  r++

  ws1.mergeCells(r, 1, r, 6)
  const dateCell = ws1.getRow(r).getCell(1)
  dateCell.value = `Generado el ${today}`
  dateCell.font  = { name: 'Calibri', color: { argb: '8FA8B8' }, size: 9 }
  dateCell.alignment = { vertical: 'middle', horizontal: 'center' }
  r += 2

  // ── Sección: Producto
  ws1.mergeCells(r, 1, r, 6)
  styleHeader(ws1.getRow(r).getCell(1), '  PRODUCTO')
  ws1.getRow(r).height = 22
  r++

  const prodFields: [string, string | number | null][] = [
    ['Tipo de lanzamiento', lanz.tipo?.toUpperCase() ?? '—'],
    ['Familia',             lanz.familia ?? '—'],
    ['Metal',               lanz.metal ?? '—'],
    ['Marca (Shopify)',     lanz.marca ?? '—'],
    ['PVP',                 lanz.precio_venta ? fmtEur(lanz.precio_venta) : '—'],
    ['Coste unitario',      lanz.coste ? fmtEur(lanz.coste) : '—'],
    ['Margen bruto base',   lanz.precio_venta && lanz.coste
      ? `${(((lanz.precio_venta - lanz.coste) / lanz.precio_venta) * 100).toFixed(1)}%`
      : '—'],
    ['Proveedor',           lanz.proveedor ?? '—'],
    ['Fecha de lanzamiento', lanz.fecha_lanzamiento ?? '—'],
  ]

  for (const [label, value] of prodFields) {
    ws1.mergeCells(r, 1, r, 2)
    styleLabel(ws1.getRow(r).getCell(1), label)
    ws1.mergeCells(r, 3, r, 6)
    styleValue(ws1.getRow(r).getCell(3), value)
    if (r % 2 === 0) {
      ;[1, 3].forEach(c => {
        ws1.getRow(r).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
      })
    }
    ws1.getRow(r).height = 18
    r++
  }

  r++

  // ── Sección: Distribución
  ws1.mergeCells(r, 1, r, 6)
  styleHeader(ws1.getRow(r).getCell(1), '  DISTRIBUCIÓN')
  ws1.getRow(r).height = 22
  r++

  const clustersStr = Array.isArray(lanz.clusters_objetivo) && lanz.clusters_objetivo.length
    ? (lanz.clusters_objetivo as string[]).join(' + ')
    : '—'

  const distFields: [string, string | number | null][] = [
    ['Clusters',            clustersStr],
    ['Nº tiendas',          lanz.n_tiendas ?? '—'],
    ['Unidades por tienda', lanz.unidades_por_tienda ?? '—'],
    ['Referencia análoga',  lanz.referencia_analoga ?? 'Sin referencia'],
  ]

  for (const [label, value] of distFields) {
    ws1.mergeCells(r, 1, r, 2)
    styleLabel(ws1.getRow(r).getCell(1), label)
    ws1.mergeCells(r, 3, r, 6)
    styleValue(ws1.getRow(r).getCell(3), value)
    ws1.getRow(r).height = 18
    r++
  }

  r++

  // ── Sección: Campaña
  ws1.mergeCells(r, 1, r, 6)
  styleHeader(ws1.getRow(r).getCell(1), '  CAMPAÑA')
  ws1.getRow(r).height = 22
  r++

  const campFields: [string, string | number | null][] = [
    ['Tipo de campaña',     lanz.tipo_campana ?? 'Sin campaña'],
    ['Descuento promo',     lanz.descuento_promo_pct ? `${lanz.descuento_promo_pct}%` : '—'],
    ['Duración promo',      lanz.semanas_promo ? `${lanz.semanas_promo} semanas` : '—'],
    ['Notas campaña',       lanz.notas_campana ?? '—'],
  ]

  for (const [label, value] of campFields) {
    ws1.mergeCells(r, 1, r, 2)
    styleLabel(ws1.getRow(r).getCell(1), label)
    ws1.mergeCells(r, 3, r, 6)
    styleValue(ws1.getRow(r).getCell(3), value)
    ws1.getRow(r).height = 18
    r++
  }

  r++

  // ── Sección: KPIs base
  if (kpisBase) {
    ws1.mergeCells(r, 1, r, 6)
    styleHeader(ws1.getRow(r).getCell(1), '  PROYECCIÓN (ESCENARIO BASE — 16 semanas)')
    ws1.getRow(r).height = 22
    r++

    const kpiFields: [string, string, string][] = [
      ['Unidades totales 16 semanas', kpisBase.unidades_total.toLocaleString('es-ES') + ' uds', OK],
      ['Ingresos proyectados',        fmtEur(kpisBase.ingresos), NAVY],
      ['Margen bruto',                `${fmtEur(kpisBase.margen_bruto)} (${kpisBase.margen_pct.toFixed(1)}%)`,
        kpisBase.margen_pct >= 40 ? OK : kpisBase.margen_pct >= 30 ? WARN : ERR],
      ['Break-even',                  (kpisBase.breakeven_semanas ?? 99) < 99 ? `Semana ${kpisBase.breakeven_semanas}` : 'No alcanzado en 16 sem.',
        (kpisBase.breakeven_semanas ?? 99) <= 8 ? OK : WARN],
    ]

    for (const [label, value, color] of kpiFields) {
      ws1.mergeCells(r, 1, r, 2)
      styleLabel(ws1.getRow(r).getCell(1), label)
      ws1.mergeCells(r, 3, r, 6)
      const vc = ws1.getRow(r).getCell(3)
      styleValue(vc, value)
      vc.font = { ...vc.font, color: { argb: color }, size: 11, bold: true } as ExcelJS.Font
      ws1.getRow(r).height = 22
      r++
    }

    // ── Sección: Rentabilidad operativa ──────────────────────────
    r++
    ws1.mergeCells(r, 1, r, 6)
    styleHeader(ws1.getRow(r).getCell(1), '  RENTABILIDAD OPERATIVA (METODOLOGÍA RETAIL)')
    ws1.getRow(r).height = 22
    r++

    const presupuestoCompra    = (lanz.output_presupuesto_compra ?? 0) as number
    const presupuestoMarketing = (lanz.presupuesto_marketing     ?? 0) as number
    const inversionTotal       = presupuestoCompra + presupuestoMarketing
    const ebitdaPct            = kpisBase.margen_pct - opexPersonalPct - opexGastosPct
    const ingresosMensuales    = kpisBase.ingresos / 4
    const ebitdaMensual        = ingresosMensuales * (ebitdaPct / 100)
    const paybackMeses         = ebitdaMensual > 0 && inversionTotal > 0
      ? Math.round((inversionTotal / ebitdaMensual) * 10) / 10
      : null

    const opexFields: [string, string, string][] = [
      ['% Personal (s/ ventas)',        `${opexPersonalPct}%`,                               NAVY],
      ['% Gastos operativos (s/ ventas)', `${opexGastosPct}%`,                              NAVY],
      ['OPEX total',                    `${opexPersonalPct + opexGastosPct}%`,               NAVY],
      ['EBITDA % (MB − OPEX)',          `${ebitdaPct.toFixed(1)}%`,
        ebitdaPct >= 15 ? OK : ebitdaPct >= 5 ? WARN : ERR],
      ['Inversión total',               inversionTotal > 0 ? fmtEur(inversionTotal) : '—',  NAVY],
      ['  → Presupuesto compra',        presupuestoCompra > 0 ? fmtEur(presupuestoCompra) : '—', '8FA8B8'],
      ['  → Presupuesto marketing',     presupuestoMarketing > 0 ? fmtEur(presupuestoMarketing) : '—', '8FA8B8'],
      ['Payback estimado (Esc. Base)',   paybackMeses != null ? `${paybackMeses} meses` : 'Inversión no recuperable',
        paybackMeses != null ? (paybackMeses <= 6 ? OK : paybackMeses <= 12 ? WARN : ERR) : ERR],
    ]

    for (const [label, value, color] of opexFields) {
      ws1.mergeCells(r, 1, r, 2)
      styleLabel(ws1.getRow(r).getCell(1), label)
      ws1.mergeCells(r, 3, r, 6)
      const vc = ws1.getRow(r).getCell(3)
      styleValue(vc, value)
      vc.font = { ...vc.font, color: { argb: color }, size: 11, bold: true } as ExcelJS.Font
      ws1.getRow(r).height = 18
      r++
    }
  }

  // ── Hoja 2: Escenarios ────────────────────────────────────────
  if (escenarios.length > 0) {
    const ws2 = wb.addWorksheet('Escenarios')
    ws2.columns = [
      { width: 8 }, { width: 32 }, { width: 22 }, { width: 22 }, { width: 22 },
    ]

    const ESC_COLORS = [ERR, NAVY, OK]

    // Header
    ws2.mergeCells(1, 1, 1, 5)
    styleHeader(ws2.getRow(1).getCell(1), '  COMPARATIVA DE ESCENARIOS')
    ws2.getRow(1).height = 26

    // Column headers
    const headerRow = ws2.getRow(2)
    styleSubheader(headerRow.getCell(2), 'Parámetro / KPI')
    escenarios.forEach((e, i) => {
      const hc = headerRow.getCell(3 + i)
      hc.value = e.nombre
      hc.font  = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 11 }
      hc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ESC_COLORS[i] ?? NAVY } }
      hc.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws2.getRow(2).height = 24

    const presupuestoCompraEsc = (lanz.output_presupuesto_compra ?? 0) as number
    const presupuestoMktEsc    = (lanz.presupuesto_marketing     ?? 0) as number
    const inversionTotalEsc    = presupuestoCompraEsc + presupuestoMktEsc

    const escRows: [string, (p: CalcularCurvaParams, k: typeof escenarios[0]['kpis']) => string][] = [
      ['Factor de ajuste',          (p)    => `${p.factorAjustePct ?? 100}%`],
      ['Semanas de rampa',          (p)    => `${p.semanasRampa ?? 3} sem.`],
      ['Crecimiento semanal',       (p)    => `${p.crecimientoSemanalPct ?? 5}%`],
      ['Descuento promo',           (p)    => p.descuentoPct ? `${p.descuentoPct}%` : '—'],
      ['Semanas promo',             (p)    => p.semanasPromo ? `${p.semanasPromo} sem.` : '—'],
      ['─────────────────',         ()     => ''],
      ['Uds. totales 16 semanas',   (_, k) => k.unidades_total.toLocaleString('es-ES') + ' uds'],
      ['Ingresos proyectados',      (_, k) => fmtEur(k.ingresos)],
      ['Margen bruto',              (_, k) => fmtEur(k.margen_bruto)],
      ['MB %',                      (_, k) => `${k.margen_pct.toFixed(1)}%`],
      ['Break-even (semana)',        (_, k) => k.breakeven_semanas < 99 ? `Sem. ${k.breakeven_semanas}` : 'No alc.'],
      ['─────────────────',         ()     => ''],
      ['EBITDA % (MB − OPEX)',      (_, k) => {
        const ebitda = k.margen_pct - opexPersonalPct - opexGastosPct
        return `${ebitda.toFixed(1)}%`
      }],
      ['Payback inversión',         (_, k) => {
        const ebitda = k.margen_pct - opexPersonalPct - opexGastosPct
        if (ebitda <= 0 || inversionTotalEsc <= 0 || k.ingresos <= 0) return 'n/a'
        const mensual  = (k.ingresos / 4) * (ebitda / 100)
        const payback  = Math.round((inversionTotalEsc / mensual) * 10) / 10
        return `${payback} meses`
      }],
    ]

    let er = 3
    for (const [label, fn] of escRows) {
      const rowEl = ws2.getRow(er)
      styleLabel(rowEl.getCell(2), label)
      if (label.startsWith('─')) {
        ws2.mergeCells(er, 2, er, 5)
        rowEl.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
        rowEl.height = 10
      } else {
        escenarios.forEach((e, i) => {
          const p = e.params as unknown as CalcularCurvaParams
          const k = e.kpis
          const vc = rowEl.getCell(3 + i)
          vc.value = fn(p, k)
          vc.font  = { name: 'Calibri', bold: true, color: { argb: '00264D' }, size: 10 }
          vc.alignment = { horizontal: 'center', vertical: 'middle' }
          if (er % 2 === 0) {
            vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
          }
        })
        rowEl.height = 18
      }
      er++
    }
  }

  // ── Hoja 3: Curva base ────────────────────────────────────────
  if (curvaSinPromo.length > 0) {
    const ws3 = wb.addWorksheet('Curva base')
    ws3.columns = [
      { width: 14, header: 'Semana' },
      { width: 18, header: 'Unidades' },
      { width: 18, header: 'Ingresos (€)' },
      { width: 18, header: 'Margen sem. (€)' },
      { width: 22, header: 'Margen acum. (€)' },
      { width: 16, header: 'Break-even' },
    ]

    // Header row
    const hRow = ws3.getRow(1)
    ;['Semana', 'Unidades', 'Ingresos (€)', 'Margen sem. (€)', 'Margen acum. (€)', 'Break-even'].forEach((h, i) => {
      const c = hRow.getCell(i + 1)
      c.value = h
      c.font  = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 10 }
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    hRow.height = 22

    // Data rows
    curvaSinPromo.forEach((sem, i) => {
      const dRow = ws3.getRow(i + 2)
      dRow.getCell(1).value = `Semana ${sem.semana}`
      dRow.getCell(2).value = sem.unidades
      dRow.getCell(3).value = Math.round(sem.ingresos * 100) / 100
      dRow.getCell(4).value = Math.round(sem.margen * 100) / 100
      dRow.getCell(5).value = Math.round(sem.margenAcumulado * 100) / 100
      dRow.getCell(6).value = sem.breakEvenAlcanzado ? '✓ SÍ' : '—'
      if (sem.breakEvenAlcanzado) {
        dRow.getCell(6).font = { name: 'Calibri', bold: true, color: { argb: OK } }
      }
      if (i % 2 === 0) {
        for (let c = 1; c <= 6; c++) {
          dRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
        }
      }
      ;[2, 3, 4, 5].forEach(col => {
        dRow.getCell(col).alignment = { horizontal: 'right' }
      })
      dRow.height = 16
    })
  }

  // ── Generar buffer y devolver ─────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const nombre = lanz.nombre
    ? lanz.nombre.toLowerCase().replace(/\s+/g, '-').slice(0, 40)
    : lanz.id.slice(0, 8)
  const filename = `briefing-lanzamiento-${nombre}-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
