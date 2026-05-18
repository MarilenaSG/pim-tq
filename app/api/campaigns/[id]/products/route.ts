import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('campaign_products')
    .select(`
      id, notas, orden, added_at, added_by, codigo_modelo,
      products(codigo_modelo, description, familia, metal, abc_ventas, ingresos_12m)
    `)
    .eq('campaign_id', params.id)
    .order('added_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const codigos: string[] = Array.isArray(body.codigos) ? body.codigos : [body.codigo_modelo].filter(Boolean)
  if (!codigos.length) return NextResponse.json({ error: 'codigos requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const rows = codigos.map(c => ({
    campaign_id:   params.id,
    codigo_modelo: c,
    added_by:      null,
  }))
  const { data, error } = await supabase
    .from('campaign_products')
    .upsert(rows, { onConflict: 'campaign_id,codigo_modelo', ignoreDuplicates: true })
    .select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const codigo = searchParams.get('codigo_modelo')

  const supabase = createServiceClient()
  let query = supabase.from('campaign_products').delete().eq('campaign_id', params.id)
  if (codigo) query = query.eq('codigo_modelo', codigo)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
