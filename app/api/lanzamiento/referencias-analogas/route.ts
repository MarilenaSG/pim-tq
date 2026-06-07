import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/lanzamiento/referencias-analogas?familia=X&pvp=Y
 *
 * Devuelve hasta 5 productos análogos (misma familia, ±30% PVP) con su
 * serie mensual de ventas de los últimos 12 meses. Usados en Paso 4 como
 * ancla para la proyección de demanda.
 *
 * Criterios: >= 6 meses con ventas en el último año. Ordenados por media uds/mes desc.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const familia = searchParams.get('familia')
  const pvp     = parseFloat(searchParams.get('pvp') ?? '0')

  if (!familia || !pvp || pvp <= 0) {
    return NextResponse.json({ referencias: [] })
  }

  const supabase = createServerClient()

  // ── 1. Variantes líderes en la familia + ±30% PVP ───────────
  const { data: varRows, error: varErr } = await supabase
    .from('product_variants')
    .select(`
      slug,
      codigo_modelo,
      precio_venta,
      cost_price_medio,
      products!inner(description, familia)
    `)
    .eq('products.familia', familia)
    .gte('precio_venta', pvp * 0.7)
    .lte('precio_venta', pvp * 1.3)
    .eq('es_variante_lider', true)
    .not('precio_venta', 'is', null)
    .limit(500)

  if (varErr || !varRows?.length) {
    return NextResponse.json({ referencias: [] })
  }

  // Índice slug → variant info
  const varBySlug: Record<string, {
    slug: string
    codigo_modelo: string
    precio_venta: number
    cost_price_medio: number | null
    nombre: string
  }> = {}

  for (const v of varRows) {
    const prod = v.products as unknown as { description: string }
    varBySlug[v.slug] = {
      slug:             v.slug,
      codigo_modelo:    v.codigo_modelo,
      precio_venta:     v.precio_venta ?? 0,
      cost_price_medio: v.cost_price_medio,
      nombre:           prod?.description ?? v.codigo_modelo,
    }
  }

  // ── 2. Ventas últimos 24 meses (filtraremos a 12 en JS) ───────
  const slugs   = Object.keys(varBySlug)
  const minAnyo = new Date().getFullYear() - 2

  const { data: ventas, error: vErr } = await supabase
    .from('ventas_mensuales')
    .select('slug, codigo_modelo, anyo, mes, unidades_vendidas')
    .in('slug', slugs)
    .gte('anyo', minAnyo)
    .limit(20000)

  if (vErr || !ventas?.length) {
    return NextResponse.json({ referencias: [] })
  }

  // ── 3. Construir serie de últimos 12 meses ────────────────────
  const now          = new Date()
  const curYear      = now.getFullYear()
  const curMonth     = now.getMonth() + 1 // 1-12

  // Generar los 12 periodos: [{year, month, label}]
  const last12 = Array.from({ length: 12 }, (_, i) => {
    let m = curMonth - (11 - i)
    let y = curYear
    while (m <= 0) { m += 12; y -= 1 }
    const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
    return { year: y, month: m, label }
  })

  // Índice rápido: "YYYY-MM" → serie index
  const periodoIdx: Record<string, number> = {}
  last12.forEach((p, i) => {
    periodoIdx[`${p.year}-${String(p.month).padStart(2, '0')}`] = i
  })

  // Acumular ventas por slug
  const byCodigo: Record<string, {
    slug: string
    serie: number[]   // 12 slots
    tiendas: Set<string>
  }> = {}

  for (const v of ventas) {
    const slug = v.slug
    if (!varBySlug[slug]) continue
    const key = `${v.anyo}-${String(v.mes).padStart(2, '0')}`
    const idx = periodoIdx[key]
    if (idx === undefined) continue // fuera de los últimos 12 meses

    const modelo = varBySlug[slug].codigo_modelo
    if (!byCodigo[modelo]) {
      byCodigo[modelo] = { slug, serie: new Array(12).fill(0), tiendas: new Set() }
    }
    byCodigo[modelo].serie[idx] += v.unidades_vendidas ?? 0
  }

  // ── 4. Filtrar y ordenar ──────────────────────────────────────
  const referencias = Object.entries(byCodigo)
    .map(([codigo_modelo, d]) => {
      const vInfo         = varBySlug[d.slug]
      const meses_con_ventas = d.serie.filter(x => x > 0).length
      const total_uds_12m    = d.serie.reduce((s, x) => s + x, 0)
      const avg_uds_mes      = meses_con_ventas > 0
        ? Math.round((total_uds_12m / meses_con_ventas) * 10) / 10
        : 0

      const pvp_var   = vInfo?.precio_venta ?? 0
      const coste     = vInfo?.cost_price_medio ?? null
      const mb_pct    = (pvp_var > 0 && coste != null)
        ? Math.round(((pvp_var - coste) / pvp_var) * 1000) / 10
        : null

      const serie = last12.map((p, i) => ({
        label: p.label,
        uds:   d.serie[i] ?? 0,
      }))

      return {
        codigo_modelo,
        nombre:           vInfo?.nombre ?? codigo_modelo,
        precio_venta:     pvp_var,
        coste,
        mb_pct,
        avg_uds_mes,
        total_uds_12m,
        meses_con_ventas,
        serie,
      }
    })
    .filter(r => r.meses_con_ventas >= 6)        // al menos 6 meses activo
    .sort((a, b) => b.avg_uds_mes - a.avg_uds_mes)
    .slice(0, 5)

  return NextResponse.json({ referencias })
}
