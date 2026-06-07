import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { codigo_modelo: string } }
) {
  try {
    const { codigo_modelo } = params
    const body = await req.json() as Record<string, unknown>

    const allowed = ['shopify_title', 'shopify_description', 'shopify_seo_title', 'shopify_seo_desc', 'shopify_tags']
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) payload[key] = body[key]
    }

    if (Object.keys(payload).length === 1) {
      return NextResponse.json({ error: 'Sin campos válidos para actualizar' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('product_shopify_data')
      .upsert({ codigo_modelo, ...payload }, { onConflict: 'codigo_modelo' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
