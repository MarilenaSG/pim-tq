import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import {
  VentasAnalyticsClient,
  type MonthlyPoint, type ModelPoint, type GroupPoint, type VentasKpis,
} from './VentasAnalyticsClient'

export const dynamic = 'force-dynamic'

const MESES_CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function periodoAtras(curAnyo: number, curMes: number, meses: number) {
  let a = curAnyo, m = curMes - meses
  while (m <= 0) { m += 12; a-- }
  return { anyo: a, mes: m }
}

export default async function VentasAnalyticsPage() {
  const supabase = createServerClient()

  const now     = new Date()
  const curAnyo = now.getFullYear()
  const curMes  = now.getMonth() + 1

  const evo18start = periodoAtras(curAnyo, curMes, 17)  // 18 meses incl. el actual
  const cut12      = periodoAtras(curAnyo, curMes, 11)  // inicio de los últimos 12m

  // ── RPCs en paralelo — agregación en Supabase, no en JS ──────
  const [evoRes, allModelsRes, famRes] = await Promise.all([
    supabase.rpc('ventas_evolucion', {
      p_anyo_desde: evo18start.anyo, p_mes_desde: evo18start.mes,
      p_anyo_hasta: curAnyo,         p_mes_hasta: curMes,
    }),
    // Todos los modelos con ventas en 12m — usamos límite alto para cubrir el catálogo completo
    supabase.rpc('ventas_top_modelos', {
      p_anyo_desde: cut12.anyo, p_mes_desde: cut12.mes,
      p_anyo_hasta: curAnyo,    p_mes_hasta: curMes,
      p_limit:      500,
    }),
    supabase.rpc('ventas_por_familia', {
      p_anyo_desde: cut12.anyo, p_mes_desde: cut12.mes,
      p_anyo_hasta: curAnyo,    p_mes_hasta: curMes,
      p_limit:      12,
    }),
  ])

  const allModels: { codigo_modelo: string; ingresos_12m: number; unidades_12m: number }[] =
    (allModelsRes.data ?? []).map((r: { codigo_modelo: string; ingresos_12m: number; unidades_12m: number }) => ({
      codigo_modelo: r.codigo_modelo,
      ingresos_12m:  Math.round(Number(r.ingresos_12m ?? 0)),
      unidades_12m:  Number(r.unidades_12m ?? 0),
    }))

  // ── Enriquecer modelos con descripción + metal ─────────────────
  const allCodes = allModels.map(r => r.codigo_modelo)
  let prodMeta: Record<string, { description: string | null; metal: string | null }> = {}
  if (allCodes.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('codigo_modelo, description, metal')
      .in('codigo_modelo', allCodes)
    prodMeta = Object.fromEntries(
      (prods ?? []).map(p => [p.codigo_modelo, { description: p.description ?? null, metal: p.metal ?? null }])
    )
  }

  // ── Evolución mensual: rellenar los 18 meses aunque no haya datos
  const evoByPeriod = new Map<number, { ingresos: number; unidades: number }>()
  for (const r of evoRes.data ?? []) {
    evoByPeriod.set(Number(r.anyo) * 100 + Number(r.mes), {
      ingresos: Math.round(Number(r.ingresos_netos ?? 0)),
      unidades: Number(r.unidades_vendidas ?? 0),
    })
  }
  const monthly: MonthlyPoint[] = []
  for (let i = 17; i >= 0; i--) {
    const p    = periodoAtras(curAnyo, curMes, i)
    const slot = evoByPeriod.get(p.anyo * 100 + p.mes) ?? { ingresos: 0, unidades: 0 }
    monthly.push({ label: `${MESES_CORTO[p.mes]} ${String(p.anyo).slice(2)}`, ...slot })
  }

  // ── Top 10 modelos ─────────────────────────────────────────────
  const topModels: ModelPoint[] = allModels.slice(0, 10).map(r => ({
    codigo_modelo: r.codigo_modelo,
    description:   prodMeta[r.codigo_modelo]?.description ?? null,
    ingresos:      r.ingresos_12m,
    unidades:      r.unidades_12m,
  }))

  // ── Por familia ────────────────────────────────────────────────
  const byFamilia: GroupPoint[] = (famRes.data ?? []).map((r: { familia: string; ingresos: number; unidades: number }) => ({
    name:     r.familia,
    ingresos: Math.round(Number(r.ingresos ?? 0)),
    unidades: Number(r.unidades ?? 0),
  }))

  // ── Por metal: agregar todos los modelos con ventas ────────────
  const metalAgg = new Map<string, { ingresos: number; unidades: number }>()
  for (const r of allModels) {
    const metal = prodMeta[r.codigo_modelo]?.metal ?? 'Sin metal'
    const ex    = metalAgg.get(metal) ?? { ingresos: 0, unidades: 0 }
    ex.ingresos += r.ingresos_12m
    ex.unidades += r.unidades_12m
    metalAgg.set(metal, ex)
  }
  const byMetal: GroupPoint[] = Array.from(metalAgg.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .map(([name, d]) => ({ name, ingresos: d.ingresos, unidades: d.unidades }))

  // ── KPIs ───────────────────────────────────────────────────────
  const totalIngresos = monthly.reduce((s, r) => s + r.ingresos, 0)
  const totalUnidades = monthly.reduce((s, r) => s + r.unidades, 0)

  const ticketMedio = totalUnidades > 0 ? totalIngresos / totalUnidades : 0

  const kpis: VentasKpis = {
    totalUnidades,
    totalIngresos,
    ticketMedio,
    numModelos:    allModels.length,
    periodoLabel:  `${MESES_CORTO[evo18start.mes]} ${evo18start.anyo} – ${MESES_CORTO[curMes]} ${curAnyo}`,
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        eyebrow="Analítica"
        title="Ventas históricas"
        subtitle="Evolución 18m · Top modelos · Ingresos por familia y metal"
      />

      <VentasAnalyticsClient
        kpis={kpis}
        monthly={monthly}
        topModels={topModels}
        byFamilia={byFamilia}
        byMetal={byMetal}
      />
    </div>
  )
}
