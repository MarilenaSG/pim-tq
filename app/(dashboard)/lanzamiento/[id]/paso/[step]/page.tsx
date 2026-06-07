import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getFlow, stepKey, totalSteps } from '@/lib/wizardFlows'

// Paso components
import { PasoTipo }                 from '@/components/lanzamiento/PasoTipo'
import { PasoDatos }                from '@/components/lanzamiento/PasoDatos'
import { PasoDistribucion }         from '@/components/lanzamiento/PasoDistribucion'
import { PasoReferencia }           from '@/components/lanzamiento/PasoReferencia'
import { PasoCurva }                from '@/components/lanzamiento/PasoCurva'
import { PasoCampana }              from '@/components/lanzamiento/PasoCampana'
import { PasoSimulador }            from '@/components/lanzamiento/PasoSimulador'
// Drop
import { PasoMarcaDrop }            from '@/components/lanzamiento/PasoMarcaDrop'
import { PasoFamiliasDrop }         from '@/components/lanzamiento/PasoFamiliasDrop'
// Marca
import { PasoIdentidadMarca }       from '@/components/lanzamiento/PasoIdentidadMarca'
import { PasoFamiliasMarca }        from '@/components/lanzamiento/PasoFamiliasMarca'
import { PasoArquitecturaPrecios }  from '@/components/lanzamiento/PasoArquitecturaPrecios'
// Shared Drop+Marca
import { PasoPresupuesto }          from '@/components/lanzamiento/PasoPresupuesto'

import type { Lanzamiento, Tienda } from '@/types'

export default async function WizardStepPage({
  params,
}: {
  params: { id: string; step: string }
}) {
  const step = parseInt(params.step)

  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from('lanzamientos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!raw) notFound()
  const lanzamiento = raw as unknown as Lanzamiento

  const tipo  = lanzamiento.tipo ?? 'sku'
  const nSteps = totalSteps(tipo)

  if (isNaN(step) || step < 1 || step > nSteps) notFound()

  const key = stepKey(tipo, step)

  // ── Datos adicionales por key de paso ──────────────────────

  // Paso 1 — siempre Tipo
  if (key === 'tipo') {
    return <PasoTipo lanzamiento={lanzamiento} />
  }

  // ── SKU ───────────────────────────────────────────────────

  if (key === 'datos') {
    const { data: famRows } = await supabase
      .from('products')
      .select('familia')
      .not('familia', 'is', null)
      .order('familia', { ascending: true })
    const familias = Array.from(new Set((famRows ?? []).map(r => r.familia as string))).filter(Boolean)
    return <PasoDatos lanzamiento={lanzamiento} familias={familias} />
  }

  if (key === 'referencia') {
    return <PasoReferencia lanzamiento={lanzamiento} />
  }

  if (key === 'curva') {
    return <PasoCurva lanzamiento={lanzamiento} />
  }

  // ── Drop ──────────────────────────────────────────────────

  if (key === 'marca_drop') {
    return <PasoMarcaDrop lanzamiento={lanzamiento} />
  }

  if (key === 'familias_drop') {
    return <PasoFamiliasDrop lanzamiento={lanzamiento} />
  }

  // ── Marca ─────────────────────────────────────────────────

  if (key === 'identidad_marca') {
    return <PasoIdentidadMarca lanzamiento={lanzamiento} />
  }

  if (key === 'familias_marca') {
    return <PasoFamiliasMarca lanzamiento={lanzamiento} />
  }

  if (key === 'arquitectura_precios') {
    return <PasoArquitecturaPrecios lanzamiento={lanzamiento} />
  }

  // ── Compartidos ───────────────────────────────────────────

  if (key === 'distribucion') {
    const { data: tiendasRaw } = await supabase
      .from('tiendas')
      .select('*')
      .eq('activo', true)
      .eq('es_almacen', false)
      .order('cluster', { ascending: true })
      .order('nombre',  { ascending: true })
    const tiendas = (tiendasRaw ?? []) as Tienda[]
    return <PasoDistribucion lanzamiento={lanzamiento} tiendas={tiendas} step={step} />
  }

  if (key === 'campana') {
    return <PasoCampana lanzamiento={lanzamiento} step={step} />
  }

  if (key === 'presupuesto') {
    return <PasoPresupuesto lanzamiento={lanzamiento} step={step} />
  }

  if (key === 'simulador' || key === 'proyeccion') {
    return <PasoSimulador lanzamiento={lanzamiento} />
  }

  notFound()
}
