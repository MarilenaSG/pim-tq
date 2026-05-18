import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Returns string[] of codigo_modelo matching the given filter params.
// Params:
//   familia, metal, abc          → direct column filters on products
//   codigo                       → single product (returns [codigo])
//   codigos                      → comma-separated list (returns those codes)
//   precio_min, precio_max       → filter via product_variants.precio_venta (leader variant)
//   meses_min, meses_max         → filter via products.primera_entrada age range

export async function GET(req: NextRequest) {
  const sp      = req.nextUrl.searchParams
  const familia = sp.get('familia')
  const metal   = sp.get('metal')
  const abc     = sp.get('abc')
  const codigo  = sp.get('codigo')
  const codigos = sp.get('codigos')
  const precioMin  = sp.get('precio_min') ? Number(sp.get('precio_min')) : null
  const precioMax  = sp.get('precio_max') ? Number(sp.get('precio_max')) : null
  const mesesMin   = sp.get('meses_min')  ? Number(sp.get('meses_min'))  : null
  const mesesMax   = sp.get('meses_max')  ? Number(sp.get('meses_max'))  : null

  // Fast path: explicit codes
  if (codigo) return NextResponse.json([codigo])
  if (codigos) return NextResponse.json(codigos.split(',').filter(Boolean))

  const supabase = createServiceClient()

  // Price range filter → resolve via product_variants leader
  let priceCodes: string[] | null = null
  if (precioMin !== null || precioMax !== null) {
    let q = supabase.from('product_variants').select('codigo_modelo').eq('es_variante_lider', true)
    if (precioMin !== null) q = q.gte('precio_venta', precioMin)
    if (precioMax !== null) q = q.lt('precio_venta', precioMax)
    const { data } = await q
    priceCodes = (data ?? []).map(r => r.codigo_modelo as string)
    if (priceCodes.length === 0) return NextResponse.json([])
  }

  // Age range filter → resolve via products.primera_entrada
  let ageCodes: string[] | null = null
  if (mesesMin !== null || mesesMax !== null) {
    const now = new Date()
    let q = supabase.from('products').select('codigo_modelo, primera_entrada').not('primera_entrada', 'is', null)
    const { data } = await q
    ageCodes = (data ?? [])
      .filter(r => {
        const meses = Math.round((now.getTime() - new Date(r.primera_entrada as string).getTime()) / (1000 * 60 * 60 * 24 * 30))
        if (mesesMin !== null && meses < mesesMin) return false
        if (mesesMax !== null && meses >= mesesMax) return false
        return true
      })
      .map(r => r.codigo_modelo as string)
    if (ageCodes.length === 0) return NextResponse.json([])
  }

  // Main products query
  let q = supabase.from('products').select('codigo_modelo').eq('is_discontinued', false)
  if (familia) q = q.eq('familia', familia)
  if (metal)   q = q.eq('metal', metal)
  if (abc)     q = q.eq('abc_ventas', abc)

  // Intersect with price/age codes if needed
  const intersect = [priceCodes, ageCodes].filter(Boolean) as string[][]
  if (intersect.length > 0) {
    let allowed = new Set(intersect[0])
    for (const arr of intersect.slice(1)) allowed = new Set(arr.filter(c => allowed.has(c)))
    q = q.in('codigo_modelo', Array.from(allowed))
  }

  const { data, error } = await q.order('codigo_modelo').limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(r => r.codigo_modelo as string))
}
