import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/lanzamiento/[id]/confirmar
 *
 * Confirma un borrador de lanzamiento: establece estado='confirmado',
 * guarda los escenarios finales y los outputs del escenario Base.
 * Solo funciona sobre borradores — los confirmados son inmutables.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null)
  const supabase = createServiceClient()

  // Verificar que es un borrador
  const { data: existing } = await supabase
    .from('lanzamientos')
    .select('id, estado')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (existing.estado === 'confirmado') {
    return NextResponse.json({ error: 'Ya está confirmado' }, { status: 409 })
  }

  const patch: Record<string, unknown> = {
    estado:     'confirmado',
    updated_at: new Date().toISOString(),
  }

  // Escenarios y outputs del escenario Base (índice 1)
  if (body?.escenarios)                        patch.escenarios                = body.escenarios
  if (body?.output_unidades_total    != null)  patch.output_unidades_total    = body.output_unidades_total
  if (body?.output_margen_proyectado != null)  patch.output_margen_proyectado = body.output_margen_proyectado
  if (body?.output_breakeven_semanas != null)  patch.output_breakeven_semanas = body.output_breakeven_semanas
  if (body?.output_presupuesto_compra != null) patch.output_presupuesto_compra = body.output_presupuesto_compra
  if (body?.output_ebitda_pct        != null)  patch.output_ebitda_pct        = body.output_ebitda_pct
  if (body?.output_payback_meses     != null)  patch.output_payback_meses     = body.output_payback_meses

  const { error } = await supabase
    .from('lanzamientos')
    .update(patch)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
