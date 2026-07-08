import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { SurtidoCharts } from './SurtidoCharts'
import { RolSurtidoBars, type RolSurtidoDatum } from './RolSurtidoBars'

export const dynamic = 'force-dynamic'

const ROL_ORDER: RolSurtidoDatum[] = [
  { rol: 'Core',             count: 0, color: '#3A9E6A' },
  { rol: 'Extendido',        count: 0, color: '#0099f2' },
  { rol: 'Cola larga (C)',   count: 0, color: '#C8842A' },
  { rol: 'Test/Local',       count: 0, color: '#00557f' },
  { rol: 'Revisar (sin venta 12M)', count: 0, color: '#C0392B' },
]

export interface HeatmapData {
  familias: string[]
  metales:  string[]
  cells:    Record<string, Record<string, { count: number; ingresos: number }>>
}

export default async function SurtidoPage({ searchParams }: { searchParams: { familia?: string; metal?: string; supplier?: string } }) {
  const supabase = createServerClient()
  const { familia, metal, supplier } = searchParams

  let query = supabase
    .from('products')
    .select('codigo_modelo, familia, category, metal, num_variantes, ingresos_12m, abc_ventas')
    .neq('is_discontinued', true)
    .not('familia', 'is', null)

  if (familia)   query = query.eq('familia', familia)
  if (metal)     query = query.eq('metal', metal)
  if (supplier)  query = query.eq('shopify_vendor', supplier)

  const { data: products } = await query

  const rows = products ?? []

  // ── Distribución rol de surtido (vista v_matriz_surtido) ──────
  const rolCounts = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    let rq = supabase
      .from('v_matriz_surtido')
      .select('rol_surtido')
      .range(from, from + 999)
    if (familia)  rq = rq.eq('familia', familia)
    if (metal)    rq = rq.eq('metal', metal)
    if (supplier) rq = rq.eq('marca', supplier)
    const { data } = await rq
    if (!data || data.length === 0) break
    for (const r of data) {
      const k = (r.rol_surtido as string | null) ?? '—'
      rolCounts.set(k, (rolCounts.get(k) ?? 0) + 1)
    }
    if (data.length < 1000) break
  }
  const rolSurtidoData: RolSurtidoDatum[] = ROL_ORDER.map(d => ({ ...d, count: rolCounts.get(d.rol) ?? 0 }))

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

  // ── Heat map familia × metal ──────────────────────────────────
  const allMetales = Array.from(new Set(
    rows.map(r => r.metal as string | null).filter(Boolean) as string[]
  )).sort()

  const heatCells: Record<string, Record<string, { count: number; ingresos: number }>> = {}
  for (const r of rows) {
    const f = r.familia as string
    const m = (r.metal as string | null) ?? 'N/A'
    if (!heatCells[f]) heatCells[f] = {}
    if (!heatCells[f][m]) heatCells[f][m] = { count: 0, ingresos: 0 }
    heatCells[f][m].count++
    heatCells[f][m].ingresos += Number(r.ingresos_12m ?? 0)
  }

  const heatmapData: HeatmapData = {
    familias: Array.from(familiaMap.keys()).sort((a, b) => (familiaMap.get(b)?.modelos ?? 0) - (familiaMap.get(a)?.modelos ?? 0)),
    metales:  allMetales,
    cells:    heatCells,
  }

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

      <RolSurtidoBars data={rolSurtidoData} />

      <SurtidoCharts
        amplitudData={amplitudData}
        paretoData={paretoData}
        abcData={abcData}
        heatmapData={heatmapData}
      />
    </>
  )
}
