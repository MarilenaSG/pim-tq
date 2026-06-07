import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PasoTipo }         from '@/components/lanzamiento/PasoTipo'
import { PasoDatos }        from '@/components/lanzamiento/PasoDatos'
import { PasoDistribucion } from '@/components/lanzamiento/PasoDistribucion'
import { PasoReferencia }   from '@/components/lanzamiento/PasoReferencia'
import { PasoCurva }        from '@/components/lanzamiento/PasoCurva'
import { PasoCampana }      from '@/components/lanzamiento/PasoCampana'
import { PasoSimulador }    from '@/components/lanzamiento/PasoSimulador'
import type { Lanzamiento, Tienda } from '@/types'

export default async function WizardStepPage({
  params,
}: {
  params: { id: string; step: string }
}) {
  const step = parseInt(params.step)
  if (isNaN(step) || step < 1 || step > 7) notFound()

  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from('lanzamientos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!raw) notFound()
  const lanzamiento = raw as unknown as Lanzamiento

  // ── Datos adicionales por paso ─────────────────────────────

  if (step === 1) {
    return <PasoTipo lanzamiento={lanzamiento} />
  }

  if (step === 2) {
    const { data: famRows } = await supabase
      .from('products')
      .select('familia')
      .not('familia', 'is', null)
      .order('familia', { ascending: true })

    const familias = Array.from(new Set((famRows ?? []).map(r => r.familia as string))).filter(Boolean)
    return <PasoDatos lanzamiento={lanzamiento} familias={familias} />
  }

  if (step === 3) {
    const { data: tiendasRaw } = await supabase
      .from('tiendas')
      .select('*')
      .eq('activo', true)
      .eq('es_almacen', false)
      .order('cluster', { ascending: true })
      .order('nombre', { ascending: true })

    const tiendas = (tiendasRaw ?? []) as Tienda[]
    return <PasoDistribucion lanzamiento={lanzamiento} tiendas={tiendas} />
  }

  if (step === 4) {
    return <PasoReferencia lanzamiento={lanzamiento} />
  }

  if (step === 5) {
    return <PasoCurva lanzamiento={lanzamiento} />
  }

  if (step === 6) {
    return <PasoCampana lanzamiento={lanzamiento} />
  }

  // Paso 7 — Simulador final
  return <PasoSimulador lanzamiento={lanzamiento} />
}
