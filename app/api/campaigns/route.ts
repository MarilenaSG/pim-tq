import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createAuthServerClient } from '@/lib/supabase/server'

function toSlug(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    + '-' + Date.now().toString(36)
}

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, nombre, slug, tipo, descripcion, fecha_inicio, fecha_fin, estado, color, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = createAuthServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { nombre, tipo, descripcion, narrativa, objetivos, canales, soportes, fecha_inicio, fecha_fin, estado, color } = body
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      nombre: nombre.trim(),
      slug: toSlug(nombre),
      tipo: tipo || null,
      descripcion: descripcion?.trim() || null,
      narrativa: narrativa?.trim() || null,
      objetivos: objetivos?.trim() || null,
      canales: canales?.trim() || null,
      soportes: soportes?.trim() || null,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      estado: estado || 'borrador',
      color: color || null,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
