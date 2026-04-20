import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import { PrecioCharts } from './PrecioCharts'

export const dynamic = 'force-dynamic'

interface FamiliaStats {
  familia:         string
  precioMedio:     number
  precioMin:       number
  precioMax:       number
  descuentoMedio:  number
  margenMedio:     number
  count:           number
}

interface BucketRow { rango: string; count: number }

export default async function PrecioPage() {
  const supabase = createServerClient()

  // Leader variants with price + margin data (server-side only, aggregated)
  const { data: variants } = await supabase
    .from('product_variants')
    .select('codigo_modelo, precio_venta, precio_tachado, descuento_aplicado, pct_margen_bruto, es_variante_lider')
    .eq('es_variante_lider', true)
    .not('precio_venta', 'is', null)

  // Products for familia mapping
  const { data: products } = await supabase
    .from('products')
    .select('codigo_modelo, familia, metal')

  const familiaByCode = new Map<string, string>(
    (products ?? []).map(p => [p.codigo_modelo as string, p.familia as string ?? ''])
  )

  const rows = (variants ?? []).filter(v => Number(v.precio_venta) > 0)

  // ── KPIs ──────────────────────────────────────────────────────
  const precios   = rows.map(r => Number(r.precio_venta))
  const sorted    = [...precios].sort((a, b) => a - b)
  const precioMedio   = precios.length > 0 ? Math.round(precios.reduce((s, p) => s + p, 0) / precios.length) : 0
  const precioMediano = sorted.length > 0
    ? Math.round(sorted[Math.floor(sorted.length / 2)])
    : 0

  const conDescuento = rows.filter(r => Number(r.descuento_aplicado ?? 0) > 0)
  const pctConDescuento = rows.length > 0
    ? Math.round((conDescuento.length / rows.length) * 100)
    : 0
  const descuentoMedio = conDescuento.length > 0
    ? Math.round(conDescuento.reduce((s, r) => s + Number(r.descuento_aplicado ?? 0), 0) / conDescuento.length)
    : 0

  // ── Por familia ───────────────────────────────────────────────
  const familiaAgg = new Map<string, {
    precios: number[]; descuentos: number[]; margenes: number[]
  }>()

  for (const r of rows) {
    const f = familiaByCode.get(r.codigo_modelo as string) ?? 'Otras'
    if (!f) continue
    const cur = familiaAgg.get(f) ?? { precios: [], descuentos: [], margenes: [] }
    cur.precios.push(Number(r.precio_venta))
    if (Number(r.descuento_aplicado ?? 0) > 0) cur.descuentos.push(Number(r.descuento_aplicado))
    if (r.pct_margen_bruto != null) cur.margenes.push(Number(r.pct_margen_bruto))
    familiaAgg.set(f, cur)
  }

  const familiaStats: FamiliaStats[] = Array.from(familiaAgg.entries())
    .map(([familia, d]) => ({
      familia,
      count:        d.precios.length,
      precioMedio:  Math.round(d.precios.reduce((s: number, p: number) => s + p, 0) / d.precios.length),
      precioMin:    Math.round(Math.min(...d.precios)),
      precioMax:    Math.round(Math.max(...d.precios)),
      descuentoMedio: d.descuentos.length > 0
        ? Math.round(d.descuentos.reduce((s: number, p: number) => s + p, 0) / d.descuentos.length)
        : 0,
      margenMedio:  d.margenes.length > 0
        ? Math.round(d.margenes.reduce((s: number, p: number) => s + p, 0) / d.margenes.length)
        : 0,
    }))
    .filter(d => d.count >= 1)
    .sort((a, b) => b.precioMedio - a.precioMedio)

  // ── Distribución de precios por buckets ───────────────────────
  const buckets: Record<string, number> = {
    '< 50€':       0,
    '50 – 100€':   0,
    '100 – 200€':  0,
    '200 – 500€':  0,
    '500 – 1000€': 0,
    '> 1000€':     0,
  }
  for (const p of precios) {
    if (p < 50)         buckets['< 50€']++
    else if (p < 100)   buckets['50 – 100€']++
    else if (p < 200)   buckets['100 – 200€']++
    else if (p < 500)   buckets['200 – 500€']++
    else if (p < 1000)  buckets['500 – 1000€']++
    else                buckets['> 1000€']++
  }
  const distribucionData: BucketRow[] = Object.entries(buckets)
    .map(([rango, count]) => ({ rango, count }))

  return (
    <>
      <PageHeader
        eyebrow="Analítica"
        title="Precio"
        subtitle="Distribución de precios · Márgenes por familia · Análisis de descuentos"
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Precio medio"
          value={precioMedio.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          sub={`sobre ${rows.length} modelos`}
          color="neutral"
        />
        <KpiCard
          label="Precio mediano"
          value={precioMediano.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          sub="mitad del catálogo por encima"
          color="blue"
        />
        <KpiCard
          label="Con descuento"
          value={`${pctConDescuento}%`}
          sub={`${conDescuento.length} modelos con precio tachado`}
          color="amber"
        />
        <KpiCard
          label="Descuento medio"
          value={`${descuentoMedio}€`}
          sub="en modelos con descuento activo"
          color="red"
        />
      </div>

      <PrecioCharts
        familiaStats={familiaStats}
        distribucionData={distribucionData}
      />
    </>
  )
}
