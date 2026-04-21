import { createServerClient } from '@/lib/supabase/server'
import { SuppliersClient } from './SuppliersClient'

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: { highlight?: string }
}) {
  const supabase = createServerClient()

  const { data: rawProducts } = await supabase
    .from('products')
    .select(`
      codigo_modelo, familia, supplier_name, abc_ventas, ingresos_12m, num_variantes, category,
      product_variants(stock_variante, pct_margen_bruto, es_variante_lider)
    `)

  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('familia, margen_objetivo_pct')

  // Default margin target (average of all rules, or 40%)
  const allTargets = (pricingRules ?? []).map(r => r.margen_objetivo_pct).filter(Boolean) as number[]
  const defaultTarget = allTargets.length > 0
    ? allTargets.reduce((a, b) => a + b, 0) / allTargets.length
    : 40

  type RawProduct = {
    codigo_modelo: string
    familia: string | null
    supplier_name: string | null
    abc_ventas: string | null
    ingresos_12m: number | null
    num_variantes: number | null
    category: string | null
    product_variants: { stock_variante: number | null; pct_margen_bruto: number | null; es_variante_lider: boolean }[]
  }

  const products = (rawProducts ?? []) as unknown as RawProduct[]
  const totalProducts = products.length
  const totalIngresos = products.reduce((s, p) => s + (p.ingresos_12m ?? 0), 0)

  // Aggregate by supplier
  const supplierMap = new Map<string, {
    proveedor: string
    modelos: number
    ingresos: number
    abcA: number; abcB: number; abcC: number
    margenValues: number[]
    familias: Set<string>
    topProductos: { codigo_modelo: string; familia: string | null; abc_ventas: string | null; ingresos_12m: number | null }[]
    abcATotal: number; abcAConStock: number
  }>()

  for (const p of products) {
    const key = p.supplier_name ?? 'Sin proveedor'
    if (!supplierMap.has(key)) {
      supplierMap.set(key, { proveedor: key, modelos: 0, ingresos: 0, abcA: 0, abcB: 0, abcC: 0, margenValues: [], familias: new Set(), topProductos: [], abcATotal: 0, abcAConStock: 0 })
    }
    const s = supplierMap.get(key)!
    s.modelos++
    s.ingresos += p.ingresos_12m ?? 0
    if (p.abc_ventas === 'A') { s.abcA++; s.abcATotal++ }
    else if (p.abc_ventas === 'B') s.abcB++
    else if (p.abc_ventas === 'C') s.abcC++
    if (p.familia) s.familias.add(p.familia)
    const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
    if (leader?.pct_margen_bruto != null) s.margenValues.push(leader.pct_margen_bruto)
    const stockTotal = p.product_variants.reduce((sum, v) => sum + (v.stock_variante ?? 0), 0)
    if (p.abc_ventas === 'A' && stockTotal > 0) s.abcAConStock++
    s.topProductos.push({ codigo_modelo: p.codigo_modelo, familia: p.familia, abc_ventas: p.abc_ventas, ingresos_12m: p.ingresos_12m })
  }

  const maxIngresos = Math.max(...Array.from(supplierMap.values()).map(s => s.ingresos), 1)

  const suppliers = Array.from(supplierMap.values()).map(s => ({
    proveedor: s.proveedor,
    modelos: s.modelos,
    pctCatalogo: totalProducts > 0 ? (s.modelos / totalProducts) * 100 : 0,
    ingresos: s.ingresos,
    pctIngresos: totalIngresos > 0 ? (s.ingresos / totalIngresos) * 100 : 0,
    pctIngresosMax: maxIngresos > 0 ? (s.ingresos / maxIngresos) * 100 : 0,
    margenMedio: s.margenValues.length > 0 ? s.margenValues.reduce((a, b) => a + b, 0) / s.margenValues.length : null,
    abcA: s.abcA,
    abcB: s.abcB,
    abcC: s.abcC,
    abcATotal: s.abcATotal,
    abcAConStock: s.abcAConStock,
    familias: Array.from(s.familias).sort(),
    topProductos: s.topProductos.sort((a, b) => (b.ingresos_12m ?? 0) - (a.ingresos_12m ?? 0)).slice(0, 5),
  })).sort((a, b) => b.ingresos - a.ingresos)

  return (
    <SuppliersClient
      suppliers={suppliers}
      totalIngresos={totalIngresos}
      totalProducts={totalProducts}
      defaultMarginTarget={defaultTarget}
      highlight={searchParams.highlight ?? ''}
    />
  )
}
