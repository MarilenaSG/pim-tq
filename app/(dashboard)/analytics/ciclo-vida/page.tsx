import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { CicloVidaCharts } from './CicloVidaCharts'

export const dynamic = 'force-dynamic'

export type CicloEtapa = 'Nuevo' | 'Crecimiento' | 'Maduro' | 'Declive' | 'Sin datos'

function clasificarEtapa(meses: number | null, abc: string | null): CicloEtapa {
  if (meses === null) return 'Sin datos'
  if (meses < 6) return 'Nuevo'
  if (meses < 18) return abc === 'A' || abc === 'B' ? 'Crecimiento' : 'Declive'
  return abc === 'A' || abc === 'B' ? 'Maduro' : 'Declive'
}

export default async function CicloVidaPage() {
  const supabase = createServerClient()

  const { data: products } = await supabase
    .from('products')
    .select('codigo_modelo, description, familia, abc_ventas, ingresos_12m, primera_entrada, num_variantes')
    .eq('is_discontinued', false)

  const rows = products ?? []
  const now  = new Date()

  const enriched = rows.map(p => {
    const fecha  = p.primera_entrada ? new Date(p.primera_entrada as string) : null
    const meses  = fecha
      ? Math.round((now.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null
    const abc    = p.abc_ventas as string | null
    const etapa  = clasificarEtapa(meses, abc)
    return {
      codigo_modelo: p.codigo_modelo as string,
      description:   p.description as string | null,
      familia:       p.familia as string | null,
      abc,
      ingresos:      Number(p.ingresos_12m ?? 0),
      meses,
      etapa,
    }
  })

  // ── KPIs ──────────────────────────────────────────────────────
  const counts = { Nuevo: 0, Crecimiento: 0, Maduro: 0, Declive: 0, 'Sin datos': 0 }
  for (const r of enriched) counts[r.etapa]++

  // ── Scatter data ──────────────────────────────────────────────
  const scatterData = enriched
    .filter(r => r.meses !== null && r.ingresos > 0)
    .map(r => ({
      meses:       r.meses as number,
      ingresos:    Math.round(r.ingresos),
      etapa:       r.etapa,
      codigo:      r.codigo_modelo,
      description: r.description ?? r.codigo_modelo,
    }))

  // ── Distribución por etapa ────────────────────────────────────
  const etapaColors: Record<CicloEtapa, string> = {
    Nuevo:       '#3A9E6A',
    Crecimiento: '#00557f',
    Maduro:      '#C8842A',
    Declive:     '#C0392B',
    'Sin datos': '#b2b2b2',
  }
  const etapaData = (Object.keys(counts) as CicloEtapa[])
    .map(e => ({ etapa: e, count: counts[e], color: etapaColors[e] }))
    .filter(d => d.count > 0)

  // ── Anomalías: declive con ingresos altos ─────────────────────
  const totalIngresos = enriched.reduce((s, r) => s + r.ingresos, 0)
  const anomalias = enriched
    .filter(r => r.etapa === 'Declive' && r.ingresos > 0)
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 10)
    .map(r => ({
      ...r,
      pctIngresos: totalIngresos > 0 ? Math.round((r.ingresos / totalIngresos) * 1000) / 10 : 0,
    }))

  // ── Renovación: distribución de edad ─────────────────────────
  const edadBuckets = {
    '< 6 meses':    0,
    '6 – 12m':      0,
    '12 – 24m':     0,
    '24 – 36m':     0,
    '> 36 meses':   0,
    'Sin fecha':    0,
  }
  for (const r of enriched) {
    if (r.meses === null)      edadBuckets['Sin fecha']++
    else if (r.meses < 6)      edadBuckets['< 6 meses']++
    else if (r.meses < 12)     edadBuckets['6 – 12m']++
    else if (r.meses < 24)     edadBuckets['12 – 24m']++
    else if (r.meses < 36)     edadBuckets['24 – 36m']++
    else                       edadBuckets['> 36 meses']++
  }
  const edadData = Object.entries(edadBuckets).map(([rango, count]) => ({ rango, count }))

  return (
    <>
      <PageHeader
        eyebrow="Analítica"
        title="Ciclo de vida"
        subtitle="Clasificación de productos por etapa de madurez · Anomalías y renovación"
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard label="Nuevos (< 6m)"    value={counts.Nuevo}       color="green"   sub="incorporaciones recientes" />
        <KpiCard label="En crecimiento"    value={counts.Crecimiento} color="neutral" sub="6–18m, ABC A o B" />
        <KpiCard label="Maduros"           value={counts.Maduro}      color="amber"   sub="+18m, ABC A o B" />
        <KpiCard label="En declive"        value={counts.Declive}     color="red"     sub="+18m sin ventas destacadas" />
      </div>

      <CicloVidaCharts
        scatterData={scatterData}
        etapaData={etapaData}
        anomalias={anomalias}
        edadData={edadData}
        etapaColors={etapaColors}
      />
    </>
  )
}
