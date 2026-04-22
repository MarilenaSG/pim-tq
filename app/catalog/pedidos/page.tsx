import { createServerClient } from '@/lib/supabase/server'
import { PedidosTable } from './PedidosTable'

export interface PedidoRow {
  codigo_modelo: string
  description:   string | null
  category:      string | null
  familia:       string | null
  metal:         string | null
  karat:         string | null
  image_url:     string | null
  precio_venta:  number | null
  stock_total:   number
  variantes:     string[]   // active variant sizes, sorted
}

async function getPedidosData(): Promise<PedidoRow[]> {
  const supabase = createServerClient()

  // Only active (non-discontinued) variants
  const { data: variants } = await supabase
    .from('product_variants')
    .select('codigo_modelo, variante, precio_venta, stock_variante, es_variante_lider')
    .eq('is_discontinued', false)

  if (!variants?.length) return []

  const codes = [...new Set(variants.map(v => v.codigo_modelo))]

  const [productsRes, imagesRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, description, category, familia, metal, karat')
      .in('codigo_modelo', codes),
    supabase
      .from('product_images')
      .select('codigo_modelo, url')
      .in('codigo_modelo', codes)
      .eq('is_primary', true),
  ])

  const productMap = Object.fromEntries(
    (productsRes.data ?? []).map(p => [p.codigo_modelo, p])
  )
  const imageMap = Object.fromEntries(
    (imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url])
  )

  // Group variants by model
  const variantsByModel: Record<string, typeof variants> = {}
  for (const v of variants) {
    if (!variantsByModel[v.codigo_modelo]) variantsByModel[v.codigo_modelo] = []
    variantsByModel[v.codigo_modelo].push(v)
  }

  return Object.entries(variantsByModel)
    .map(([codigo_modelo, vars]) => {
      const p      = productMap[codigo_modelo]
      const leader = vars.find(v => v.es_variante_lider) ?? vars[0]
      const stock  = vars.reduce((acc, v) => acc + (v.stock_variante ?? 0), 0)

      const sorted = [...vars].sort((a, b) => {
        const na = parseFloat(a.variante ?? ''), nb = parseFloat(b.variante ?? '')
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return (a.variante ?? '').localeCompare(b.variante ?? '', 'es')
      })

      return {
        codigo_modelo,
        description:  p?.description ?? null,
        category:     p?.category    ?? null,
        familia:      p?.familia     ?? null,
        metal:        p?.metal       ?? null,
        karat:        p?.karat       ?? null,
        image_url:    imageMap[codigo_modelo] ?? null,
        precio_venta: leader?.precio_venta    ?? null,
        stock_total:  stock,
        variantes:    sorted.map(v => v.variante).filter(Boolean) as string[],
      }
    })
    .sort((a, b) => {
      const mc = (a.metal ?? '').localeCompare(b.metal ?? '', 'es')
      if (mc !== 0) return mc
      const fc = (a.familia ?? '').localeCompare(b.familia ?? '', 'es')
      if (fc !== 0) return fc
      return (a.description ?? '').localeCompare(b.description ?? '', 'es')
    })
}

export default async function PedidosPage() {
  const rows = await getPedidosData()
  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-5">
      <PedidosTable rows={rows} />
    </div>
  )
}
