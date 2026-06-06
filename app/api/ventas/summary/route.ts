import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface VentasSummary {
  // YTD (año en curso)
  ytd_ingresos:    number
  ytd_unidades:    number
  ytd_meses:       number   // cuántos meses hay en el año en curso

  // Año anterior completo (comparativa)
  prev_ingresos:   number
  prev_unidades:   number

  // Mes más reciente disponible
  last_anyo:       number
  last_mes:        number
  last_ingresos:   number
  last_unidades:   number

  // Mismo mes año anterior
  lm_prev_ingresos: number
  lm_prev_unidades: number

  // Evolución mensual (últimos 18 meses)
  evolucion: { label: string; anyo: number; mes: number; ingresos: number; unidades: number }[]

  // Top 10 modelos por ingresos (12m)
  top_modelos: { codigo_modelo: string; description: string | null; ingresos_12m: number; unidades_12m: number }[]

  // Familias (12m)
  por_familia: { familia: string; ingresos: number; unidades: number; pct_ingresos: number }[]
}

const MESES_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export async function GET() {
  const supabase = createServerClient()

  // Determinar año/mes actual
  const now       = new Date()
  const curAnyo   = now.getFullYear()
  const curMes    = now.getMonth() + 1
  const prevAnyo  = curAnyo - 1

  // ── 1. Todos los datos disponibles (últimos 24 meses máx) ────
  const { data: allRows, error } = await supabase
    .from('ventas_mensuales')
    .select('slug, codigo_modelo, anyo, mes, unidades_vendidas, ingresos_netos')
    .gte('anyo', prevAnyo - 1)
    .order('anyo', { ascending: true })
    .order('mes',  { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = allRows ?? []

  // ── Helper: sum rows matching a predicate ────────────────────
  type Row = typeof rows[0]
  function sumRows(pred: (r: Row) => boolean) {
    return rows
      .filter(pred)
      .reduce(
        (acc, r) => ({
          ingresos:  acc.ingresos  + (r.ingresos_netos   ?? 0),
          unidades:  acc.unidades  + (r.unidades_vendidas ?? 0),
        }),
        { ingresos: 0, unidades: 0 }
      )
  }

  // ── 2. YTD ───────────────────────────────────────────────────
  const ytdRows = rows.filter(r => r.anyo === curAnyo)
  const ytd     = sumRows(r => r.anyo === curAnyo)
  const ytdMeses = new Set(ytdRows.map(r => r.mes)).size

  // ── 3. Año anterior completo ─────────────────────────────────
  const prev = sumRows(r => r.anyo === prevAnyo)

  // ── 4. Mes más reciente ──────────────────────────────────────
  const periodos = rows.map(r => r.anyo * 100 + r.mes)
  const lastPeriod = periodos.length ? Math.max(...periodos) : curAnyo * 100 + curMes
  const lastAnyo   = Math.floor(lastPeriod / 100)
  const lastMes    = lastPeriod % 100

  const lastM = sumRows(r => r.anyo === lastAnyo && r.mes === lastMes)
  const lmPrev = sumRows(r => r.anyo === lastAnyo - 1 && r.mes === lastMes)

  // ── 5. Evolución mensual (últimos 18 meses) ──────────────────
  const evoMap = new Map<string, { anyo: number; mes: number; ingresos: number; unidades: number }>()

  // Generar los 18 períodos hacia atrás
  const periods: { anyo: number; mes: number }[] = []
  let a = lastAnyo, m = lastMes
  for (let i = 0; i < 18; i++) {
    periods.unshift({ anyo: a, mes: m })
    m--
    if (m === 0) { m = 12; a-- }
  }

  for (const p of periods) {
    const key = `${p.anyo}-${p.mes}`
    evoMap.set(key, { anyo: p.anyo, mes: p.mes, ingresos: 0, unidades: 0 })
  }

  for (const r of rows) {
    const key = `${r.anyo}-${r.mes}`
    const slot = evoMap.get(key)
    if (slot) {
      slot.ingresos  += r.ingresos_netos   ?? 0
      slot.unidades  += r.unidades_vendidas ?? 0
    }
  }

  const evolucion = Array.from(evoMap.values()).map((v) => ({
    label:    `${MESES_ES[v.mes]} ${String(v.anyo).slice(2)}`,
    anyo:     v.anyo,
    mes:      v.mes,
    ingresos: Math.round(v.ingresos),
    unidades: v.unidades,
  }))

  // ── 6. Top 10 modelos (últimos 12 meses) ────────────────────
  const ref12 = lastAnyo * 100 + lastMes
  const cut12 = (() => {
    let a2 = lastAnyo, m2 = lastMes - 11
    while (m2 <= 0) { m2 += 12; a2-- }
    return a2 * 100 + m2
  })()

  const modelMap = new Map<string, { description: string | null; ingresos: number; unidades: number }>()
  for (const r of rows) {
    const period = r.anyo * 100 + r.mes
    if (period < cut12 || period > ref12) continue
    const key = r.codigo_modelo as string
    if (!key) continue
    const slot = modelMap.get(key) ?? { description: null, ingresos: 0, unidades: 0 }
    slot.ingresos  += r.ingresos_netos   ?? 0
    slot.unidades  += r.unidades_vendidas ?? 0
    modelMap.set(key, slot)
  }

  // Fetch descriptions
  const topCodes = Array.from(modelMap.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 10)
    .map(([k]) => k)

  const { data: prodDesc } = await supabase
    .from('products')
    .select('codigo_modelo, description')
    .in('codigo_modelo', topCodes)

  const descMap = Object.fromEntries((prodDesc ?? []).map(p => [p.codigo_modelo, p.description]))

  const top_modelos = topCodes.map((code) => ({
    codigo_modelo: code,
    description:   descMap[code] ?? null,
    ingresos_12m:  Math.round(modelMap.get(code)!.ingresos),
    unidades_12m:  modelMap.get(code)!.unidades,
  }))

  // ── 7. Por familia (12m) ─────────────────────────────────────
  // Need familia from products
  const allCodes = Array.from(new Set(
    rows
      .filter(r => {
        const p = r.anyo * 100 + r.mes
        return p >= cut12 && p <= ref12
      })
      .map(r => r.codigo_modelo as string)
      .filter(Boolean)
  ))

  let familiaMap: Record<string, string | null> = {}
  if (allCodes.length) {
    const CHUNK = 500
    for (let i = 0; i < allCodes.length; i += CHUNK) {
      const { data: fam } = await supabase
        .from('products')
        .select('codigo_modelo, familia')
        .in('codigo_modelo', allCodes.slice(i, i + CHUNK))
      for (const p of fam ?? []) familiaMap[p.codigo_modelo] = p.familia
    }
  }

  const famAgg = new Map<string, { ingresos: number; unidades: number }>()
  let total12Ingresos = 0
  for (const r of rows) {
    const period = r.anyo * 100 + r.mes
    if (period < cut12 || period > ref12) continue
    const fam = familiaMap[r.codigo_modelo as string] ?? 'Sin familia'
    const slot = famAgg.get(fam) ?? { ingresos: 0, unidades: 0 }
    slot.ingresos  += r.ingresos_netos   ?? 0
    slot.unidades  += r.unidades_vendidas ?? 0
    famAgg.set(fam, slot)
    total12Ingresos += r.ingresos_netos ?? 0
  }

  const por_familia = Array.from(famAgg.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 8)
    .map(([familia, v]) => ({
      familia,
      ingresos:     Math.round(v.ingresos),
      unidades:     v.unidades,
      pct_ingresos: total12Ingresos > 0
        ? Math.round((v.ingresos / total12Ingresos) * 1000) / 10
        : 0,
    }))

  const summary: VentasSummary = {
    ytd_ingresos:     Math.round(ytd.ingresos),
    ytd_unidades:     ytd.unidades,
    ytd_meses:        ytdMeses,
    prev_ingresos:    Math.round(prev.ingresos),
    prev_unidades:    prev.unidades,
    last_anyo:        lastAnyo,
    last_mes:         lastMes,
    last_ingresos:    Math.round(lastM.ingresos),
    last_unidades:    lastM.unidades,
    lm_prev_ingresos: Math.round(lmPrev.ingresos),
    lm_prev_unidades: lmPrev.unidades,
    evolucion,
    top_modelos,
    por_familia,
  }

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' },
  })
}
