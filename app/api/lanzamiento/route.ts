import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/lanzamiento — listado de borradores y confirmados
export async function GET() {
  const supabase = createServerClient()

  const [borradores, confirmados] = await Promise.all([
    supabase
      .from('lanzamientos')
      .select('id, tipo, nombre, familia, metal, precio_venta, paso_actual, created_at, updated_at')
      .eq('estado', 'borrador')
      .order('updated_at', { ascending: false }),
    supabase
      .from('lanzamientos')
      .select('id, tipo, nombre, familia, metal, precio_venta, n_tiendas, output_unidades_total, output_presupuesto_compra, output_margen_proyectado, output_breakeven_semanas, fecha_lanzamiento, created_at, updated_at')
      .eq('estado', 'confirmado')
      .gte('created_at', new Date(Date.now() - 180 * 86400 * 1000).toISOString())
      .order('updated_at', { ascending: false }),
  ])

  if (borradores.error) return NextResponse.json({ error: borradores.error.message }, { status: 500 })

  return NextResponse.json({
    borradores: borradores.data ?? [],
    confirmados: confirmados.data ?? [],
  })
}

// POST /api/lanzamiento — crear nuevo borrador
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  const body = await req.json().catch(() => ({}))
  const created_by = body.created_by ?? null

  const { data, error } = await supabase
    .from('lanzamientos')
    .insert({ estado: 'borrador', paso_actual: 1, created_by })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
