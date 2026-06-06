import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { LifecycleStatus } from '@/types'

const VALID: LifecycleStatus[] = ['activo', 'en_revision', 'a_discontinuar', 'descatalogado']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { codigo_modelo: string } }
) {
  try {
    const { lifecycle_status } = await req.json()

    if (!VALID.includes(lifecycle_status)) {
      return NextResponse.json({ error: `lifecycle_status inválido. Valores: ${VALID.join(', ')}` }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('products')
      .update({ lifecycle_status, updated_at: new Date().toISOString() })
      .eq('codigo_modelo', params.codigo_modelo)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, lifecycle_status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
