import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface VentasPorModelo {
  codigo_modelo: string
  description: string | null
  familia: string | null
  metal: string | null
  imagen: string | null
  ingresos_12m: number
  unidades_12m: number
  ingresos_prev_12m: number
  variacion_pct: number | null
  meses_con_ventas: number
  // últimos 6 meses para sparkline
  sparkline: { label: string; ingresos: number }[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const familia = searchParams.get('familia')
  const metal   = searchParams.get('metal')
  const order   = (searchParams.get('order') ?? 'ingresos') as 'ingresos' | 'unidades' | 'variacion'
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const supabase = createServerClient()

  // Determinar ventana 12m
  const now     = new Date()
  const curAnyo = now.getFullYear()
  const curMes  = now.getMonth() + 1

  function periodoAtras(meses: number) {
    let a = curAnyo, m = curMes - meses
    while (m <= 0) { m += 12; a-- }
    return a * 100 + m
  }

  const ref    = curAnyo * 100 + curMes
  const cut12  = periodoAtras(11)  // 12 meses incluyendo el actual
  const cut24  = periodoAtras(23)  // 24 meses para comparativa

  // Fetch raw ventas
  const { data: rows, error } = await supabase
    .from('ventas_mensuales')
    .select('slug, codigo_modelo, anyo, mes, ingresos_netos, unidades_vendidas')
    .gte('anyo', curAnyo - 2)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by model
  const modelAgg = new Map<string, {
    ingresos12: number; unidades12: number
    ingresosPrev12: number; unidadesPrev12: number
    mesesConVentas: number
    spark: Map<number, number>  // period → ingresos
  }>()

  for (const r of rows ?? []) {
    const code = r.codigo_modelo as string
    if (!code) continue
    const period = r.anyo * 100 + r.mes

    const slot = modelAgg.get(code) ?? {
      ingresos12: 0, unidades12: 0,
      ingresosPrev12: 0, unidadesPrev12: 0,
      mesesConVentas: 0,
      spark: new Map(),
    }

    if (period >= cut12 && period <= ref) {
      slot.ingresos12  += r.ingresos_netos   ?? 0
      slot.unidades12  += r.unidades_vendidas ?? 0
      slot.mesesConVentas++
      const sp = slot.spark.get(period) ?? 0
      slot.spark.set(period, sp + (r.ingresos_netos ?? 0))
    } else if (period >= cut24 && period < cut12) {
      slot.ingresosPrev12  += r.ingresos_netos   ?? 0
      slot.unidadesPrev12  += r.unidades_vendidas ?? 0
    }

    modelAgg.set(code, slot)
  }

  // Keep only 12m codes with actual sales
  const activeCodes = Array.from(modelAgg.entries())
    .filter(([, v]) => v.ingresos12 > 0)
    .map(([k]) => k)

  if (!activeCodes.length) return NextResponse.json([])

  // Fetch product info
  let prodQuery = supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal')
    .in('codigo_modelo', activeCodes)

  if (familia && familia !== 'all') prodQuery = prodQuery.eq('familia', familia)
  if (metal   && metal   !== 'all') prodQuery = prodQuery.eq('metal', metal)

  const { data: prods } = await prodQuery

  const prodMap = Object.fromEntries((prods ?? []).map(p => [p.codigo_modelo, p]))

  // Fetch primary images
  const filteredCodes = (prods ?? []).map(p => p.codigo_modelo as string)
  const { data: images } = await supabase
    .from('product_images')
    .select('codigo_modelo, url')
    .in('codigo_modelo', filteredCodes)
    .eq('is_primary', true)

  const imgMap = Object.fromEntries((images ?? []).map(i => [i.codigo_modelo, i.url]))

  // Build sparkline labels (last 6 months)
  const MESES_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const spark6: { period: number; label: string }[] = []
  {
    let a = curAnyo, m = curMes - 5
    for (let i = 0; i < 6; i++) {
      let a2 = a, m2 = m + i
      while (m2 <= 0) { m2 += 12; a2-- }
      while (m2 > 12) { m2 -= 12; a2++ }
      spark6.push({ period: a2 * 100 + m2, label: MESES_ES[m2] })
    }
  }

  const result: VentasPorModelo[] = filteredCodes
    .map(code => {
      const agg  = modelAgg.get(code)!
      const prod = prodMap[code]
      const varPct = agg.ingresosPrev12 > 0
        ? Math.round(((agg.ingresos12 - agg.ingresosPrev12) / agg.ingresosPrev12) * 100)
        : null

      const sparkline = spark6.map(s => ({
        label:    s.label,
        ingresos: Math.round(agg.spark.get(s.period) ?? 0),
      }))

      return {
        codigo_modelo:      code,
        description:        prod?.description ?? null,
        familia:            prod?.familia ?? null,
        metal:              prod?.metal ?? null,
        imagen:             imgMap[code] ?? null,
        ingresos_12m:       Math.round(agg.ingresos12),
        unidades_12m:       agg.unidades12,
        ingresos_prev_12m:  Math.round(agg.ingresosPrev12),
        variacion_pct:      varPct,
        meses_con_ventas:   agg.mesesConVentas,
        sparkline,
      }
    })

  // Sort
  result.sort((a, b) => {
    if (order === 'unidades')  return b.unidades_12m - a.unidades_12m
    if (order === 'variacion') {
      const av = a.variacion_pct ?? -999, bv = b.variacion_pct ?? -999
      return bv - av
    }
    return b.ingresos_12m - a.ingresos_12m
  })

  return NextResponse.json(result.slice(0, limit), {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' },
  })
}
