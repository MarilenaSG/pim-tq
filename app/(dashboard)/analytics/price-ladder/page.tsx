import { createServerClient } from '@/lib/supabase/server'
import { PriceLadderClient } from './PriceLadderClient'

export default async function PriceLadderPage({
  searchParams,
}: {
  searchParams: { familia?: string; metal?: string }
}) {
  const supabase = createServerClient()

  // Get all families with their top ingresos to set default
  const { data: rawProducts } = await supabase
    .from('products')
    .select(`
      codigo_modelo, description, familia, metal, karat, category,
      abc_ventas, ingresos_12m,
      product_variants(
        codigo_interno, variante, precio_venta, precio_tachado,
        descuento_aplicado, pct_margen_bruto, es_variante_lider, abc_ventas
      )
    `)

  // Load ladder ranges from alert_settings
  const { data: settings } = await supabase
    .from('alert_settings')
    .select('key, value')
    .eq('key', 'ladder_rangos')
    .single()

  const rangesStr = (settings as { key: string; value: string } | null)?.value
    ?? '0-50,51-100,101-200,201-350,351-500,501-750,751-1000,1000+'

  type RawProduct = {
    codigo_modelo: string
    description: string | null
    familia: string | null
    metal: string | null
    karat: string | null
    category: string | null
    abc_ventas: string | null
    ingresos_12m: number | null
    product_variants: {
      codigo_interno: string
      variante: string | null
      precio_venta: number | null
      precio_tachado: number | null
      descuento_aplicado: number | null
      pct_margen_bruto: number | null
      es_variante_lider: boolean
      abc_ventas: string | null
    }[]
  }

  const products = (rawProducts ?? []) as unknown as RawProduct[]

  // Build family options sorted by ingresos
  const familiaIngresos = new Map<string, number>()
  for (const p of products) {
    const k = p.familia ?? 'Sin familia'
    familiaIngresos.set(k, (familiaIngresos.get(k) ?? 0) + (p.ingresos_12m ?? 0))
  }
  const familias = Array.from(familiaIngresos.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)

  const selectedFamilia = searchParams.familia ?? familias[0] ?? ''
  const selectedMetal   = searchParams.metal ?? ''

  // Filter products
  const filtered = products.filter(p =>
    (!selectedFamilia || (p.familia ?? 'Sin familia') === selectedFamilia) &&
    (!selectedMetal   || p.metal === selectedMetal)
  )

  // Parse ladder ranges
  function parseRanges(s: string): { label: string; min: number; max: number }[] {
    return s.split(',').map(r => {
      if (r.endsWith('+')) {
        const min = parseInt(r, 10)
        return { label: r.trim(), min, max: Infinity }
      }
      const [a, b] = r.split('-').map(Number)
      return { label: r.trim(), min: a, max: b }
    })
  }

  const ranges = parseRanges(rangesStr)

  // Build ladder data
  const ladderData = ranges.map(range => {
    const inRange = filtered.filter(p => {
      const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
      const price = leader?.precio_venta ?? null
      if (price == null) return false
      return price >= range.min && (range.max === Infinity || price <= range.max)
    })

    const margenValues = inRange
      .map(p => {
        const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
        return leader?.pct_margen_bruto
      })
      .filter((v): v is number => v != null)

    const margenMedio = margenValues.length > 0
      ? margenValues.reduce((a, b) => a + b, 0) / margenValues.length
      : null

    const abcCounts = { A: 0, B: 0, C: 0, null: 0 }
    for (const p of inRange) {
      const k = p.abc_ventas as keyof typeof abcCounts ?? 'null'
      abcCounts[k] = (abcCounts[k] ?? 0) + 1
    }

    return {
      rango: range.label,
      min: range.min,
      max: range.max === Infinity ? 9999999 : range.max,
      modelos: inRange.length,
      ingresos: inRange.reduce((s, p) => s + (p.ingresos_12m ?? 0), 0),
      margenMedio,
      esGap: inRange.length === 0,
      abcA: abcCounts.A,
      abcB: abcCounts.B,
      abcC: abcCounts.C,
      productos: inRange.slice(0, 10).map(p => {
        const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
        return {
          codigo_modelo: p.codigo_modelo,
          description: p.description,
          precio: leader?.precio_venta ?? null,
          margen: leader?.pct_margen_bruto ?? null,
          abc: p.abc_ventas,
          ingresos: p.ingresos_12m,
        }
      }),
    }
  })

  // All products in selected familia for detail table
  const allProductsInFamilia = filtered.map(p => {
    const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
    return {
      codigo_modelo: p.codigo_modelo,
      description: p.description,
      variante: leader?.variante ?? null,
      precio_venta: leader?.precio_venta ?? null,
      precio_tachado: leader?.precio_tachado ?? null,
      descuento: leader?.descuento_aplicado ?? null,
      margen: leader?.pct_margen_bruto ?? null,
      abc: p.abc_ventas,
      ingresos: p.ingresos_12m,
    }
  })

  const uniqMetals = Array.from(new Set(products.filter(p => (p.familia ?? 'Sin familia') === selectedFamilia).map(p => p.metal).filter(Boolean) as string[])).sort()

  return (
    <PriceLadderClient
      familias={familias}
      selectedFamilia={selectedFamilia}
      selectedMetal={selectedMetal}
      ladderData={ladderData}
      allProducts={allProductsInFamilia}
      uniqMetals={uniqMetals}
    />
  )
}
