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
  is_discontinued:    boolean
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
  const estado      = str('estado')      // 'catalogo' | 'descatalogado'
  const vendor      = str('vendor')      // shopify_vendor
  const campaign    = str('campaign')    // campaign id
  const stockMin    = Math.max(0, Number(searchParams.stock_min ?? 0))
  const page        = Math.max(1, Number(searchParams.page ?? 1))
  const offset      = (page - 1) * PAGE_SIZE

  const supabase = createServerClient()

  // Base query
  let productsQuery = supabase
    .from('products')
    .select(
      'codigo_modelo, description, category, familia, metal, karat, num_variantes, ingresos_12m, abc_ventas, metabase_synced_at, shopify_synced_at, is_discontinued',
      { count: 'exact' }
    )

  if (search)   productsQuery = productsQuery.or(`description.ilike.%${search}%,codigo_modelo.ilike.%${search}%`)
  if (metal)    productsQuery = productsQuery.eq('metal', metal)
  if (category) productsQuery = productsQuery.eq('category', category)
  if (familia)  productsQuery = productsQuery.eq('familia', familia)
  if (karat)    productsQuery = productsQuery.eq('karat', karat)
  if (abc)      productsQuery = productsQuery.eq('abc_ventas', abc)
  if (supplier) productsQuery = productsQuery.eq('supplier_name', supplier)
  if (estado === 'catalogo')      productsQuery = productsQuery.eq('is_discontinued', false)
  if (estado === 'descatalogado') productsQuery = productsQuery.eq('is_discontinued', true)

  productsQuery = productsQuery
    .order('abc_ventas',   { ascending: true,  nullsFirst: false })
    .order('ingresos_12m', { ascending: false, nullsFirst: false })

  // ── Code-based filters (vendor, campaign, completitud, stock_min) ──
  // Each resolves to a set of allowed codes; we take the intersection.

  let allowedCodes: Set<string> | null = null

  function intersect(codes: string[]) {
    if (allowedCodes === null) allowedCodes = new Set(codes)
    else allowedCodes = new Set(codes.filter(c => allowedCodes!.has(c)))
  }

  // Vendor filter
  if (vendor) {
    const { data } = await supabase
      .from('product_shopify_data')
      .select('codigo_modelo')
      .eq('shopify_vendor', vendor)
    intersect((data ?? []).map(r => r.codigo_modelo))
  }

  // Campaign filter
  if (campaign) {
    const { data } = await supabase
      .from('campaign_products')
      .select('codigo_modelo')
      .eq('campaign_id', campaign)
    intersect((data ?? []).map(r => r.codigo_modelo))
  }

  // Completitud filter
  if (completitud) {
    const { data: allProds } = await (productsQuery as typeof productsQuery).select('codigo_modelo')
    const baseCodes = (allProds ?? []).map((p: { codigo_modelo: string }) => p.codigo_modelo)
    const effectiveCodes = allowedCodes ? baseCodes.filter(c => allowedCodes!.has(c)) : baseCodes

    let compCodes: string[] = []
    if (effectiveCodes.length > 0) {
      const [imgRes, shopRes] = await Promise.all([
        supabase.from('product_images').select('codigo_modelo, is_primary').in('codigo_modelo', effectiveCodes),
        supabase.from('product_shopify_data').select('codigo_modelo, shopify_description, shopify_seo_title, shopify_tags').in('codigo_modelo', effectiveCodes),
      ])
      const primarySet    = new Set((imgRes.data ?? []).filter(r => r.is_primary).map(r => r.codigo_modelo))
      const additionalSet = new Set((imgRes.data ?? []).filter(r => !r.is_primary).map(r => r.codigo_modelo))
      const shopByModel   = Object.fromEntries((shopRes.data ?? []).map(r => [r.codigo_modelo, r]))
      compCodes = effectiveCodes.filter(code =>
        calcularCompletitud({
          hasImagenPrimaria:       primarySet.has(code),
          hasDescripcionShopify:   !!(shopByModel[code]?.shopify_description),
          hasTituloSEO:            !!(shopByModel[code]?.shopify_seo_title),
          hasTags:                 !!(shopByModel[code]?.shopify_tags?.length),
          hasImagenAdicional:      additionalSet.has(code),
          camposCustomRellenos:    0,
          totalCamposCustomActivos: 0,
        }).nivel === completitud
      )
    }
    allowedCodes = new Set(compCodes)
  }

  // Stock min filter
  if (stockMin > 0) {
    const { data: allProds } = await (productsQuery as typeof productsQuery).select('codigo_modelo')
    const baseCodes = (allProds ?? []).map((p: { codigo_modelo: string }) => p.codigo_modelo)
    const effectiveCodes = allowedCodes ? baseCodes.filter(c => allowedCodes!.has(c)) : baseCodes

    let stockCodes: string[] = []
    if (effectiveCodes.length > 0) {
      const { data: stockData } = await supabase
        .from('product_variants')
        .select('codigo_modelo, stock_variante')
        .in('codigo_modelo', effectiveCodes)
      const stockByModel: Record<string, number> = {}
      for (const v of stockData ?? []) {
        stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
      }
      stockCodes = effectiveCodes.filter(c => (stockByModel[c] ?? 0) >= stockMin)
    }
    allowedCodes = new Set(stockCodes)
  }

  // Apply the intersection
  if (allowedCodes !== null) {
    const arr = Array.from(allowedCodes)
    if (arr.length === 0) {
      // Short-circuit: no products match
      const [optRes, venRes, camRes] = await Promise.all([
        supabase.from('products').select('metal, category, familia, karat, supplier_name'),
        supabase.from('product_shopify_data').select('shopify_vendor'),
        supabase.from('campaigns').select('id, nombre').eq('estado', 'activa').order('nombre'),
      ])
      const allOpts = (optRes.data ?? []) as FilterOption[]
      const uniq = (key: keyof FilterOption) =>
        Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()
      const vendors   = Array.from(new Set((venRes.data ?? []).map(r => r.shopify_vendor).filter(Boolean))).sort() as string[]
      const campaigns = (camRes.data ?? []) as { id: string; nombre: string }[]
      return (
        <div className="p-6 max-w-[1400px] space-y-5">
          <PageHeader eyebrow="Catálogo" title="Productos" subtitle="0 modelos encontrados" />
          <Suspense>
            <ProductFilters
              metals={uniq('metal')} categories={uniq('category')} familias={uniq('familia')}
              karats={uniq('karat')} suppliers={uniq('supplier_name')}
              vendors={vendors} campaigns={campaigns}
            />
          </Suspense>
          <EmptyState icon="◻" message="Sin resultados" description="Ningún modelo coincide con los filtros activos." />
        </div>
      )
    }
    productsQuery = productsQuery.in('codigo_modelo', arr)
  }

  const paginatedQuery = productsQuery.range(offset, offset + PAGE_SIZE - 1)

  const [productsResult, optionsResult, vendorsResult, campaignsResult] = await Promise.all([
    paginatedQuery,
    supabase.from('products').select('metal, category, familia, karat, supplier_name'),
    supabase.from('product_shopify_data').select('shopify_vendor'),
    supabase.from('campaigns').select('id, nombre').eq('estado', 'activa').order('nombre'),
  ])

  const products   = (productsResult.data ?? []) as ProductRow[]
  const total      = allowedCodes ? (allowedCodes as Set<string>).size : (productsResult.count ?? 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Phase 2: images + shopify + stock + completitud for visible products
  const codes = products.map(p => p.codigo_modelo)
  const [imagesResult, shopifyResult, imgCountResult, shopifyFullResult, fieldDefsResult, leaderSlugsResult, stockResult] =
    codes.length > 0
      ? await Promise.all([
          supabase.from('product_images').select('codigo_modelo, url').in('codigo_modelo', codes).eq('is_primary', true),
          supabase.from('product_shopify_data').select('codigo_modelo, shopify_status, shopify_vendor').in('codigo_modelo', codes),
          supabase.from('product_images').select('codigo_modelo').in('codigo_modelo', codes),
          supabase.from('product_shopify_data').select('codigo_modelo, shopify_description, shopify_seo_title, shopify_tags').in('codigo_modelo', codes),
          supabase.from('custom_field_definitions').select('field_key').eq('is_active', true),
          supabase.from('product_variants').select('codigo_modelo, slug').in('codigo_modelo', codes).eq('es_variante_lider', true),
          supabase.from('product_variants').select('codigo_modelo, stock_variante').in('codigo_modelo', codes),
        ])
      : [
          { data: [] as { codigo_modelo: string; url: string }[] },
          { data: [] as { codigo_modelo: string; shopify_status: string; shopify_vendor: string | null }[] },
          { data: [] as { codigo_modelo: string }[] },
          { data: [] as { codigo_modelo: string; shopify_description: string | null; shopify_seo_title: string | null; shopify_tags: string[] | null }[] },
          { data: [] as { field_key: string }[] },
          { data: [] as { codigo_modelo: string; slug: string }[] },
          { data: [] as { codigo_modelo: string; stock_variante: number | null }[] },
        ]

  const imageMap   = Object.fromEntries((imagesResult.data ?? []).map(r => [r.codigo_modelo, r.url]))
  const shopifyMap = Object.fromEntries((shopifyResult.data ?? []).map(r => [r.codigo_modelo, r]))
  const slugMap    = Object.fromEntries((leaderSlugsResult.data ?? []).map(r => [r.codigo_modelo, r.slug]))

  // Stock totals per model
  const stockByModel: Record<string, number> = {}
  for (const v of (stockResult.data ?? [])) {
    stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
  }

  // Completitud
  const primarySet = new Set((imagesResult.data ?? []).map(r => r.codigo_modelo))
  const imgCounts: Record<string, number> = {}
  for (const r of imgCountResult.data ?? []) {
    imgCounts[r.codigo_modelo] = (imgCounts[r.codigo_modelo] ?? 0) + 1
  }
  const shopifyFullMap  = Object.fromEntries((shopifyFullResult.data ?? []).map(r => [r.codigo_modelo, r]))
  const totalActiveDefs = (fieldDefsResult.data ?? []).length

  function getCompletitud(codigo: string) {
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

  const productRows = products.map(p => {
    const comp   = getCompletitud(p.codigo_modelo)
    const shopify = shopifyMap[p.codigo_modelo]
    return {
      codigo_modelo:    p.codigo_modelo,
      description:      p.description,
      metal:            p.metal,
      karat:            p.karat,
      familia:          p.familia,
      num_variantes:    p.num_variantes,
      ingresos_12m:     p.ingresos_12m,
      abc_ventas:       p.abc_ventas,
      imageUrl:         imageMap[p.codigo_modelo] ?? null,
      shopifyStatus:    shopify?.shopify_status   ?? null,
      shopifyVendor:    shopify?.shopify_vendor   ?? null,
      leaderSlug:       slugMap[p.codigo_modelo]  ?? null,
      completitudPct:   comp.score,
      completitudNivel: comp.nivel,
      is_discontinued:  p.is_discontinued ?? false,
      stock_total:      stockByModel[p.codigo_modelo] ?? 0,
    }
  })

  const allOpts      = (optionsResult.data ?? []) as FilterOption[]
  const uniq         = (key: keyof FilterOption) =>
    Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()
  const vendors      = Array.from(new Set((vendorsResult.data ?? []).map(r => r.shopify_vendor).filter(Boolean))).sort() as string[]
  const campaignOpts = (campaignsResult.data ?? []) as { id: string; nombre: string }[]

  const hasFilters = search || metal || category || familia || karat || abc || completitud || supplier || estado || vendor || campaign || stockMin > 0

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
          vendors={vendors}
          campaigns={campaignOpts}
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
          <ProductsTable rows={productRows} campaigns={campaignOpts} />

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
          <Link href={buildHref(page - 1)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-tq-snorkel hover:bg-tq-alyssum">
            ← Anterior
          </Link>
        )}
        <span className="text-xs px-3 py-1.5 rounded-lg font-bold text-tq-snorkel" style={{ background: 'rgba(0,85,127,0.06)' }}>
          {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link href={buildHref(page + 1)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-tq-snorkel hover:bg-tq-alyssum">
            Siguiente →
          </Link>
        )}
      </div>
    </div>
  )
}
