import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { CatalogGrid } from './CatalogGrid'

export const revalidate = 3600

interface SearchParams {
  search?:   string
  metal?:    string
  familia?:  string
  category?: string
  estado?:   'catalogo' | 'descatalogado'
}

async function getCatalogData(params: SearchParams) {
  const supabase = createServerClient()

  // Base query — never expose financial fields
  let query = supabase
    .from('products')
    .select(`
      codigo_modelo, description, category, familia, metal, karat,
      num_variantes, lista_variantes, is_discontinued
    `)
    .order('familia',     { ascending: true, nullsFirst: false })
    .order('description', { ascending: true, nullsFirst: false })

  if (params.search)   query = query.or(`description.ilike.%${params.search}%,codigo_modelo.ilike.%${params.search}%`)
  if (params.metal)    query = query.eq('metal',    params.metal)
  if (params.familia)  query = query.eq('familia',  params.familia)
  if (params.category) query = query.eq('category', params.category)
  // estado se aplica en cliente tras calcular stock_total (evita falsos negativos por is_discontinued a nivel modelo)

  const { data: products } = await query
  if (!products?.length) return { products: [], filterOptions: { metals: [], familias: [], categories: [] } }

  const codes = products.map(p => p.codigo_modelo)

  const [imagesRes, variantsRes, shopifyRes, filterRes] = await Promise.all([
    supabase
      .from('product_images')
      .select('codigo_modelo, url, source')
      .in('codigo_modelo', codes)
      .eq('is_primary', true)
      .order('source'),
    supabase
      .from('product_variants')
      .select('codigo_modelo, slug, variante, precio_venta, stock_variante, es_variante_lider, is_discontinued')
      .in('codigo_modelo', codes)
      .order('es_variante_lider', { ascending: false }),
    supabase
      .from('product_shopify_data')
      .select('codigo_modelo, shopify_vendor, shopify_status')
      .in('codigo_modelo', codes),
    supabase
      .from('products')
      .select('metal, familia, category'),
  ])

  const imageMap = Object.fromEntries(
    (imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url])
  )

  const variantMap = new Map<string, typeof variantsRes.data>()
  for (const v of (variantsRes.data ?? [])) {
    if (!variantMap.has(v.codigo_modelo)) variantMap.set(v.codigo_modelo, [])
    variantMap.get(v.codigo_modelo)!.push(v)
  }

  const shopifyMap = Object.fromEntries(
    (shopifyRes.data ?? []).map(r => [r.codigo_modelo, r])
  )

  const allOpts = filterRes.data ?? []
  const uniq    = (key: 'metal' | 'familia' | 'category') =>
    Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()

  const enriched = products.map(p => {
    const variants = variantMap.get(p.codigo_modelo) ?? []
    const shopify  = shopifyMap[p.codigo_modelo]

    // Model is discontinued only when ALL variants are discontinued
    const allDiscontinued = variants.length > 0 && variants.every(v => v.is_discontinued)

    // Visible: active variants (any stock) + discontinued variants with stock > 0
    const visible = variants.filter(v => !v.is_discontinued || (v.stock_variante ?? 0) > 0)

    const leader     = variants.find(v => v.es_variante_lider) ?? variants[0]
    const stockTotal = visible.reduce((acc, v) => acc + (v.stock_variante ?? 0), 0)

    return {
      ...p,
      image_url:       imageMap[p.codigo_modelo] ?? null,
      precio_venta:    leader?.precio_venta      ?? null,
      slug_lider:      leader?.slug              ?? null,
      marca:           shopify?.shopify_vendor   ?? null,
      activo:          shopify?.shopify_status === 'active',
      stock_total:     stockTotal,
      is_discontinued: allDiscontinued,
      variants: visible.map(v => ({
        variante:        v.variante,
        precio_venta:    v.precio_venta,
        stock:           v.stock_variante,
        is_discontinued: v.is_discontinued ?? false,
      })),
    }
  })
  .filter(p => {
    // No visible variants → hide completely
    if (p.variants.length === 0) return false
    // "En catálogo": at least one active (non-discontinued) variant
    if (params.estado === 'catalogo')      return !p.is_discontinued
    // "Descatalogado": all variants are discontinued (but some may still have stock)
    if (params.estado === 'descatalogado') return p.is_discontinued
    // Default: show all models that have at least one visible variant
    return true
  })

  return {
    products: enriched,
    filterOptions: {
      metals:     uniq('metal'),
      familias:   uniq('familia'),
      categories: uniq('category'),
    },
  }
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const str = (k: string) => String(searchParams[k] ?? '')
  const rawEstado = str('estado')
  const params: SearchParams = {
    search:   str('search')   || undefined,
    metal:    str('metal')    || undefined,
    familia:  str('familia')  || undefined,
    category: str('category') || undefined,
    estado:   (rawEstado === 'catalogo' || rawEstado === 'descatalogado') ? rawEstado : undefined,
  }

  const { products, filterOptions } = await getCatalogData(params)

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-5">
      <Suspense>
        <CatalogGrid
          products={products}
          filterOptions={filterOptions}
          activeFilters={params}
        />
      </Suspense>
    </div>
  )
}
