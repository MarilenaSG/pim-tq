import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PasoTipo }         from '@/components/lanzamiento/PasoTipo'
import { PasoDatos }        from '@/components/lanzamiento/PasoDatos'
import { PasoDistribucion } from '@/components/lanzamiento/PasoDistribucion'
import { PasoReferencia }   from '@/components/lanzamiento/PasoReferencia'
import { PasoCurva }        from '@/components/lanzamiento/PasoCurva'
import { PasoCampana }      from '@/components/lanzamiento/PasoCampana'
import type { Lanzamiento } from '@/types'

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
    return <PasoDistribucion lanzamiento={lanzamiento} />
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

  // Paso 7 — se construye en sesión 4
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="text-4xl opacity-30">🚧</div>
      <p className="text-sm font-semibold" style={{ color: '#8fa8b8' }}>
        Paso 7 — Simulador final · próximamente en sesión 4
      </p>
      <a
        href={`/lanzamiento/${params.id}/paso/6`}
        className="text-sm underline"
        style={{ color: '#0099f2' }}
      >
        ← Volver al paso 6
      </a>
    </div>
  )
}
