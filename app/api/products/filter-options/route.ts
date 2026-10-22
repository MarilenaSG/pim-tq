import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Sin esto Next 14 genera la respuesta una sola vez en el build y la sirve congelada
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()

  const { data } = await supabase.from('products').select('familia, category')

  const uniqStr = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter(Boolean) as string[])).sort()

  return NextResponse.json({
    familias:   uniqStr((data ?? []).map(p => p.familia)),
    categories: uniqStr((data ?? []).map(p => p.category)),
  })
}
