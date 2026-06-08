import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export type Periodo = '12m' | 'ytd' | 'mtd'

export interface VentasSummary {
  periodo:          Periodo
  ytd_ingresos:     number
  ytd_unidades:     number
  ytd_meses:        number
  prev_ingresos:    number
  prev_unidades:    number
  last_anyo:        number
  last_mes:         number
  last_ingresos:    number
  last_unidades:    number
  lm_prev_ingresos: number
  lm_prev_unidades: number
  evolucion: {
    label:    string
    anyo:     number
    mes:      number
    ingresos: number
    unidades: number
    coste:    number
    ticket:   number
  }[]
  top_modelos: { codigo_modelo: string; description: string | null; ingresos_12m: number; unidades_12m: number }[]
  por_familia: { familia: string; ingresos: number; unidades: number; pct_ingresos: number }[]
}

const MESES_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function periodoAtras(curAnyo: number, curMes: number, meses: number) {
  let a = curAnyo, m = curMes - meses
  while (m <= 0) { m += 12; a-- }
  return { anyo: a, mes: m }
}

function cutFromPeriodo(periodo: Periodo, curAnyo: number, curMes: number) {
  switch (periodo) {
    case 'ytd': return { anyo: curAnyo, mes: 1 }
    case 'mtd': return { anyo: curAnyo, mes: curMes }
    default:    return periodoAtras(curAnyo, curMes, 11) // 12m
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const periodo = (searchParams.get('periodo') ?? '12m') as Periodo

  const supabase = createServerClient()

  const now      = new Date()
  const curAnyo  = now.getFullYear()
  const curMes   = now.getMonth() + 1
  const prevAnyo = curAnyo - 1

  const cutFrom  = cutFromPeriodo(periodo, curAnyo, curMes)
  const cutTo    = { anyo: curAnyo, mes: curMes }

  // Evolucion 30 meses — 12 meses extra para la línea comparativa año anterior
  const evo30start = periodoAtras(curAnyo, curMes, 29)

  const [kpisRes, evoRes, topRes, famRes] = await Promise.all([
    supabase.rpc('ventas_kpis', {
      p_cur_anyo:  curAnyo,
      p_cur_mes:   curMes,
      p_prev_anyo: prevAnyo,
    }),
    supabase.rpc('ventas_evolucion', {
      p_anyo_desde: evo30start.anyo,
      p_mes_desde:  evo30start.mes,
      p_anyo_hasta: curAnyo,
      p_mes_hasta:  curMes,
    }),
    supabase.rpc('ventas_top_modelos', {
      p_anyo_desde: cutFrom.anyo,
      p_mes_desde:  cutFrom.mes,
      p_anyo_hasta: cutTo.anyo,
      p_mes_hasta:  cutTo.mes,
      p_limit:      10,
    }),
    supabase.rpc('ventas_por_familia', {
      p_anyo_desde: cutFrom.anyo,
      p_mes_desde:  cutFrom.mes,
      p_anyo_hasta: cutTo.anyo,
      p_mes_hasta:  cutTo.mes,
      p_limit:      8,
    }),
  ])

  if (kpisRes.error) return NextResponse.json({ error: kpisRes.error.message }, { status: 500 })
  if (evoRes.error)  return NextResponse.json({ error: evoRes.error.message  }, { status: 500 })
  if (topRes.error)  return NextResponse.json({ error: topRes.error.message  }, { status: 500 })
  if (famRes.error)  return NextResponse.json({ error: famRes.error.message  }, { status: 500 })

  const kpis = kpisRes.data?.[0] ?? {}

  // Evolucion: 18 meses con ticket medio por mes
  const evoByPeriod = new Map<number, { ingresos: number; unidades: number; coste: number }>()
  for (const r of evoRes.data ?? []) {
    evoByPeriod.set(r.anyo * 100 + r.mes, {
      ingresos: Math.round(Number(r.ingresos_netos  ?? 0)),
      unidades: Number(r.unidades_vendidas ?? 0),
      coste:    Math.round(Number(r.coste_total     ?? 0)),
    })
  }

  const evolucion: VentasSummary['evolucion'] = []
  for (let i = 29; i >= 0; i--) {
    const p    = periodoAtras(curAnyo, curMes, i)
    const slot = evoByPeriod.get(p.anyo * 100 + p.mes) ?? { ingresos: 0, unidades: 0, coste: 0 }
    evolucion.push({
      label:    `${MESES_ES[p.mes]} ${String(p.anyo).slice(2)}`,
      anyo:     p.anyo,
      mes:      p.mes,
      ingresos: slot.ingresos,
      unidades: slot.unidades,
      coste:    slot.coste,
      ticket:   slot.unidades > 0 ? Math.round(slot.ingresos / slot.unidades * 100) / 100 : 0,
    })
  }

  // Top modelos: descripción desde products
  const topCodes = (topRes.data ?? []).map((r: { codigo_modelo: string }) => r.codigo_modelo)
  let descMap: Record<string, string | null> = {}
  if (topCodes.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('codigo_modelo, description')
      .in('codigo_modelo', topCodes)
    descMap = Object.fromEntries((prods ?? []).map(p => [p.codigo_modelo, p.description]))
  }

  const top_modelos = (topRes.data ?? []).map((r: { codigo_modelo: string; ingresos_12m: number; unidades_12m: number }) => ({
    codigo_modelo: r.codigo_modelo,
    description:   descMap[r.codigo_modelo] ?? null,
    ingresos_12m:  Math.round(Number(r.ingresos_12m ?? 0)),
    unidades_12m:  Number(r.unidades_12m ?? 0),
  }))

  const por_familia = (famRes.data ?? []).map((r: { familia: string; ingresos: number; unidades: number; pct_ingresos: number }) => ({
    familia:      r.familia,
    ingresos:     Math.round(Number(r.ingresos ?? 0)),
    unidades:     Number(r.unidades ?? 0),
    pct_ingresos: Number(r.pct_ingresos ?? 0),
  }))

  const summary: VentasSummary = {
    periodo,
    ytd_ingresos:     Math.round(Number(kpis.ytd_ingresos      ?? 0)),
    ytd_unidades:     Number(kpis.ytd_unidades      ?? 0),
    ytd_meses:        Number(kpis.ytd_meses          ?? 0),
    prev_ingresos:    Math.round(Number(kpis.prev_ingresos      ?? 0)),
    prev_unidades:    Number(kpis.prev_unidades      ?? 0),
    last_anyo:        Number(kpis.last_anyo           ?? curAnyo),
    last_mes:         Number(kpis.last_mes            ?? curMes),
    last_ingresos:    Math.round(Number(kpis.last_ingresos      ?? 0)),
    last_unidades:    Number(kpis.last_unidades      ?? 0),
    lm_prev_ingresos: Math.round(Number(kpis.lm_prev_ingresos   ?? 0)),
    lm_prev_unidades: Number(kpis.lm_prev_unidades   ?? 0),
    evolucion,
    top_modelos,
    por_familia,
  }

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
