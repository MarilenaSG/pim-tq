import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { codes } = await req.json() as { codes: string[] }
    if (!codes?.length) return NextResponse.json([])

    const supabase = createServiceClient()

    const [productsRes, variantsRes, imagesRes] = await Promise.all([
      supabase
        .from('products')
        .select('codigo_modelo, description, familia, metal, karat, abc_ventas, lifecycle_status, ingresos_12m')
        .in('codigo_modelo', codes),
      supabase
        .from('product_variants')
        .select('codigo_modelo, stock_variante, precio_venta, pct_margen_bruto, es_variante_lider')
        .in('codigo_modelo', codes),
      supabase
        .from('product_images')
        .select('codigo_modelo, url')
        .in('codigo_modelo', codes)
        .eq('is_primary', true),
    ])

    const products = productsRes.data  ?? []
    const variants = variantsRes.data  ?? []
    const images   = imagesRes.data    ?? []

    const imageMap = Object.fromEntries(images.map(i => [i.codigo_modelo as string, i.url as string]))

    type VarAgg = { stock: number; precio: number | null; margen: number | null }
    const varAgg = new Map<string, VarAgg>()
    for (const v of variants) {
      const code = v.codigo_modelo as string
      const cur  = varAgg.get(code) ?? { stock: 0, precio: null, margen: null }
      cur.stock += Number(v.stock_variante ?? 0)
      if (v.es_variante_lider) {
        cur.precio = v.precio_venta     != null ? Number(v.precio_venta)     : null
        cur.margen = v.pct_margen_bruto != null ? Number(v.pct_margen_bruto) : null
      }
      varAgg.set(code, cur)
    }

    const result = products.map(p => {
      const code = p.codigo_modelo as string
      const agg  = varAgg.get(code) ?? { stock: 0, precio: null, margen: null }
      return {
        codigo:          code,
        desc:            p.description as string | null,
        familia:         p.familia     as string | null,
        metal:           p.metal       as string | null,
        karat:           p.karat       as string | null,
        abc:             p.abc_ventas  as string | null,
        lifecycleStatus: (p.lifecycle_status as string) ?? 'activo',
        stockTotal:      agg.stock,
        precioVenta:     agg.precio,
        pctMargen:       agg.margen != null ? Math.round(agg.margen) : null,
        imageUrl:        imageMap[code] ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
