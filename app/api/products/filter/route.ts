import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const familia   = sp.get('familia')
    const metal     = sp.get('metal')
    const abc       = sp.get('abc')
    const codigo    = sp.get('codigo')
    const codigos   = sp.get('codigos')
    const precioMin = sp.get('precio_min')
    const precioMax = sp.get('precio_max')
    const mesesMin  = sp.get('meses_min')
    const mesesMax  = sp.get('meses_max')

    const supabase = createServerClient()

    // Fast path: single código
    if (codigo) return NextResponse.json([codigo])

    // Fast path: comma-separated códigos
    if (codigos) return NextResponse.json(codigos.split(',').map(c => c.trim()).filter(Boolean))

    // Price range → join through product_variants (leader)
    if (precioMin || precioMax) {
      let q = supabase
        .from('product_variants')
        .select('codigo_modelo')
        .eq('es_variante_lider', true)
      if (precioMin) q = q.gte('precio_venta', Number(precioMin))
      if (precioMax) q = q.lte('precio_venta', Number(precioMax))
      const { data } = await q.limit(300)
      const codes = Array.from(new Set((data ?? []).map(r => r.codigo_modelo as string)))
      return NextResponse.json(codes)
    }

    // Months-in-catalog range → calculate from primera_entrada
    if (mesesMin || mesesMax) {
      const now    = new Date()
      let q = supabase.from('products').select('codigo_modelo, primera_entrada')
      const { data } = await q.limit(1000)
      const codes = (data ?? [])
        .filter(p => {
          if (!p.primera_entrada) return false
          const entrada = new Date(p.primera_entrada as string)
          const meses   = Math.floor((now.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24 * 30))
          if (mesesMin && meses < Number(mesesMin)) return false
          if (mesesMax && meses > Number(mesesMax)) return false
          return true
        })
        .map(p => p.codigo_modelo as string)
      return NextResponse.json(codes.slice(0, 300))
    }

    // Standard attribute filters
    let q = supabase.from('products').select('codigo_modelo')
    if (familia) q = q.eq('familia', familia)
    if (metal)   q = q.eq('metal',   metal)
    if (abc)     q = q.eq('abc_ventas', abc)

    const { data, error } = await q.limit(300)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data ?? []).map(r => r.codigo_modelo as string))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
