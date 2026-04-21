import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createAuthServerClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: { codigo_modelo: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('product_comments')
    .select('id, user_email, user_name, contenido, tipo, created_at, editado')
    .eq('codigo_modelo', params.codigo_modelo)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: { codigo_modelo: string } }) {
  const auth = createAuthServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { contenido, tipo } = await req.json()
  if (!contenido?.trim()) return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('product_comments')
    .insert({
      codigo_modelo: params.codigo_modelo,
      user_id:       user.id,
      user_email:    user.email!,
      user_name:     user.email?.split('@')[0] ?? null,
      contenido:     contenido.trim(),
      tipo:          tipo || 'nota',
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { codigo_modelo: string } }) {
  const auth = createAuthServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('product_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('codigo_modelo', params.codigo_modelo)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
