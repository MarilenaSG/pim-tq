import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q       = searchParams.get('q')?.trim()      ?? ''
  const familia = searchParams.get('familia')?.trim() ?? ''
  const metal   = searchParams.get('metal')?.trim()   ?? ''
  const vendor  = searchParams.get('vendor')?.trim()  ?? ''

  const supabase  = createServiceClient()
  const hasSearch = q || familia || metal || vendor

  // Always return filter options (cheap, used once on mount)
  const [faRes, meRes, venRes] = await Promise.all([
    supabase.from('products').select('familia').eq('is_discontinued', false).not('familia', 'is', null),
    supabase.from('products').select('metal').eq('is_discontinued', false).not('metal', 'is', null),
    supabase.from('product_shopify_data').select('shopify_vendor').not('shopify_vendor', 'is', null),
  ])

  const filterOptions = {
    familias: Array.from(new Set((faRes.data ?? []).map(r => r.familia as string))).sort(),
    metals:   Array.from(new Set((meRes.data ?? []).map(r => r.metal   as string))).sort(),
    vendors:  Array.from(new Set((venRes.data ?? []).map(r => r.shopify_vendor as string).filter(Boolean))).sort(),
  }

  if (!hasSearch) return NextResponse.json({ results: [], filterOptions })

  // Build product query
  let prodQuery = supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal, karat')
    .eq('is_discontinued', false)

  if (q)       prodQuery = prodQuery.or(`description.ilike.%${q}%,codigo_modelo.ilike.%${q}%`)
  if (familia) prodQuery = prodQuery.eq('familia', familia)
  if (metal)   prodQuery = prodQuery.eq('metal',   metal)

  const { data: prods } = await prodQuery.limit(20)
  const codes = (prods ?? []).map(p => p.codigo_modelo as string)

  if (!codes.length) return NextResponse.json({ results: [], filterOptions })

  // Shopify data (needed for title + vendor filter)
  let shopQuery = supabase
    .from('product_shopify_data')
    .select('codigo_modelo, shopify_title, shopify_vendor')
    .in('codigo_modelo', codes)
  if (vendor) shopQuery = shopQuery.eq('shopify_vendor', vendor)

  const { data: shopify } = await shopQuery
  const shopMap   = Object.fromEntries((shopify ?? []).map(r => [r.codigo_modelo, r]))
  const shopCodes = new Set((shopify ?? []).map(r => r.codigo_modelo as string))

  const results = (prods ?? [])
    .filter(p => !vendor || shopCodes.has(p.codigo_modelo as string))
    .map(p => ({
      codigo_modelo: p.codigo_modelo as string,
      description:   p.description   as string | null,
      shopify_title: shopMap[p.codigo_modelo as string]?.shopify_title  ?? null,
      familia:       p.familia        as string | null,
      metal:         p.metal          as string | null,
      karat:         p.karat          as string | null,
      vendor:        shopMap[p.codigo_modelo as string]?.shopify_vendor ?? null,
    }))

  return NextResponse.json({ results, filterOptions })
}
