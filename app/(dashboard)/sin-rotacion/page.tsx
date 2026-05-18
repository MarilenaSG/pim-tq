import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { SinRotacionClient } from './SinRotacionClient'

export const dynamic = 'force-dynamic'

export type Diagnosis =
  | 'exposicion_o_precio'
  | 'distribucion'
  | 'liquidacion'
  | 'margen_comprimido'
  | 'revisar_manualmente'

export interface SinRotacionRow {
  codigo:              string
  desc:                string
  familia:             string | null
  metal:               string | null
  abc:                 string | null
  lifecycleStatus:     string
  stockTotal:          number
  capitalInmovilizado: number
  precioVenta:         number | null
  pctMargen:           number | null
  numTiendas:          number | null
  diagnosis:           Diagnosis
  hasDecision:         boolean
}

function findMargenObjetivo(
  familia: string | null,
  metal:   string | null,
  rules:   { familia: string | null; metal: string | null; margen_objetivo_pct: number }[],
): number {
  const exact     = rules.find(r => r.familia === familia && r.metal === metal)
  if (exact) return exact.margen_objetivo_pct
  const byFamilia = rules.find(r => r.familia === familia && r.metal === null)
  if (byFamilia) return byFamilia.margen_objetivo_pct
  const byMetal   = rules.find(r => r.familia === null && r.metal === metal)
  if (byMetal) return byMetal.margen_objetivo_pct
  const global    = rules.find(r => r.familia === null && r.metal === null)
  return global?.margen_objetivo_pct ?? 50
}

function diagnose(p: {
  abc:            string | null
  stockTotal:     number
  pctMargen:      number | null
  numTiendas:     number | null
  margenObjetivo: number
}): Diagnosis {
  const { abc, stockTotal, pctMargen, numTiendas, margenObjetivo } = p
  if (numTiendas !== null && numTiendas <= 3 && stockTotal > 0)      return 'distribucion'
  if (pctMargen !== null && pctMargen < margenObjetivo - 15)         return 'margen_comprimido'
  if ((abc === 'A' || abc === 'B') && stockTotal >= 3)               return 'exposicion_o_precio'
  if (abc === 'C')                                                    return 'liquidacion'
  return 'revisar_manualmente'
}

export default async function SinRotacionPage() {
  const supabase = createServerClient()

  const [productsRes, variantsRes, rulesRes, decisionsRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, description, familia, metal, abc_ventas, lifecycle_status')
      .eq('is_discontinued', false),
    supabase
      .from('product_variants')
      .select('codigo_modelo, stock_variante, unidades_mes_anterior, cost_price_medio, precio_venta, pct_margen_bruto, es_variante_lider, num_tiendas_activo'),
    supabase
      .from('pricing_rules')
      .select('familia, metal, margen_objetivo_pct'),
    supabase
      .from('product_c_decisions')
      .select('codigo_modelo, estado')
      .neq('estado', 'ejecutado'),
  ])

  const products  = productsRes.data  ?? []
  const variants  = variantsRes.data  ?? []
  const rules     = rulesRes.data     ?? []
  const decisions = decisionsRes.data ?? []

  const decisionCodes = new Set(decisions.map(d => d.codigo_modelo as string))

  type VarAgg = {
    stockTotal:          number
    unidadesMes:         number
    capitalInmovilizado: number
    precioVenta:         number | null
    pctMargen:           number | null
    numTiendas:          number | null
  }

  const varAgg = new Map<string, VarAgg>()
  for (const v of variants) {
    const code = v.codigo_modelo as string
    const cur  = varAgg.get(code) ?? {
      stockTotal: 0, unidadesMes: 0, capitalInmovilizado: 0,
      precioVenta: null, pctMargen: null, numTiendas: null,
    }
    const stock = Number(v.stock_variante ?? 0)
    const cost  = Number(v.cost_price_medio ?? 0)
    cur.stockTotal          += stock
    cur.unidadesMes         += Number(v.unidades_mes_anterior ?? 0)
    cur.capitalInmovilizado += stock * cost
    if (v.es_variante_lider) {
      cur.precioVenta = v.precio_venta != null    ? Number(v.precio_venta)    : null
      cur.pctMargen   = v.pct_margen_bruto != null ? Number(v.pct_margen_bruto) : null
      cur.numTiendas  = v.num_tiendas_activo != null ? Number(v.num_tiendas_activo) : null
    }
    varAgg.set(code, cur)
  }

  const sinRotacion: SinRotacionRow[] = []

  for (const p of products) {
    const code = p.codigo_modelo as string
    const agg  = varAgg.get(code)
    if (!agg) continue
    if (agg.stockTotal  <= 0) continue
    if (agg.unidadesMes  > 0) continue

    const margenObjetivo = findMargenObjetivo(
      p.familia as string | null,
      p.metal   as string | null,
      rules as { familia: string | null; metal: string | null; margen_objetivo_pct: number }[],
    )

    sinRotacion.push({
      codigo:              code,
      desc:                (p.description as string) ?? code,
      familia:             (p.familia as string | null),
      metal:               (p.metal   as string | null),
      abc:                 (p.abc_ventas as string | null),
      lifecycleStatus:     (p.lifecycle_status as string) ?? 'activo',
      stockTotal:          agg.stockTotal,
      capitalInmovilizado: Math.round(agg.capitalInmovilizado),
      precioVenta:         agg.precioVenta,
      pctMargen:           agg.pctMargen != null ? Math.round(agg.pctMargen) : null,
      numTiendas:          agg.numTiendas,
      diagnosis:           diagnose({
        abc:            p.abc_ventas as string | null,
        stockTotal:     agg.stockTotal,
        pctMargen:      agg.pctMargen != null ? Number(agg.pctMargen) : null,
        numTiendas:     agg.numTiendas,
        margenObjetivo,
      }),
      hasDecision: decisionCodes.has(code),
    })
  }

  sinRotacion.sort((a, b) => b.capitalInmovilizado - a.capitalInmovilizado)

  const totalCapital = sinRotacion.reduce((s, r) => s + r.capitalInmovilizado, 0)
  const sinDecision  = sinRotacion.filter(r => !r.hasDecision).length
  const pctCatalogo  = products.length > 0
    ? Math.round((sinRotacion.length / products.length) * 100) : 0

  const byDiagnosis: Record<string, number> = {}
  for (const r of sinRotacion) {
    byDiagnosis[r.diagnosis] = (byDiagnosis[r.diagnosis] ?? 0) + 1
  }

  const fmtCapital = (v: number) => v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M€`
    : v >= 1000
      ? `${Math.round(v / 1000)}k€`
      : `${v}€`

  return (
    <>
      <PageHeader
        eyebrow="Gestión"
        title="Sin rotación"
        subtitle="Productos con stock inmovilizado · diagnóstico automático · gestión de decisiones"
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Modelos sin rotación"
          value={sinRotacion.length}
          sub={`${pctCatalogo}% del catálogo activo`}
          color={sinRotacion.length > 50 ? 'red' : 'amber'}
        />
        <KpiCard
          label="Capital inmovilizado"
          value={fmtCapital(totalCapital)}
          sub="a precio de coste"
          color="red"
        />
        <KpiCard
          label="Sin decisión tomada"
          value={sinDecision}
          sub="pendientes de revisar"
          color={sinDecision > 20 ? 'red' : 'amber'}
        />
        <KpiCard
          label="Con decisión activa"
          value={sinRotacion.length - sinDecision}
          sub="en proceso o aprobadas"
          color="green"
        />
      </div>

      <SinRotacionClient
        rows={sinRotacion}
        byDiagnosis={byDiagnosis}
      />
    </>
  )
}
