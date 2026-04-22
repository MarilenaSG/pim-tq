import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase/server'
import { CatalogGrid } from './CatalogGrid'

export const revalidate = 3600 // revalidate every hour

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
    .order('familia',       { ascending: true,  nullsFirst: false })
    .order('description',   { ascending: true,  nullsFirst: false })

  if (params.search)                      query = query.or(`description.ilike.%${params.search}%,codigo_modelo.ilike.%${params.search}%`)
  if (params.metal)                       query = query.eq('metal',             params.metal)
  if (params.familia)                     query = query.eq('familia',           params.familia)
  if (params.category)                    query = query.eq('category',          params.category)
  if (params.estado === 'catalogo')       query = query.eq('is_discontinued',   false)
  if (params.estado === 'descatalogado')  query = query.eq('is_discontinued',   true)

  const { data: products } = await query
  if (!products?.length) return { products: [], filterOptions: { metals: [], familias: [], categories: [] } }

  const codes = products.map(p => p.codigo_modelo)

  // Images, prices (leader variant), shopify vendor — all in parallel
  const [imagesRes, variantsRes, shopifyRes, filterRes] = await Promise.all([
    supabase
      .from('product_images')
      .select('codigo_modelo, url, source')
      .in('codigo_modelo', codes)
      .eq('is_primary', true)
      .order('source'), // shopify before s3
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

  // Build lookup maps
  const imageMap = Object.fromEntries(
    (imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url])
  )

  // Group variants by model
  const variantMap = new Map<string, typeof variantsRes.data>()
  for (const v of (variantsRes.data ?? [])) {
    if (!variantMap.has(v.codigo_modelo)) variantMap.set(v.codigo_modelo, [])
    variantMap.get(v.codigo_modelo)!.push(v)
  }

  const shopifyMap = Object.fromEntries(
    (shopifyRes.data ?? []).map(r => [r.codigo_modelo, r])
  )

  // Filter options
  const allOpts   = filterRes.data ?? []
  const uniq      = (key: 'metal' | 'familia' | 'category') =>
    Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()

  const enriched = products.map(p => {
    const variants   = variantMap.get(p.codigo_modelo) ?? []
    const leader     = variants.find(v => v.es_variante_lider) ?? variants[0]
    const shopify    = shopifyMap[p.codigo_modelo]
    const stockTotal = variants.reduce((acc, v) => acc + (v.stock_variante ?? 0), 0)

    return {
      ...p,
      image_url:    imageMap[p.codigo_modelo]    ?? null,
      precio_venta: leader?.precio_venta         ?? null,
      slug_lider:   leader?.slug                 ?? null,
      marca:        shopify?.shopify_vendor       ?? null,
      activo:       shopify?.shopify_status === 'active',
      stock_total:  stockTotal,
      variants:     variants.map(v => ({
        variante:        v.variante,
        precio_venta:    v.precio_venta,
        stock:           v.stock_variante,
        is_discontinued: v.is_discontinued ?? false,
      })),
    }
  })
  .filter(p => params.estado === 'descatalogado' || !(p.is_discontinued && p.stock_total === 0))

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
    <div className="min-h-screen" style={{ background: '#f4f1ee' }}>
      {/* Header */}
      <header style={{ background: '#00557f' }} className="px-4 py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/icon_cream.png"
              alt="Te Quiero Joyerías"
              width={36}
              height={36}
              className="shrink-0 opacity-90"
            />
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-white/50 leading-none mb-1">
                Te Quiero Joyerías
              </p>
              <h1 className="text-lg font-bold text-white leading-none">
                Catálogo de producto
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">{products.length} modelos</span>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/20"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
            >
              ← PIM
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5">
        <Suspense>
          <CatalogGrid
            products={products}
            filterOptions={filterOptions}
            activeFilters={params}
          />
        </Suspense>
      </div>
    </div>
  )
}
