import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()

  const [prodRes, shopRes] = await Promise.all([
    supabase.from('products').select('familia, category'),
    supabase.from('product_shopify_data').select('shopify_vendor'),
  ])

  const uniqStr = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter(Boolean) as string[])).sort()

  return NextResponse.json({
    familias:   uniqStr((prodRes.data ?? []).map(p => p.familia)),
    categories: uniqStr((prodRes.data ?? []).map(p => p.category)),
    vendors:    uniqStr((shopRes.data ?? []).map(p => p.shopify_vendor)),
  })
}
