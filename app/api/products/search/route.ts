import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const SELECT = 'codigo_modelo, description, familia, category, abc_ventas, is_discontinued'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q')?.trim() ?? ''
  const familia  = searchParams.get('familia') ?? ''
  const category = searchParams.get('category') ?? ''
  const abc      = searchParams.get('abc') ?? ''
  const vendor   = searchParams.get('vendor') ?? ''

  const supabase = createServiceClient()

  // If vendor filter, resolve matching codigo_modelo from shopify data first
  let vendorCodes: string[] | null = null
  if (vendor) {
    const { data: vd } = await supabase
      .from('product_shopify_data')
      .select('codigo_modelo')
      .eq('shopify_vendor', vendor)
    vendorCodes = (vd ?? []).map(r => r.codigo_modelo as string)
    // If vendor has no matches, return empty immediately
    if (vendorCodes.length === 0) return NextResponse.json([])
  }

  function base() {
    let q2 = supabase.from('products').select(SELECT)
    if (familia)        q2 = q2.eq('familia', familia)
    if (category)       q2 = q2.eq('category', category)
    if (abc)            q2 = q2.eq('abc_ventas', abc)
    if (vendorCodes)    q2 = q2.in('codigo_modelo', vendorCodes)
    return q2
  }

  if (!q) {
    const { data, error } = await base().order('codigo_modelo').limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(await attachVendors(supabase, data ?? []))
  }

  // Gather extra codigo_modelo matches from variants and shopify title
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

  return NextResponse.json(await attachVendors(supabase, merged))
}

async function attachVendors(supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>, products: any[]) {
  if (products.length === 0) return products
  const codes = products.map(p => p.codigo_modelo as string)
  const { data } = await supabase
    .from('product_shopify_data')
    .select('codigo_modelo, shopify_vendor')
    .in('codigo_modelo', codes)
  const vendorMap = new Map((data ?? []).map(r => [r.codigo_modelo as string, r.shopify_vendor as string | null]))
  return products.map(p => ({ ...p, shopify_vendor: vendorMap.get(p.codigo_modelo) ?? null }))
}
