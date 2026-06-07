import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/lanzamiento/velocidad-ventas?familia=X&pvp=Y
 * Devuelve la media mensual de unidades de productos similares (misma familia, ±30% PVP).
 * Se usa en Paso 3 para validar si el pedido inicial es razonable.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const familia = searchParams.get('familia')
  const pvp     = parseFloat(searchParams.get('pvp') ?? '0')

  if (!familia || !pvp || pvp <= 0) {
    return NextResponse.json({ media: null, n: 0 })
  }

  const supabase = createServerClient()

  // 1. Obtener slugs de variantes líderes en la familia + ±30% precio
  const { data: varRows, error: varErr } = await supabase
    .from('product_variants')
    .select('slug, products!inner(familia)')
    .eq('products.familia', familia)
    .gte('precio_venta', pvp * 0.7)
    .lte('precio_venta', pvp * 1.3)
    .eq('es_variante_lider', true)
    .limit(500)

  if (varErr || !varRows?.length) {
    return NextResponse.json({ media: null, n: 0 })
  }

  const slugs = varRows.map(r => r.slug).filter(Boolean) as string[]

  // 2. Ventas de los últimos 12 meses
  const minAnyo = new Date().getFullYear() - 1

  const { data: ventas, error: vErr } = await supabase
    .from('ventas_mensuales')
    .select('slug, unidades_vendidas')
    .in('slug', slugs)
    .gte('anyo', minAnyo)
    .limit(5000)

  if (vErr || !ventas?.length) {
    return NextResponse.json({ media: null, n: 0 })
  }

  // 3. Media mensual por slug → media de medias
  const bySlug: Record<string, number[]> = {}
  for (const v of ventas) {
    if (!bySlug[v.slug]) bySlug[v.slug] = []
    bySlug[v.slug].push(v.unidades_vendidas ?? 0)
  }

  const medias = Object.values(bySlug).map(
    arr => arr.reduce((s, x) => s + x, 0) / arr.length,
  )

  if (!medias.length) return NextResponse.json({ media: null, n: 0 })

  const media = medias.reduce((s, m) => s + m, 0) / medias.length

  return NextResponse.json({
    media: Math.round(media * 10) / 10,
    n:     medias.length,
  })
}
