import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { codes } = await req.json() as { codes: string[] }
    if (!Array.isArray(codes) || codes.length === 0)
      return NextResponse.json([], { status: 200 })

    const supabase = createServiceClient()

    const [prodRes, imgRes, varRes] = await Promise.all([
      supabase
        .from('products')
        .select('codigo_modelo, description, familia, metal, karat, abc_ventas, lifecycle_status, is_discontinued')
        .in('codigo_modelo', codes),
      supabase
        .from('product_images')
        .select('codigo_modelo, url')
        .in('codigo_modelo', codes)
        .eq('is_primary', true),
      supabase
        .from('product_variants')
        .select('codigo_modelo, precio_venta, pct_margen_bruto, stock_variante')
        .in('codigo_modelo', codes),
    ])

    if (prodRes.error) throw new Error(prodRes.error.message)

    const imageMap: Record<string, string> = {}
    for (const r of imgRes.data ?? []) imageMap[r.codigo_modelo] = r.url

    const stockMap: Record<string, number> = {}
    const precioMap: Record<string, number | null> = {}
    const margenMap: Record<string, number | null> = {}
    for (const v of varRes.data ?? []) {
      stockMap[v.codigo_modelo] = (stockMap[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
      // keep highest precio_venta as representative
      if (v.precio_venta != null && (precioMap[v.codigo_modelo] == null || v.precio_venta > (precioMap[v.codigo_modelo] ?? 0))) {
        precioMap[v.codigo_modelo] = v.precio_venta
        margenMap[v.codigo_modelo] = v.pct_margen_bruto
      }
    }

    const rows = (prodRes.data ?? []).map(p => ({
      codigo_modelo:    p.codigo_modelo,
      description:      p.description,
      familia:          p.familia,
      metal:            p.metal,
      karat:            p.karat,
      abc_ventas:       p.abc_ventas,
      lifecycle_status: p.lifecycle_status ?? 'activo',
      is_discontinued:  p.is_discontinued ?? false,
      imageUrl:         imageMap[p.codigo_modelo] ?? null,
      stock_total:      stockMap[p.codigo_modelo] ?? 0,
      precio_venta:     precioMap[p.codigo_modelo] ?? null,
      pct_margen_bruto: margenMap[p.codigo_modelo] ?? null,
    }))

    // preserve original order
    const ordered = codes.map(c => rows.find(r => r.codigo_modelo === c)).filter(Boolean)
    return NextResponse.json(ordered)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
