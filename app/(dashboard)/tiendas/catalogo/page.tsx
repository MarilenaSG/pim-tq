import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import TiendasCatalogoClient from './TiendasCatalogoClient'

export const revalidate = 300

async function loadData(search: string, familia: string, metal: string) {
  const supabase = createServerClient()

  let query = supabase
    .from('products')
    .select(`
      codigo_modelo, description, familia, metal, karat,
      supplier_name, num_variantes, lista_variantes, primera_entrada,
      product_variants(
        variante, precio_venta, precio_tachado, descuento_aplicado,
        stock_variante, es_variante_lider
      ),
      product_images(url, is_primary, orden)
    `)
    .eq('is_discontinued', false)
    .order('description', { ascending: true })
    .limit(200)

  if (search) query = query.ilike('description', `%${search}%`)
  if (familia && familia !== 'all') query = query.eq('familia', familia)
  if (metal && metal !== 'all') query = query.eq('metal', metal)

  const [productsRes, familiasRes, metalesRes] = await Promise.all([
    query,
    supabase.from('products').select('familia').eq('is_discontinued', false).not('familia', 'is', null),
    supabase.from('products').select('metal').eq('is_discontinued', false).not('metal', 'is', null),
  ])

  const familiasSet = new Set((familiasRes.data ?? []).map(p => p.familia as string))
  const metalesSet  = new Set((metalesRes.data ?? []).map(p => p.metal as string))
  const familias = Array.from(familiasSet).sort()
  const metales  = Array.from(metalesSet).sort()

  return { products: productsRes.data ?? [], familias, metales }
}

export default async function TiendasCatalogoPage({
  searchParams,
}: {
  searchParams?: Record<string, string>
}) {
  const sp = searchParams ?? {}
  const { products, familias, metales } = await loadData(
    sp.q ?? '',
    sp.familia ?? 'all',
    sp.metal ?? 'all',
  )

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        eyebrow="Zona Tiendas"
        title="Catálogo"
        subtitle={`${products.length} productos activos — sin datos financieros`}
      />
      <TiendasCatalogoClient
        products={products as Parameters<typeof TiendasCatalogoClient>[0]['products']}
        familias={familias}
        metales={metales}
        initialSearch={sp.q ?? ''}
        initialFamilia={sp.familia ?? 'all'}
        initialMetal={sp.metal ?? 'all'}
      />
    </div>
  )
}
