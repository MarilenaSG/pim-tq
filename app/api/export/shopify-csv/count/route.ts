import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const IA_FIELD_KEYS = ['shopify_title_ia', 'shopify_description_ia', 'seo_title_ia', 'seo_desc_ia', 'tags_ia']

export const revalidate = 60

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const soloIa    = sp.get('solo_ia') !== 'false'
  const familia   = sp.get('familia') ?? ''
  const metal     = sp.get('metal') ?? ''
  const abc       = sp.get('abc') ?? ''

  try {
    const supabase = createServiceClient()

    let q = supabase
      .from('products')
      .select(`
        codigo_modelo,
        product_shopify_data(shopify_handle),
        product_custom_fields(field_key, field_value)
      `)

    if (familia) q = q.eq('familia', familia)
    if (metal)   q = q.eq('metal', metal)
    if (abc)     q = q.eq('abc_ventas', abc)

    const { data } = await q

    type Row = {
      codigo_modelo: string
      product_shopify_data: { shopify_handle: string | null } | null
      product_custom_fields: { field_key: string; field_value: string | null }[]
    }

    let products = (data ?? []) as unknown as Row[]

    if (soloIa) {
      products = products.filter(p =>
        p.product_custom_fields?.some(f => IA_FIELD_KEYS.includes(f.field_key) && f.field_value)
      )
    }

    const count = products.length
    const sinHandle = products.filter(
      p => !(p.product_shopify_data as { shopify_handle: string | null } | null)?.shopify_handle
    ).length

    return NextResponse.json({ count, sin_handle: sinHandle })
  } catch {
    return NextResponse.json({ count: 0, sin_handle: 0 })
  }
}
