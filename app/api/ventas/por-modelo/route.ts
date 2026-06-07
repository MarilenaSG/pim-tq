import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface VentasPorModelo {
  codigo_modelo:     string
  description:       string | null
  familia:           string | null
  metal:             string | null
  imagen:            string | null
  ingresos_12m:      number
  unidades_12m:      number
  ingresos_prev_12m: number
  variacion_pct:     number | null
  meses_con_ventas:  number
  sparkline:         { label: string; ingresos: number }[]
}

const MESES_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function periodoAtras(curAnyo: number, curMes: number, meses: number) {
  let a = curAnyo, m = curMes - meses
  while (m <= 0) { m += 12; a-- }
  return { anyo: a, mes: m }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const familia = searchParams.get('familia')
  const metal   = searchParams.get('metal')
  const order   = (searchParams.get('order') ?? 'ingresos') as 'ingresos' | 'unidades' | 'variacion'
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 440)

  const supabase = createServerClient()

  const now     = new Date()
  const curAnyo = now.getFullYear()
  const curMes  = now.getMonth() + 1

  const p12    = periodoAtras(curAnyo, curMes, 11)   // inicio 12m actual
  const pPrev  = periodoAtras(curAnyo, curMes, 23)   // inicio 12m anterior
  const pSpark = periodoAtras(curAnyo, curMes, 11)   // inicio sparkline 12m

  // ── RPC: agrega en BD, filtra al catálogo actual ──────────────────────
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('ventas_por_modelo', {
    p_anyo_12_desde:   p12.anyo,
    p_mes_12_desde:    p12.mes,
    p_anyo_hasta:      curAnyo,
    p_mes_hasta:       curMes,
    p_anyo_prev_desde: pPrev.anyo,
    p_mes_prev_desde:  pPrev.mes,
    p_anyo_spark_desde: pSpark.anyo,
    p_mes_spark_desde:  pSpark.mes,
  })

  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

  const rows = rpcRows ?? []
  if (rows.length === 0) return NextResponse.json([])

  // ── Enriquecer con datos de producto e imagen ─────────────────────────
  let allCodes = rows.map((r: { codigo_modelo: string }) => r.codigo_modelo)

  // Filtrar por familia / metal si se pidió
  if ((familia && familia !== 'all') || (metal && metal !== 'all')) {
    let prodQuery = supabase
      .from('products')
      .select('codigo_modelo')
      .in('codigo_modelo', allCodes)
    if (familia && familia !== 'all') prodQuery = prodQuery.eq('familia', familia)
    if (metal   && metal   !== 'all') prodQuery = prodQuery.eq('metal',   metal)
    const { data: filtered } = await prodQuery
    const filteredSet = new Set((filtered ?? []).map(p => p.codigo_modelo as string))
    allCodes = allCodes.filter((c: string) => filteredSet.has(c))
  }

  const topCodes = allCodes.slice(0, limit)

  const [prodsRes, imgsRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, description, familia, metal')
      .in('codigo_modelo', topCodes),
    supabase
      .from('product_images')
      .select('codigo_modelo, url')
      .in('codigo_modelo', topCodes)
      .eq('is_primary', true),
  ])

  const prodMap = Object.fromEntries((prodsRes.data ?? []).map(p => [p.codigo_modelo, p]))
  const imgMap  = Object.fromEntries((imgsRes.data  ?? []).map(i => [i.codigo_modelo, i.url]))

  // Sparkline: construir los 12 puntos ordenados con labels
  const spark6Periods: { period: number; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const p = periodoAtras(curAnyo, curMes, 11 - i)
    spark6Periods.push({ period: p.anyo * 100 + p.mes, label: `${MESES_ES[p.mes]} ${String(p.anyo).slice(2)}` })
  }

  const codeSet = new Set(topCodes)

  const result: VentasPorModelo[] = rows
    .filter((r: { codigo_modelo: string }) => codeSet.has(r.codigo_modelo))
    .map((r: {
      codigo_modelo: string
      ingresos_12m: number
      unidades_12m: number
      ingresos_prev_12m: number
      meses_con_ventas: number
      spark_json: { period: number; ingresos: number }[]
    }) => {
      const prod  = prodMap[r.codigo_modelo]
      const sparkMap = new Map((r.spark_json ?? []).map(s => [s.period, s.ingresos]))

      const varPct = Number(r.ingresos_prev_12m) > 0
        ? Math.round(((Number(r.ingresos_12m) - Number(r.ingresos_prev_12m)) / Number(r.ingresos_prev_12m)) * 100)
        : null

      return {
        codigo_modelo:     r.codigo_modelo,
        description:       prod?.description ?? null,
        familia:           prod?.familia     ?? null,
        metal:             prod?.metal       ?? null,
        imagen:            imgMap[r.codigo_modelo] ?? null,
        ingresos_12m:      Math.round(Number(r.ingresos_12m)),
        unidades_12m:      Number(r.unidades_12m),
        ingresos_prev_12m: Math.round(Number(r.ingresos_prev_12m)),
        variacion_pct:     varPct,
        meses_con_ventas:  Number(r.meses_con_ventas),
        sparkline: spark6Periods.map(s => ({
          label:    s.label,
          ingresos: Math.round(sparkMap.get(s.period) ?? 0),
        })),
      }
    })

  // Ordenar
  result.sort((a, b) => {
    if (order === 'unidades')  return b.unidades_12m - a.unidades_12m
    if (order === 'variacion') {
      const av = a.variacion_pct ?? -999, bv = b.variacion_pct ?? -999
      return bv - av
    }
    return b.ingresos_12m - a.ingresos_12m
  })

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' },
  })
}
