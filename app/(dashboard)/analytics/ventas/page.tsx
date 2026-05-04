import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import {
  VentasAnalyticsClient,
  type MonthlyPoint, type ModelPoint, type GroupPoint, type VentasKpis,
} from './VentasAnalyticsClient'

const MESES_CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default async function VentasAnalyticsPage() {
  const supabase = createServerClient()

  const [ventasRes, variantsRes, productsRes] = await Promise.all([
    supabase.from('ventas_mensuales').select('slug, anyo, mes, unidades_vendidas, ingresos_netos, coste_total'),
    supabase.from('product_variants').select('slug, codigo_modelo').eq('is_discontinued', false),
    supabase.from('products').select('codigo_modelo, description, familia, metal').eq('is_discontinued', false),
  ])

  const ventas   = ventasRes.data   ?? []
  const variants = variantsRes.data ?? []
  const products = productsRes.data ?? []

  // ventas_mensuales.slug joins directly to product_variants.slug
  const variantToModel = new Map<string, string>()
  for (const v of variants) if (v.slug) variantToModel.set(v.slug, v.codigo_modelo)

  const modelMeta = new Map<string, { description: string | null; familia: string | null; metal: string | null }>()
  for (const p of products) modelMeta.set(p.codigo_modelo, { description: p.description, familia: p.familia, metal: p.metal })

  // ── Monthly aggregation ──────────────────────────────────────
  type MonthKey = string
  const byMonth = new Map<MonthKey, { anyo: number; mes: number; unidades: number; ingresos: number; margen: number }>()
  for (const row of ventas) {
    const key: MonthKey = `${row.anyo}-${String(row.mes).padStart(2, '0')}`
    const ex = byMonth.get(key) ?? { anyo: Number(row.anyo), mes: Number(row.mes), unidades: 0, ingresos: 0, margen: 0 }
    const ing = Number(row.ingresos_netos ?? 0)
    const cst = Number(row.coste_total ?? 0)
    ex.unidades += Number(row.unidades_vendidas ?? 0)
    ex.ingresos += ing
    ex.margen   += ing - cst
    byMonth.set(key, ex)
  }
  const monthly: MonthlyPoint[] = Array.from(byMonth.values())
    .sort((a, b) => a.anyo !== b.anyo ? a.anyo - b.anyo : a.mes - b.mes)
    .map(d => ({
      label:    `${MESES_CORTO[d.mes]} ${String(d.anyo).slice(2)}`,
      unidades: d.unidades,
      ingresos: Math.round(d.ingresos),
      margen:   Math.round(d.margen),
    }))

  // ── By model ─────────────────────────────────────────────────
  const byModel = new Map<string, { ingresos: number; unidades: number }>()
  for (const row of ventas) {
    const model = variantToModel.get(row.slug)
    if (!model) continue
    const ex = byModel.get(model) ?? { ingresos: 0, unidades: 0 }
    ex.ingresos += Number(row.ingresos_netos ?? 0)
    ex.unidades += Number(row.unidades_vendidas ?? 0)
    byModel.set(model, ex)
  }
  const topModels: ModelPoint[] = Array.from(byModel.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 10)
    .map(([codigo_modelo, d]) => ({
      codigo_modelo,
      description: modelMeta.get(codigo_modelo)?.description ?? null,
      ingresos:    Math.round(d.ingresos),
      unidades:    d.unidades,
    }))

  // ── By familia ───────────────────────────────────────────────
  const byFamilia = new Map<string, { ingresos: number; unidades: number }>()
  for (const row of ventas) {
    const model = variantToModel.get(row.slug)
    const familia = model ? (modelMeta.get(model)?.familia ?? 'Sin familia') : 'Sin familia'
    const ex = byFamilia.get(familia) ?? { ingresos: 0, unidades: 0 }
    ex.ingresos += Number(row.ingresos_netos ?? 0)
    ex.unidades += Number(row.unidades_vendidas ?? 0)
    byFamilia.set(familia, ex)
  }
  const familiaData: GroupPoint[] = Array.from(byFamilia.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 12)
    .map(([name, d]) => ({ name, ingresos: Math.round(d.ingresos), unidades: d.unidades }))

  // ── By metal ─────────────────────────────────────────────────
  const byMetal = new Map<string, { ingresos: number; unidades: number }>()
  for (const row of ventas) {
    const model = variantToModel.get(row.slug)
    const metal = model ? (modelMeta.get(model)?.metal ?? 'Sin metal') : 'Sin metal'
    const ex = byMetal.get(metal) ?? { ingresos: 0, unidades: 0 }
    ex.ingresos += Number(row.ingresos_netos ?? 0)
    ex.unidades += Number(row.unidades_vendidas ?? 0)
    byMetal.set(metal, ex)
  }
  const metalData: GroupPoint[] = Array.from(byMetal.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .map(([name, d]) => ({ name, ingresos: Math.round(d.ingresos), unidades: d.unidades }))

  // ── KPIs ─────────────────────────────────────────────────────
  const totalIngresos = ventas.reduce((s, r) => s + Number(r.ingresos_netos ?? 0), 0)
  const totalCoste    = ventas.reduce((s, r) => s + Number(r.coste_total ?? 0), 0)
  const totalUnidades = ventas.reduce((s, r) => s + Number(r.unidades_vendidas ?? 0), 0)
  const numModelos    = byModel.size

  const meses = Array.from(byMonth.keys()).sort()
  const periodoLabel = meses.length > 0
    ? `${meses[0].replace('-', '/')} – ${meses[meses.length - 1].replace('-', '/')}`
    : 'Sin datos'

  const kpis: VentasKpis = {
    totalUnidades,
    totalIngresos: Math.round(totalIngresos),
    totalMargen:   Math.round(totalIngresos - totalCoste),
    numModelos,
    periodoLabel,
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        eyebrow="Analítica"
        title="Ventas históricas"
        subtitle="Evolución de ventas por mes, modelo, familia y metal"
      />

      <VentasAnalyticsClient
        kpis={kpis}
        monthly={monthly}
        topModels={topModels}
        byFamilia={familiaData}
        byMetal={metalData}
      />
    </div>
  )
}
