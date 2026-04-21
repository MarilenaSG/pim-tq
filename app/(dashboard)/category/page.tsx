import { createServerClient } from '@/lib/supabase/server'
import { CategoryManagerClient } from './CategoryManagerClient'

export default async function CategoryPage({
  searchParams,
}: {
  searchParams: { metal?: string; karat?: string; proveedor?: string; category?: string }
}) {
  const supabase = createServerClient()

  const { data: rawProducts } = await supabase
    .from('products')
    .select(`
      codigo_modelo, familia, metal, karat, supplier_name, category,
      abc_ventas, ingresos_12m, num_variantes,
      product_variants(stock_variante, pct_margen_bruto, es_variante_lider)
    `)

  // Load pricing rules for margin thresholds
  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('familia, margen_objetivo_pct')

  const marginTargets = Object.fromEntries(
    (pricingRules ?? [])
      .filter(r => r.familia && r.margen_objetivo_pct)
      .map(r => [r.familia!, r.margen_objetivo_pct!])
  )

  type RawProduct = {
    codigo_modelo: string
    familia: string | null
    metal: string | null
    karat: string | null
    supplier_name: string | null
    category: string | null
    abc_ventas: string | null
    ingresos_12m: number | null
    num_variantes: number | null
    product_variants: { stock_variante: number | null; pct_margen_bruto: number | null; es_variante_lider: boolean }[]
  }

  const products = (rawProducts ?? []) as unknown as RawProduct[]

  // Apply filters
  const metal    = searchParams.metal    ?? ''
  const karat    = searchParams.karat    ?? ''
  const proveedor = searchParams.proveedor ?? ''
  const category = searchParams.category ?? ''

  const filtered = products.filter(p =>
    (!metal     || p.metal === metal) &&
    (!karat     || p.karat === karat) &&
    (!proveedor || p.supplier_name === proveedor) &&
    (!category  || p.category === category)
  )

  // Aggregate by familia
  const familiaMap = new Map<string, {
    familia: string
    modelos: number
    variantes: number
    skusActivos: number
    ingresos: number
    abcA: number; abcB: number; abcC: number; abcNull: number
    margenValues: number[]
    abcATotal: number; abcAConStock: number
    topProductos: { codigo_modelo: string; abc_ventas: string | null; ingresos_12m: number | null }[]
  }>()

  const totalIngresos = filtered.reduce((s, p) => s + (p.ingresos_12m ?? 0), 0)

  for (const p of filtered) {
    const key = p.familia ?? 'Sin familia'
    if (!familiaMap.has(key)) {
      familiaMap.set(key, { familia: key, modelos: 0, variantes: 0, skusActivos: 0, ingresos: 0, abcA: 0, abcB: 0, abcC: 0, abcNull: 0, margenValues: [], abcATotal: 0, abcAConStock: 0, topProductos: [] })
    }
    const f = familiaMap.get(key)!
    f.modelos++
    f.variantes += p.num_variantes ?? 0

    const stockTotal = p.product_variants.reduce((s, v) => s + (v.stock_variante ?? 0), 0)
    if (stockTotal > 0) f.skusActivos++
    f.ingresos += p.ingresos_12m ?? 0

    if (p.abc_ventas === 'A') { f.abcA++; f.abcATotal++ }
    else if (p.abc_ventas === 'B') f.abcB++
    else if (p.abc_ventas === 'C') f.abcC++
    else f.abcNull++

    if (p.abc_ventas === 'A') {
      if (stockTotal > 0) f.abcAConStock++
    }

    const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
    if (leader?.pct_margen_bruto != null) f.margenValues.push(leader.pct_margen_bruto)

    f.topProductos.push({ codigo_modelo: p.codigo_modelo, abc_ventas: p.abc_ventas, ingresos_12m: p.ingresos_12m })
  }

  const familias = Array.from(familiaMap.values()).map(f => ({
    ...f,
    margenMedio: f.margenValues.length > 0
      ? f.margenValues.reduce((a, b) => a + b, 0) / f.margenValues.length
      : null,
    pctIngresos: totalIngresos > 0 ? (f.ingresos / totalIngresos) * 100 : 0,
    topProductos: f.topProductos
      .sort((a, b) => (b.ingresos_12m ?? 0) - (a.ingresos_12m ?? 0))
      .slice(0, 5),
  })).sort((a, b) => b.ingresos - a.ingresos)

  // Filter options
  const uniqMetals     = Array.from(new Set(products.map(p => p.metal).filter(Boolean) as string[])).sort()
  const uniqKarats     = Array.from(new Set(products.map(p => p.karat).filter(Boolean) as string[])).sort()
  const uniqProveedores = Array.from(new Set(products.map(p => p.supplier_name).filter(Boolean) as string[])).sort()
  const uniqCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[])).sort()

  // Top 3 concentration
  const top3Ingresos = familias.slice(0, 3).reduce((s, f) => s + f.ingresos, 0)
  const concentracion = totalIngresos > 0 ? Math.round((top3Ingresos / totalIngresos) * 100) : 0

  // KPIs
  const familiasActivas = familias.filter(f => f.ingresos > 0).length
  const familiaTop = familias[0] ?? null
  const stockCriticoFamilias = familias.filter(
    f => f.abcATotal > 0 && f.abcAConStock < f.abcATotal
  ).length

  return (
    <CategoryManagerClient
      familias={familias}
      totalIngresos={totalIngresos}
      familiasActivas={familiasActivas}
      familiaTop={familiaTop ? { nombre: familiaTop.familia, ingresos: familiaTop.ingresos } : null}
      stockCriticoFamilias={stockCriticoFamilias}
      concentracion={concentracion}
      marginTargets={marginTargets}
      filters={{ metal, karat, proveedor, category }}
      filterOptions={{ metals: uniqMetals, karats: uniqKarats, proveedores: uniqProveedores, categories: uniqCategories }}
    />
  )
}
