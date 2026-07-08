import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { RentabilidadCharts } from './RentabilidadCharts'
import { MatrizSurtido, type MatrizCell, type BorderGroup, type MatrizItem } from './MatrizSurtido'
import type { AbcCruzado } from '@/types'

export const dynamic = 'force-dynamic'

// Etiqueta ABC cruzado por (volumen, margen) — espejo de la vista SQL
const CRUZADO: Record<string, AbcCruzado> = {
  AA: 'Estrella',      AB: 'Motor de tráfico',     AC: 'Gancho bajo margen',
  BA: 'Joya oculta',   BB: 'Núcleo estable',       BC: 'Revisar precio/coste',
  CA: 'Nicho rentable', CB: 'Cola larga aceptable', CC: 'Candidato a descatalogar',
}

export default async function RentabilidadPage({ searchParams }: { searchParams: { familia?: string; metal?: string; supplier?: string } }) {
  const supabase = createServerClient()
  const { familia, metal, supplier } = searchParams

  let prodQuery = supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal, shopify_vendor, abc_ventas, ingresos_12m')
    .neq('is_discontinued', true)
  if (familia)   prodQuery = prodQuery.eq('familia', familia)
  if (metal)     prodQuery = prodQuery.eq('metal', metal)
  if (supplier)  prodQuery = prodQuery.eq('shopify_vendor', supplier)

  const [productsRes, variantsRes] = await Promise.all([
    prodQuery,
    supabase
      .from('product_variants')
      .select('codigo_modelo, pct_margen_bruto, precio_venta, es_variante_lider')
      .eq('es_variante_lider', true),
  ])

  const products = productsRes.data ?? []
  const variants = variantsRes.data ?? []

  // ── Matriz de surtido (vista v_matriz_surtido) ────────────────
  // Lectura paginada para no toparse con el límite de 1000 filas de Supabase.
  const matrizRows: {
    codigo_modelo: string; description: string | null; familia: string | null
    ingresos_12m: number | null; unidades_12m: number | null
    clase_abc: string | null; margen_abc: string | null
    pct_margen_bruto: number | null; abc_cruzado: string | null
  }[] = []
  for (let from = 0; ; from += 1000) {
    let mq = supabase
      .from('v_matriz_surtido')
      .select('codigo_modelo, description, familia, ingresos_12m, unidades_12m, clase_abc, margen_abc, pct_margen_bruto, abc_cruzado')
      .range(from, from + 999)
    if (familia)  mq = mq.eq('familia', familia)
    if (metal)    mq = mq.eq('metal', metal)
    if (supplier) mq = mq.eq('marca', supplier)
    const { data } = await mq
    if (!data || data.length === 0) break
    matrizRows.push(...data)
    if (data.length < 1000) break
  }

  const toItem = (r: (typeof matrizRows)[number]): MatrizItem => ({
    codigo:   r.codigo_modelo,
    desc:     r.description,
    familia:  r.familia,
    ingresos: Number(r.ingresos_12m ?? 0),
    margen:   r.pct_margen_bruto != null ? Number(r.pct_margen_bruto) : null,
    uds:      r.unidades_12m != null ? Number(r.unidades_12m) : null,
  })

  const cells: MatrizCell[] = (['A', 'B', 'C'] as const).flatMap(vol =>
    (['A', 'B', 'C'] as const).map(mgn => ({
      vol, mgn,
      label: CRUZADO[`${vol}${mgn}`],
      items: matrizRows.filter(r => r.clase_abc === vol && r.margen_abc === mgn).map(toItem),
    }))
  )
  const borderCases: BorderGroup[] = ([
    ['Sin venta 12M', (r: (typeof matrizRows)[number]) => r.clase_abc === 'Sin venta'],
    ['Sin dato de margen', (r: (typeof matrizRows)[number]) => r.clase_abc !== 'Sin venta' && r.margen_abc == null],
  ] as const).map(([label, pred]) => ({
    label: label as BorderGroup['label'],
    items: matrizRows.filter(pred).map(toItem),
  }))

  const margenByCode = new Map<string, number>(
    variants
      .filter(v => v.pct_margen_bruto != null)
      .map(v => [v.codigo_modelo as string, Number(v.pct_margen_bruto)])
  )
  const precioByCode = new Map<string, number>(
    variants
      .filter(v => v.precio_venta != null)
      .map(v => [v.codigo_modelo as string, Number(v.precio_venta)])
  )

  // ── Per-product enriched ───────────────────────────────────────
  const enriched = products.map(p => ({
    codigo:   p.codigo_modelo as string,
    desc:     p.description as string | null,
    familia:  p.familia as string | null,
    metal:    p.metal as string | null,
    proveedor: p.shopify_vendor as string | null,
    abc:      p.abc_ventas as string | null,
    ingresos: Number(p.ingresos_12m ?? 0),
    margen:   margenByCode.get(p.codigo_modelo as string) ?? null,
    precio:   precioByCode.get(p.codigo_modelo as string) ?? null,
  }))

  // ── KPIs ──────────────────────────────────────────────────────
  const totalIngresos = enriched.reduce((s, r) => s + r.ingresos, 0)
  const conMargen     = enriched.filter(r => r.margen !== null)
  const margenMedio   = conMargen.length > 0
    ? Math.round(conMargen.reduce((s, r) => s + (r.margen ?? 0), 0) / conMargen.length)
    : 0

  // Familia top por ingresos
  const familiaIng = new Map<string, number>()
  for (const r of enriched) {
    if (!r.familia) continue
    familiaIng.set(r.familia, (familiaIng.get(r.familia) ?? 0) + r.ingresos)
  }
  const familiaTop = Array.from(familiaIng.entries()).sort((a, b) => b[1] - a[1])[0]

  // Metal top por ingresos
  const metalIng = new Map<string, number>()
  for (const r of enriched) {
    if (!r.metal) continue
    metalIng.set(r.metal, (metalIng.get(r.metal) ?? 0) + r.ingresos)
  }
  const metalTop = Array.from(metalIng.entries()).sort((a, b) => b[1] - a[1])[0]

  // ── Por familia ───────────────────────────────────────────────
  const familiaAgg = new Map<string, { ingresos: number; margenes: number[]; count: number }>()
  for (const r of enriched) {
    const f = r.familia ?? 'Otras'
    const cur = familiaAgg.get(f) ?? { ingresos: 0, margenes: [], count: 0 }
    cur.ingresos += r.ingresos
    if (r.margen !== null) cur.margenes.push(r.margen)
    cur.count++
    familiaAgg.set(f, cur)
  }
  const familiaData = Array.from(familiaAgg.entries())
    .map(([familia, d]) => ({
      familia,
      ingresos:    Math.round(d.ingresos),
      margenMedio: d.margenes.length > 0 ? Math.round(d.margenes.reduce((s: number, p: number) => s + p, 0) / d.margenes.length) : 0,
      count:       d.count,
    }))
    .sort((a, b) => b.ingresos - a.ingresos)

  // ── Por metal ─────────────────────────────────────────────────
  const metalAgg = new Map<string, number>()
  for (const r of enriched) {
    const m = r.metal ?? 'Otros'
    metalAgg.set(m, (metalAgg.get(m) ?? 0) + r.ingresos)
  }
  const metalData = Array.from(metalAgg.entries())
    .map(([metal, ingresos]) => ({ metal, ingresos: Math.round(ingresos) }))
    .sort((a, b) => b.ingresos - a.ingresos)

  // ── Top 10 modelos ────────────────────────────────────────────
  const top10 = enriched
    .filter(r => r.ingresos > 0)
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 10)
    .map(r => ({
      ...r,
      pctTotal: totalIngresos > 0 ? Math.round((r.ingresos / totalIngresos) * 1000) / 10 : 0,
    }))

  // ── Scatter: ingresos vs margen ───────────────────────────────
  const scatterData = enriched
    .filter(r => r.ingresos > 0 && r.margen !== null)
    .map(r => ({
      ingresos: Math.round(r.ingresos),
      margen:   Math.round(r.margen ?? 0),
      familia:  r.familia ?? 'Otras',
      codigo:   r.codigo,
      desc:     r.desc ?? r.codigo,
      abc:      r.abc ?? 'S/D',
    }))

  return (
    <>
      <PageHeader
        eyebrow="Analítica"
        title="Rentabilidad"
        subtitle="Ingresos y márgenes por familia, metal y modelo · Top 10 contribuidores"
        actions={
          <a
            href={`/api/analytics/matriz-excel${
              (() => {
                const p = new URLSearchParams()
                if (familia)  p.set('familia', familia)
                if (metal)    p.set('metal', metal)
                if (supplier) p.set('supplier', supplier)
                const qs = p.toString()
                return qs ? `?${qs}` : ''
              })()
            }`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: '#00557f' }}
          >
            ↓ Excel {(familia || metal || supplier) ? '(filtrado)' : '(completo)'}
          </a>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Ingresos totales 12m"
          value={totalIngresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          color="neutral"
        />
        <KpiCard
          label="Margen bruto medio"
          value={`${margenMedio}%`}
          sub="sobre modelos con dato"
          color="green"
        />
        <KpiCard
          label="Familia top"
          value={familiaTop?.[0] ?? '—'}
          sub={familiaTop ? `${familiaTop[1].toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}` : ''}
          color="amber"
        />
        <KpiCard
          label="Metal top"
          value={metalTop?.[0] ?? '—'}
          sub={metalTop ? `${metalTop[1].toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}` : ''}
          color="blue"
        />
      </div>

      <MatrizSurtido cells={cells} borderCases={borderCases} />

      <RentabilidadCharts
        familiaData={familiaData}
        metalData={metalData}
        top10={top10}
        scatterData={scatterData}
      />
    </>
  )
}
