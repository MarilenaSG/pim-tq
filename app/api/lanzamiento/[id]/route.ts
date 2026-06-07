import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/lanzamiento/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('lanzamientos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/lanzamiento/[id] — auto-save parcial
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // Campos protegidos — nunca se pueden actualizar por esta ruta
  const BLOCKED = ['id', 'created_at', 'estado']
  for (const k of BLOCKED) delete body[k]

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('lanzamientos')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, paso_actual, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/lanzamiento/[id] — solo borradores
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceClient()

  // Safety: only delete borradores
  const { data: existing } = await supabase
    .from('lanzamientos')
    .select('estado')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (existing.estado === 'confirmado') {
    return NextResponse.json({ error: 'No se pueden eliminar lanzamientos confirmados' }, { status: 403 })
  }

  const { error } = await supabase.from('lanzamientos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
