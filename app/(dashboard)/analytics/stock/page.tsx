import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { StockCharts } from './StockCharts'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const supabase = createServerClient()

  const [productsRes, variantsRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, description, familia, abc_ventas'),
    supabase
      .from('product_variants')
      .select('codigo_modelo, stock_variante, unidades_mes_anterior, precio_venta, es_variante_lider'),
  ])

  const products = productsRes.data ?? []
  const variants = variantsRes.data ?? []

  const abcByCode     = new Map<string, string>(products.map(p => [p.codigo_modelo as string, p.abc_ventas as string ?? '']))
  const familiaByCode = new Map<string, string>(products.map(p => [p.codigo_modelo as string, p.familia as string ?? '']))
  const descByCode    = new Map<string, string>(products.map(p => [p.codigo_modelo as string, p.description as string ?? '']))

  // ── Aggregate stock per model ──────────────────────────────────
  const modelStock    = new Map<string, { stock: number; unidadesMes: number; precio: number | null }>()
  for (const v of variants) {
    const code = v.codigo_modelo as string
    const cur  = modelStock.get(code) ?? { stock: 0, unidadesMes: 0, precio: null }
    cur.stock      += Number(v.stock_variante ?? 0)
    cur.unidadesMes += Number(v.unidades_mes_anterior ?? 0)
    if (v.es_variante_lider && v.precio_venta != null) cur.precio = Number(v.precio_venta)
    modelStock.set(code, cur)
  }

  // ── Enrich per model ──────────────────────────────────────────
  const enriched = products.map(p => {
    const code  = p.codigo_modelo as string
    const s     = modelStock.get(code) ?? { stock: 0, unidadesMes: 0, precio: null }
    const cobertura = s.unidadesMes > 0 ? Math.round((s.stock / s.unidadesMes) * 10) / 10 : null
    return {
      codigo:     code,
      desc:       descByCode.get(code) ?? code,
      familia:    familiaByCode.get(code) ?? 'Otras',
      abc:        abcByCode.get(code) ?? null,
      stock:      s.stock,
      unidadesMes: s.unidadesMes,
      precio:     s.precio,
      cobertura,
    }
  })

  // ── KPIs ──────────────────────────────────────────────────────
  const totalStock     = enriched.reduce((s, r) => s + r.stock, 0)
  const sinStock       = enriched.filter(r => r.stock === 0).length
  const conCobertura   = enriched.filter(r => r.cobertura !== null)
  const coberturaMedia = conCobertura.length > 0
    ? Math.round(conCobertura.reduce((s, r) => s + (r.cobertura ?? 0), 0) / conCobertura.length * 10) / 10
    : 0
  const stockExceso    = enriched.filter(r => r.cobertura !== null && (r.cobertura ?? 0) > 12).length

  // ── Por familia ───────────────────────────────────────────────
  const familiaAgg = new Map<string, { stock: number; sinStock: number; coberturas: number[] }>()
  for (const r of enriched) {
    const f   = r.familia ?? 'Otras'
    const cur = familiaAgg.get(f) ?? { stock: 0, sinStock: 0, coberturas: [] }
    cur.stock += r.stock
    if (r.stock === 0) cur.sinStock++
    if (r.cobertura !== null) cur.coberturas.push(r.cobertura)
    familiaAgg.set(f, cur)
  }
  const familiaData = Array.from(familiaAgg.entries())
    .map(([familia, d]) => ({
      familia,
      stock:           d.stock,
      sinStock:        d.sinStock,
      coberturaMedia:  d.coberturas.length > 0
        ? Math.round(d.coberturas.reduce((s: number, p: number) => s + p, 0) / d.coberturas.length * 10) / 10
        : 0,
    }))
    .sort((a, b) => b.stock - a.stock)

  // ── Alertas: sin stock con ABC A ──────────────────────────────
  const alertasSinStock = enriched
    .filter(r => r.stock === 0 && r.abc === 'A')
    .sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0))
    .slice(0, 10)

  // ── Alertas: exceso (cobertura > 12 meses) ────────────────────
  const alertasExceso = enriched
    .filter(r => r.cobertura !== null && (r.cobertura ?? 0) > 12 && r.stock > 0)
    .sort((a, b) => (b.cobertura ?? 0) - (a.cobertura ?? 0))
    .slice(0, 10)

  // ── Distribución cobertura ────────────────────────────────────
  const cobBuckets = {
    'Sin ventas':  0,
    '< 1 mes':     0,
    '1 – 3m':      0,
    '3 – 6m':      0,
    '6 – 12m':     0,
    '> 12 meses':  0,
    'Sin stock':   0,
  }
  for (const r of enriched) {
    if (r.stock === 0)               cobBuckets['Sin stock']++
    else if (r.cobertura === null)   cobBuckets['Sin ventas']++
    else if (r.cobertura < 1)        cobBuckets['< 1 mes']++
    else if (r.cobertura < 3)        cobBuckets['1 – 3m']++
    else if (r.cobertura < 6)        cobBuckets['3 – 6m']++
    else if (r.cobertura < 12)       cobBuckets['6 – 12m']++
    else                             cobBuckets['> 12 meses']++
  }
  const coberturaData = Object.entries(cobBuckets).map(([rango, count]) => ({ rango, count }))

  return (
    <>
      <PageHeader
        eyebrow="Analítica"
        title="Stock"
        subtitle="Cobertura por familia · Alertas de rotura y exceso · Distribución de existencias"
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Unidades en stock"
          value={totalStock.toLocaleString('es-ES')}
          color="neutral"
        />
        <KpiCard
          label="Modelos sin stock"
          value={sinStock}
          sub={`de ${enriched.length} modelos`}
          color={sinStock > 10 ? 'red' : 'amber'}
        />
        <KpiCard
          label="Cobertura media"
          value={`${coberturaMedia}m`}
          sub="meses de stock a ritmo actual"
          color="blue"
        />
        <KpiCard
          label="Exceso stock"
          value={stockExceso}
          sub="modelos con +12 meses de cobertura"
          color={stockExceso > 20 ? 'red' : 'amber'}
        />
      </div>

      <StockCharts
        familiaData={familiaData}
        coberturaData={coberturaData}
        alertasSinStock={alertasSinStock}
        alertasExceso={alertasExceso}
      />
    </>
  )
}
