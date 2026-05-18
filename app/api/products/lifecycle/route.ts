import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VALID = ['activo', 'en_revision', 'a_discontinuar', 'descatalogado'] as const

export async function PATCH(req: NextRequest) {
  try {
    const { codes, lifecycle_status } = await req.json() as { codes: string[]; lifecycle_status: string }

    if (!Array.isArray(codes) || codes.length === 0)
      return NextResponse.json({ error: 'codes requerido' }, { status: 400 })
    if (!VALID.includes(lifecycle_status as typeof VALID[number]))
      return NextResponse.json({ error: 'lifecycle_status inválido' }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('products')
      .update({ lifecycle_status, updated_at: new Date().toISOString() })
      .in('codigo_modelo', codes)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, updated: codes.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
