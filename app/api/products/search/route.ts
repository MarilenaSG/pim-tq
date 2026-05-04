import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const SELECT = 'codigo_modelo, description, familia, supplier_name, abc_ventas, is_discontinued'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q')?.trim() ?? ''
  const familia  = searchParams.get('familia') ?? ''
  const abc      = searchParams.get('abc') ?? ''
  const supplier = searchParams.get('supplier') ?? ''

  const supabase = createServiceClient()

  function base() {
    let q2 = supabase.from('products').select(SELECT)
    if (familia)  q2 = q2.eq('familia', familia)
    if (abc)      q2 = q2.eq('abc_ventas', abc)
    if (supplier) q2 = q2.eq('supplier_name', supplier)
    return q2
  }

  if (!q) {
    const { data, error } = await base().order('codigo_modelo').limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // Gather extra codigo_modelo matches from variants and shopify
  const [variantRes, shopifyRes] = await Promise.all([
    supabase
      .from('product_variants')
      .select('codigo_modelo')
      .or(`slug.ilike.%${q}%,codigo_interno.ilike.%${q}%`)
      .limit(100),
    supabase
      .from('product_shopify_data')
      .select('codigo_modelo')
      .ilike('shopify_title', `%${q}%`)
      .limit(100),
  ])

  const extraCodes = Array.from(new Set([
    ...(variantRes.data?.map(v => v.codigo_modelo as string) ?? []),
    ...(shopifyRes.data?.map(s => s.codigo_modelo as string) ?? []),
  ]))

  const textResult = await base()
    .or(`description.ilike.%${q}%,codigo_modelo.ilike.%${q}%`)
    .order('codigo_modelo')
    .limit(150)

  if (textResult.error) return NextResponse.json({ error: textResult.error.message }, { status: 500 })

  let codesData: typeof textResult.data = []
  if (extraCodes.length > 0) {
    const codesResult = await base()
      .in('codigo_modelo', extraCodes)
      .order('codigo_modelo')
      .limit(150)
    if (codesResult.error) return NextResponse.json({ error: codesResult.error.message }, { status: 500 })
    codesData = codesResult.data ?? []
  }

  const seen = new Set<string>()
  const merged = [...(textResult.data ?? []), ...codesData].filter(p => {
    if (seen.has(p.codigo_modelo)) return false
    seen.add(p.codigo_modelo)
    return true
  })

  return NextResponse.json(merged)
}
