import { createServerClient } from '@/lib/supabase/server'
import { PedidosTable } from './PedidosTable'

export interface PedidoRow {
  codigo_modelo:   string
  description:     string | null
  category:        string | null
  familia:         string | null
  metal:           string | null
  karat:           string | null
  lista_variantes: string | null
  image_url:       string | null
  precio_venta:    number | null
  is_discontinued: boolean
}

async function getPedidosData(): Promise<PedidoRow[]> {
  const supabase = createServerClient()

  const { data: products } = await supabase
    .from('products')
    .select(`
      codigo_modelo,
      description,
      category,
      familia,
      metal,
      karat,
      num_variantes,
      lista_variantes,
      is_discontinued
    `)
    .order('metal',        { ascending: true, nullsFirst: false })
    .order('familia',      { ascending: true, nullsFirst: false })
    .order('description',  { ascending: true, nullsFirst: false })

  if (!products?.length) return []

  const codes = products.map(p => p.codigo_modelo)

  const [imagesRes, variantsRes] = await Promise.all([
    supabase
      .from('product_images')
      .select('codigo_modelo, url')
      .in('codigo_modelo', codes)
      .eq('is_primary', true),
    supabase
      .from('product_variants')
      .select('codigo_modelo, precio_venta, es_variante_lider')
      .in('codigo_modelo', codes)
      .order('es_variante_lider', { ascending: false }),
  ])

  const imageMap = Object.fromEntries(
    (imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url])
  )

  const leaderPriceMap = Object.fromEntries(
    (variantsRes.data ?? [])
      .filter(v => v.es_variante_lider)
      .map(v => [v.codigo_modelo, v.precio_venta])
  )

  return products.map(p => ({
    codigo_modelo:   p.codigo_modelo,
    description:     p.description,
    category:        p.category,
    familia:         p.familia,
    metal:           p.metal,
    karat:           p.karat,
    lista_variantes: p.lista_variantes,
    image_url:       imageMap[p.codigo_modelo]    ?? null,
    precio_venta:    leaderPriceMap[p.codigo_modelo] ?? null,
    is_discontinued: p.is_discontinued ?? false,
  }))
}

export default async function PedidosPage() {
  const rows = await getPedidosData()

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-5">
      <PedidosTable rows={rows} />
    </div>
  )
}
