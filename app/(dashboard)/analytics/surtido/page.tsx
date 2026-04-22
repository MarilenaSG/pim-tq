import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { SurtidoCharts } from './SurtidoCharts'

export const dynamic = 'force-dynamic'

export default async function SurtidoPage() {
  const supabase = createServerClient()

  const { data: products } = await supabase
    .from('products')
    .select('codigo_modelo, familia, category, metal, num_variantes, ingresos_12m, abc_ventas')
    .eq('is_discontinued', false)
    .not('familia', 'is', null)

  const rows = products ?? []

  // ── KPIs ──────────────────────────────────────────────────────
  const totalModelos   = rows.length
  const familias       = Array.from(new Set(rows.map(r => r.familia as string).filter(Boolean)))
  const totalFamilias  = familias.length
  const totalVariantes = rows.reduce((s, r) => s + (r.num_variantes as number ?? 0), 0)
  const avgProfundidad = totalModelos > 0
    ? (totalVariantes / totalModelos).toFixed(1)
    : '0'
  const modelosA       = rows.filter(r => r.abc_ventas === 'A').length
  const pctA           = totalModelos > 0
    ? Math.round((modelosA / totalModelos) * 100)
    : 0

  // ── Amplitud: modelos por familia ────────────────────────────
  const familiaMap = new Map<string, { modelos: number; variantes: number }>()
  for (const r of rows) {
    const f = r.familia as string
    if (!f) continue
    const cur = familiaMap.get(f) ?? { modelos: 0, variantes: 0 }
    familiaMap.set(f, {
      modelos:   cur.modelos + 1,
      variantes: cur.variantes + (r.num_variantes as number ?? 0),
    })
  }
  const amplitudData = Array.from(familiaMap.entries())
    .map(([familia, d]) => ({
      familia,
      modelos:           d.modelos,
      avgVariantes:      d.modelos > 0 ? Math.round((d.variantes / d.modelos) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.modelos - a.modelos)
    .slice(0, 15)

  // ── Pareto de ingresos ───────────────────────────────────────
  const withIngresos = rows
    .filter(r => (r.ingresos_12m as number | null) != null)
    .map(r => ({
      codigo_modelo: r.codigo_modelo as string,
      ingresos:      Number(r.ingresos_12m),
      abc:           r.abc_ventas as string | null,
    }))
    .sort((a, b) => b.ingresos - a.ingresos)

  const totalIngresos = withIngresos.reduce((s, r) => s + r.ingresos, 0)
  let cumAcc = 0
  const paretoData = withIngresos.slice(0, 30).map((r, i) => {
    cumAcc += r.ingresos
    return {
      rank:     i + 1,
      codigo:   r.codigo_modelo,
      ingresos: Math.round(r.ingresos),
      pct:      totalIngresos > 0 ? Math.round((cumAcc / totalIngresos) * 100) : 0,
    }
  })

  // ── Distribución ABC ─────────────────────────────────────────
  const abcCounts = { A: 0, B: 0, C: 0, null: 0 }
  for (const r of rows) {
    const k = (r.abc_ventas as string | null) ?? 'null'
    if (k in abcCounts) (abcCounts as Record<string, number>)[k]++
  }
  const abcData = [
    { name: 'A', value: abcCounts.A,    color: '#3A9E6A' },
    { name: 'B', value: abcCounts.B,    color: '#C8842A' },
    { name: 'C', value: abcCounts.C,    color: '#C0392B' },
    { name: 'S/D', value: abcCounts.null, color: '#b2b2b2' },
  ].filter(d => d.value > 0)

  return (
    <>
      <PageHeader
        eyebrow="Analítica"
        title="Surtido"
        subtitle="Amplitud y profundidad del catálogo · Pareto de ingresos · Distribución ABC"
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Modelos activos"
          value={totalModelos.toLocaleString('es-ES')}
          color="neutral"
        />
        <KpiCard
          label="Familias"
          value={totalFamilias}
          sub="categorías de producto"
          color="blue"
        />
        <KpiCard
          label="Profundidad media"
          value={`${avgProfundidad} var/modelo`}
          sub={`${totalVariantes.toLocaleString('es-ES')} variantes en total`}
          color="amber"
        />
        <KpiCard
          label="Modelos ABC-A"
          value={`${pctA}%`}
          sub={`${modelosA} de ${totalModelos} modelos`}
          color="green"
        />
      </div>

      <SurtidoCharts
        amplitudData={amplitudData}
        paretoData={paretoData}
        abcData={abcData}
      />
    </>
  )
}
