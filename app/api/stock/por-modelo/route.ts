import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface VarianteDetalle {
  codigo_interno: string
  variante: string | null
  stock: number
  unidades_mes: number
}

export interface StockPorModelo {
  codigo_modelo: string
  description: string | null
  familia: string | null
  metal: string | null
  imagen: string | null
  stock_total: number
  num_variantes: number
  variantes_con_stock: number
  unidades_mes: number
  cobertura_dias: number | null
  abc_ventas: string | null
  precio_venta: number | null
  nivel: 'sin_stock' | 'bajo' | 'normal' | 'alto'
  variantes: VarianteDetalle[]
}

const TIENDAS = 19
const MIN_STOCK: Record<string, number> = { A: 3 * TIENDAS, B: 2 * TIENDAS, C: 1 * TIENDAS }
const DEFAULT_MIN = 1 * TIENDAS

// Toma el ABC más exigente entre ingresos y unidades (A > B > C)
function bestAbc(a: string | null, b: string | null): string | null {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

function nivelStock(stock: number, abc: string | null): StockPorModelo['nivel'] {
  if (stock === 0) return 'sin_stock'
  const min = MIN_STOCK[abc ?? ''] ?? DEFAULT_MIN
  if (stock < min)        return 'bajo'
  if (stock <= min * 2)   return 'normal'
  return 'alto'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const familia  = searchParams.get('familia')
  const metal    = searchParams.get('metal')
  const nivel    = searchParams.get('nivel')   // sin_stock|bajo|normal|alto
  const order    = searchParams.get('order') ?? 'stock'
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

  const supabase = createServerClient()

  let prodQuery = supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal, is_discontinued, abc_ventas, abc_unidades')
    .eq('is_discontinued', false)

  if (familia && familia !== 'all') prodQuery = prodQuery.eq('familia', familia)
  if (metal   && metal   !== 'all') prodQuery = prodQuery.eq('metal', metal)

  const prodRes = await prodQuery
  const productCodes = (prodRes.data ?? []).map(p => p.codigo_modelo as string)

  const [varRes, imgRes] = await Promise.all([
    supabase
      .from('product_variants')
      .select('codigo_modelo, codigo_interno, variante, stock_variante, unidades_mes_anterior, precio_venta, es_variante_lider')
      .in('codigo_modelo', productCodes),
    supabase
      .from('product_images')
      .select('codigo_modelo, url')
      .eq('is_primary', true)
      .in('codigo_modelo', productCodes),
  ])

  const imgMap = Object.fromEntries((imgRes.data ?? []).map(i => [i.codigo_modelo as string, i.url as string]))

  // Aggregate variants by model, keeping raw variant list
  const varAgg = new Map<string, {
    stockTotal: number; numVar: number; varConStock: number
    unidadesMes: number; precioVenta: number | null
    variantes: VarianteDetalle[]
  }>()

  for (const v of varRes.data ?? []) {
    const code  = v.codigo_modelo as string
    const stock = v.stock_variante ?? 0
    const slot  = varAgg.get(code) ?? {
      stockTotal: 0, numVar: 0, varConStock: 0, unidadesMes: 0, precioVenta: null, variantes: [],
    }
    slot.stockTotal   += stock
    slot.numVar++
    if (stock > 0) slot.varConStock++
    slot.unidadesMes  += v.unidades_mes_anterior ?? 0
    if (v.es_variante_lider && v.precio_venta != null) slot.precioVenta = v.precio_venta as number
    slot.variantes.push({
      codigo_interno: v.codigo_interno as string,
      variante:       v.variante as string | null,
      stock:          stock,
      unidades_mes:   v.unidades_mes_anterior ?? 0,
    })
    varAgg.set(code, slot)
  }

  // Sort variants within each model by stock desc
  for (const slot of varAgg.values()) {
    slot.variantes.sort((a, b) => b.stock - a.stock)
  }

  const rows: StockPorModelo[] = (prodRes.data ?? []).map(p => {
    const code  = p.codigo_modelo as string
    const agg   = varAgg.get(code) ?? { stockTotal: 0, numVar: 0, varConStock: 0, unidadesMes: 0, precioVenta: null }
    const stock = agg.stockTotal
    const dias  = agg.unidadesMes > 0 ? Math.round((stock / agg.unidadesMes) * 30) : null

    const niv = nivelStock(stock, bestAbc(p.abc_ventas as string | null, p.abc_unidades as string | null))

    return {
      codigo_modelo:       code,
      description:         p.description ?? null,
      familia:             p.familia ?? null,
      metal:               p.metal ?? null,
      imagen:              imgMap[code] ?? null,
      stock_total:         stock,
      num_variantes:       agg.numVar,
      variantes_con_stock: agg.varConStock,
      unidades_mes:        agg.unidadesMes,
      cobertura_dias:      dias,
      abc_ventas:          p.abc_ventas as string | null,
      precio_venta:        agg.precioVenta,
      nivel:               niv,
      variantes:           agg.variantes,
    }
  })

  // Filter by nivel
  const filtered = nivel && nivel !== 'all'
    ? rows.filter(r => r.nivel === nivel)
    : rows

  // Sort
  filtered.sort((a, b) => {
    if (order === 'cobertura') {
      const ca = a.cobertura_dias ?? 9999
      const cb = b.cobertura_dias ?? 9999
      return ca - cb
    }
    if (order === 'cobertura_desc') {
      const ca = a.cobertura_dias ?? 0
      const cb = b.cobertura_dias ?? 0
      return cb - ca
    }
    return b.stock_total - a.stock_total
  })

  return NextResponse.json(filtered.slice(0, limit), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
