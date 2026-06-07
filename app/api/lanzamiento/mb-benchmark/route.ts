import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { MbBenchmark } from '@/types'

// GET /api/lanzamiento/mb-benchmark?familia=X&pvp=Y
// Devuelve min/media/max MB histórico para productos similares (misma familia, precio ±30%)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const familia = searchParams.get('familia')
  const pvp     = parseFloat(searchParams.get('pvp') ?? '')

  if (!familia || isNaN(pvp) || pvp <= 0) {
    return NextResponse.json({ mb_medio: null, mb_min: null, mb_max: null, n: 0 } satisfies MbBenchmark)
  }

  const supabase = createServerClient()

  // Fetch variants of the same family in a ±30% price range that have cost data
  const { data: rows } = await supabase
    .from('product_variants')
    .select(`
      precio_venta,
      cost_price_medio,
      products!inner(familia)
    `)
    .eq('products.familia', familia)
    .gte('precio_venta', pvp * 0.7)
    .lte('precio_venta', pvp * 1.3)
    .not('cost_price_medio', 'is', null)
    .not('precio_venta',     'is', null)

  if (!rows || rows.length === 0) {
    return NextResponse.json({ mb_medio: null, mb_min: null, mb_max: null, n: 0 } satisfies MbBenchmark)
  }

  type Row = { precio_venta: number; cost_price_medio: number }
  const valid = (rows as unknown as Row[]).filter(
    r => r.precio_venta > 0 && r.cost_price_medio != null,
  )

  if (valid.length === 0) {
    return NextResponse.json({ mb_medio: null, mb_min: null, mb_max: null, n: 0 } satisfies MbBenchmark)
  }

  const mbs     = valid.map(r => ((r.precio_venta - r.cost_price_medio) / r.precio_venta) * 100)
  const mb_medio = mbs.reduce((a, b) => a + b, 0) / mbs.length
  const mb_min   = Math.min(...mbs)
  const mb_max   = Math.max(...mbs)

  return NextResponse.json({
    mb_medio: Math.round(mb_medio * 10) / 10,
    mb_min:   Math.round(mb_min   * 10) / 10,
    mb_max:   Math.round(mb_max   * 10) / 10,
    n:        valid.length,
  } satisfies MbBenchmark)
}
