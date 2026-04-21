import { Suspense } from 'react'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, EmptyState } from '@/components/ui'
import { ProductFilters } from './ProductFilters'
import { ProductsTable } from './ProductsTable'
import { calcularCompletitud } from '@/lib/completitud'

const PAGE_SIZE = 60

// ── Types ─────────────────────────────────────────────────────────

type ProductRow = {
  codigo_modelo:      string
  description:        string | null
  category:           string | null
  familia:            string | null
  metal:              string | null
  karat:              string | null
  num_variantes:      number | null
  ingresos_12m: number | null
  abc_ventas:         string | null
  metabase_synced_at: string | null
  shopify_synced_at:  string | null
}

type FilterOption = {
  metal:         string | null
  category:      string | null
  familia:       string | null
  karat:         string | null
  supplier_name: string | null
}

// ── Page ──────────────────────────────────────────────────────────

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const str = (k: string) => String(searchParams[k] ?? '')
  const search      = str('search')
  const metal       = str('metal')
  const category    = str('category')
  const familia     = str('familia')
  const karat       = str('karat')
  const abc         = str('abc')
  const completitud = str('completitud')
  const supplier    = str('supplier')
  const page        = Math.max(1, Number(searchParams.page ?? 1))
  const offset      = (page - 1) * PAGE_SIZE

  const supabase = createServerClient()

  // Phase 1: products + filter options in parallel
  let productsQuery = supabase
    .from('products')
    .select(
      'codigo_modelo, description, category, familia, metal, karat, num_variantes, ingresos_12m, abc_ventas, metabase_synced_at, shopify_synced_at',
      { count: 'exact' }
    )

  if (search)   productsQuery = productsQuery.or(`description.ilike.%${search}%,codigo_modelo.ilike.%${search}%`)
  if (metal)    productsQuery = productsQuery.eq('metal', metal)
  if (category) productsQuery = productsQuery.eq('category', category)
  if (familia)  productsQuery = productsQuery.eq('familia', familia)
  if (karat)    productsQuery = productsQuery.eq('karat', karat)
  if (abc)      productsQuery = productsQuery.eq('abc_ventas', abc)
  if (supplier) productsQuery = productsQuery.eq('supplier_name', supplier)

  productsQuery = productsQuery
    .order('abc_ventas',   { ascending: true,  nullsFirst: false })
    .order('ingresos_12m', { ascending: false, nullsFirst: false })

  // For completitud filter, we need to check all products before paginating
  let allCodesForCompletitud: string[] | null = null
  if (completitud) {
    const { data: allProds } = await productsQuery.select('codigo_modelo')
    const allCodes = (allProds ?? []).map((p: { codigo_modelo: string }) => p.codigo_modelo)

    if (allCodes.length > 0) {
      const [imgRes, shopRes] = await Promise.all([
        supabase.from('product_images').select('codigo_modelo, is_primary').in('codigo_modelo', allCodes),
        supabase.from('product_shopify_data').select('codigo_modelo, shopify_description, shopify_seo_title, shopify_tags').in('codigo_modelo', allCodes),
      ])
      const primarySet   = new Set((imgRes.data ?? []).filter(r => r.is_primary).map(r => r.codigo_modelo))
      const additionalSet = new Set((imgRes.data ?? []).filter(r => !r.is_primary).map(r => r.codigo_modelo))
      const shopByModel  = Object.fromEntries((shopRes.data ?? []).map(r => [r.codigo_modelo, r]))

      allCodesForCompletitud = allCodes.filter(code => {
        const score = calcularCompletitud({
          hasImagenPrimaria:      primarySet.has(code),
          hasDescripcionShopify:  !!(shopByModel[code]?.shopify_description),
          hasTituloSEO:           !!(shopByModel[code]?.shopify_seo_title),
          hasTags:                !!(shopByModel[code]?.shopify_tags?.length),
          hasImagenAdicional:     additionalSet.has(code),
          camposCustomRellenos:   0,
          totalCamposCustomActivos: 0,
        }).nivel === completitud
        return score
      })
    } else {
      allCodesForCompletitud = []
    }

    if (allCodesForCompletitud.length === 0) {
      // No products match — short-circuit
      const optionsResult = await supabase.from('products').select('metal, category, familia, karat')
      const allOpts = (optionsResult.data ?? []) as FilterOption[]
      const uniq = (key: keyof FilterOption) =>
        Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()
      return (
        <div className="p-6 max-w-[1400px] space-y-5">
          <PageHeader eyebrow="Catálogo" title="Productos" subtitle="0 modelos encontrados" />
          <Suspense><ProductFilters metals={uniq('metal')} categories={uniq('category')} familias={uniq('familia')} karats={uniq('karat')} suppliers={uniq('supplier_name')} /></Suspense>
          <EmptyState icon="◻" message="Sin resultados" description="Ningún modelo coincide con los filtros activos." />
        </div>
      )
    }

    productsQuery = productsQuery.in('codigo_modelo', allCodesForCompletitud)
  }

  const paginatedQuery = productsQuery.range(offset, offset + PAGE_SIZE - 1)

  const [productsResult, optionsResult, campaignsResult] = await Promise.all([
    paginatedQuery,
    supabase.from('products').select('metal, category, familia, karat, supplier_name'),
    supabase.from('campaigns').select('id, nombre').eq('estado', 'activa').order('nombre'),
  ])

  const products   = (productsResult.data ?? []) as ProductRow[]
  const total      = allCodesForCompletitud ? allCodesForCompletitud.length : (productsResult.count ?? 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Phase 2: images + shopify status + completitud data for visible products
  const codes = products.map(p => p.codigo_modelo)
  const [imagesResult, shopifyResult, imgCountResult, shopifyFullResult, fieldDefsResult, leaderSlugsResult] =
    codes.length > 0
      ? await Promise.all([
          supabase.from('product_images').select('codigo_modelo, url').in('codigo_modelo', codes).eq('is_primary', true),
          supabase.from('product_shopify_data').select('codigo_modelo, shopify_status').in('codigo_modelo', codes),
          supabase.from('product_images').select('codigo_modelo').in('codigo_modelo', codes),
          supabase.from('product_shopify_data').select('codigo_modelo, shopify_description, shopify_seo_title, shopify_tags').in('codigo_modelo', codes),
          supabase.from('custom_field_definitions').select('field_key').eq('is_active', true),
          supabase.from('product_variants').select('codigo_modelo, slug').in('codigo_modelo', codes).eq('es_variante_lider', true),
        ])
      : [
          { data: [] as { codigo_modelo: string; url: string }[] },
          { data: [] as { codigo_modelo: string; shopify_status: string }[] },
          { data: [] as { codigo_modelo: string }[] },
          { data: [] as { codigo_modelo: string; shopify_description: string | null; shopify_seo_title: string | null; shopify_tags: string[] | null }[] },
          { data: [] as { field_key: string }[] },
          { data: [] as { codigo_modelo: string; slug: string }[] },
        ]

  const imageMap    = Object.fromEntries((imagesResult.data ?? []).map(r => [r.codigo_modelo, r.url]))
  const shopifyMap  = Object.fromEntries((shopifyResult.data ?? []).map(r => [r.codigo_modelo, r.shopify_status]))
  const slugMap     = Object.fromEntries((leaderSlugsResult.data ?? []).map(r => [r.codigo_modelo, r.slug]))

  // Build completitud data per product
  const primarySet = new Set((imagesResult.data ?? []).map(r => r.codigo_modelo))
  const imgCounts: Record<string, number> = {}
  for (const r of imgCountResult.data ?? []) {
    imgCounts[r.codigo_modelo] = (imgCounts[r.codigo_modelo] ?? 0) + 1
  }
  const shopifyFullMap = Object.fromEntries((shopifyFullResult.data ?? []).map(r => [r.codigo_modelo, r]))
  const totalActiveDefs = (fieldDefsResult.data ?? []).length

  function getCompletitudForProduct(codigo: string) {
    return calcularCompletitud({
      hasImagenPrimaria:       primarySet.has(codigo),
      hasDescripcionShopify:   !!(shopifyFullMap[codigo]?.shopify_description),
      hasTituloSEO:            !!(shopifyFullMap[codigo]?.shopify_seo_title),
      hasTags:                 !!(shopifyFullMap[codigo]?.shopify_tags?.length),
      hasImagenAdicional:      (imgCounts[codigo] ?? 0) >= 2,
      camposCustomRellenos:    0,
      totalCamposCustomActivos: totalActiveDefs,
    })
  }

  // Build pre-computed rows for client table
  const productRows = products.map(p => {
    const comp = getCompletitudForProduct(p.codigo_modelo)
    return {
      codigo_modelo:    p.codigo_modelo,
      description:      p.description,
      metal:            p.metal,
      karat:            p.karat,
      familia:          p.familia,
      num_variantes:    p.num_variantes,
      ingresos_12m:     p.ingresos_12m,
      abc_ventas:       p.abc_ventas,
      imageUrl:         imageMap[p.codigo_modelo]   ?? null,
      shopifyStatus:    shopifyMap[p.codigo_modelo] ?? null,
      leaderSlug:       slugMap[p.codigo_modelo]    ?? null,
      completitudPct:   comp.score,
      completitudNivel: comp.nivel,
    }
  })

  const campaignOptions = (campaignsResult.data ?? []) as { id: string; nombre: string }[]

  // Distinct filter options
  const allOpts    = (optionsResult.data ?? []) as FilterOption[]
  const uniq       = (key: keyof FilterOption) =>
    Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()

  const hasFilters = search || metal || category || familia || karat || abc || completitud || supplier

  return (
    <div className="p-6 max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        subtitle={`${total.toLocaleString('es-ES')} modelos${hasFilters ? ' encontrados' : ' en el catálogo'}`}
      />

      <Suspense>
        <ProductFilters
          metals={uniq('metal')}
          categories={uniq('category')}
          familias={uniq('familia')}
          karats={uniq('karat')}
          suppliers={uniq('supplier_name')}
        />
      </Suspense>

      {products.length === 0 ? (
        <EmptyState
          icon="◻"
          message={hasFilters ? 'Sin resultados' : 'Catálogo vacío'}
          description={
            hasFilters
              ? 'Ningún modelo coincide con los filtros activos.'
              : 'Ejecuta el sync de Metabase para importar el catálogo.'
          }
          cta={hasFilters ? undefined : { label: 'Ir a sincronización', href: '/settings/sync' }}
        />
      ) : (
        <>
          <ProductsTable rows={productRows} campaigns={campaignOptions} />

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              searchParams={searchParams}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function PaginationBar({
  page, totalPages, total, pageSize, searchParams,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  function buildHref(p: number): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'page' || !v) continue
      params.set(k, Array.isArray(v) ? v[0] : v)
    }
    params.set('page', String(p))
    return `/products?${params.toString()}`
  }

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: '#b2b2b2' }}>
        Mostrando {from.toLocaleString('es-ES')}–{to.toLocaleString('es-ES')} de {total.toLocaleString('es-ES')}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link
            href={buildHref(page - 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-tq-snorkel hover:bg-tq-alyssum"
          >
            ← Anterior
          </Link>
        )}
        <span className="text-xs px-3 py-1.5 rounded-lg font-bold text-tq-snorkel"
          style={{ background: 'rgba(0,85,127,0.06)' }}>
          {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link
            href={buildHref(page + 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-tq-snorkel hover:bg-tq-alyssum"
          >
            Siguiente →
          </Link>
        )}
      </div>
    </div>
  )
}
