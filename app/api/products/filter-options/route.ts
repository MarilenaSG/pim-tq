import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('products')
    .select('familia, supplier_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uniq = (field: 'familia' | 'supplier_name') =>
    Array.from(new Set((data ?? []).map(p => p[field]).filter(Boolean) as string[])).sort()

  return NextResponse.json({
    familias:  uniq('familia'),
    suppliers: uniq('supplier_name'),
  })
}
