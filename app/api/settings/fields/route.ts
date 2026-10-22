import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Sin esto Next 14 genera la respuesta una sola vez en el build y la sirve congelada
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('field_key, label, field_type, options')
    .eq('is_active', true)
    .order('label')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
