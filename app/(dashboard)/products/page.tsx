import { Suspense } from 'react'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, EmptyState } from '@/components/ui'
import { ProductFilters } from './ProductFilters'
import { ProductsTable } from './ProductsTable'
import { calcularCompletitud } from '@/lib/completitud'

const PAGE_SIZE = 60
const SUPABASE_PAGE = 1000 // límite por defecto de filas de Supabase
const IN_CHUNK = 200       // códigos por .in() para no generar URLs demasiado largas

// ── Types ─────────────────────────────────────────────────────────

type ProductRow = {
  codigo_modelo:      string
  description:        string | null
  category:           string | null
  familia:            string | null
  metal:              string | null
  karat:              string | null
  num_variantes:      number | null
  ingresos_12m:       number | null
  abc_ventas:         string | null
  metabase_synced_at: string | null
  is_discontinued:    boolean
  lifecycle_status:   string | null
}

type FilterOption = {
  metal:          string | null
  category:       string | null
  familia:        string | null
  karat:          string | null
  shopify_vendor: string | null
  supplier_name:  string | null
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
  const proveedor   = str('proveedor')
  const estado      = str('estado')
  const campaign    = str('campaign')
  const stockMin    = Math.max(0, Number(searchParams.stock_min ?? 0))
  const page        = Math.max(1, Number(searchParams.page ?? 1))
  const offset      = (page - 1) * PAGE_SIZE

  const supabase = createServerClient()

  // Base query. Se construye con una función porque los builders de postgrest-js
  // son mutables: reutilizar la query principal con otro .select() le cambia las columnas.
  function buildProductsQuery(columns: string, withCount = false) {
    let q = supabase.from('products').select(columns, withCount ? { count: 'exact' } : undefined)
    if (search)    q = q.or(`description.ilike.%${search}%,codigo_modelo.ilike.%${search}%`)
    if (metal)     q = q.eq('metal', metal)
    if (category)  q = q.eq('category', category)
    if (familia)   q = q.eq('familia', familia)
    if (karat)     q = q.eq('karat', karat)
    if (abc)       q = q.eq('abc_ventas', abc)
    if (supplier)  q = q.eq('shopify_vendor',  supplier)
    if (proveedor) q = q.eq('supplier_name',   proveedor)
    if (estado === 'catalogo')      q = q.eq('is_discontinued', false)
    if (estado === 'descatalogado') q = q.eq('is_discontinued', true)
    return q
  }

  // Todos los códigos que cumplen los filtros base, paginando para no cortar en 1000 filas
  async function fetchFilteredCodes(): Promise<string[]> {
    const codes: string[] = []
    for (let from = 0; ; from += SUPABASE_PAGE) {
      const { data, error } = await buildProductsQuery('codigo_modelo')
        .order('codigo_modelo')
        .range(from, from + SUPABASE_PAGE - 1)
      if (error) throw new Error(`Error filtrando productos: ${error.message}`)
      const rows = (data ?? []) as unknown as { codigo_modelo: string }[]
      codes.push(...rows.map(r => r.codigo_modelo))
      if (rows.length < SUPABASE_PAGE) return codes
    }
  }

  // Filas de una tabla para un conjunto de modelos, troceando el .in() y paginando cada trozo
  async function fetchByCodes<T>(table: string, columns: string, codes: string[]): Promise<T[]> {
    const out: T[] = []
    for (let i = 0; i < codes.length; i += IN_CHUNK) {
      const chunk = codes.slice(i, i + IN_CHUNK)
      for (let from = 0; ; from += SUPABASE_PAGE) {
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .in('codigo_modelo', chunk)
          .order('codigo_modelo')
          .range(from, from + SUPABASE_PAGE - 1)
        if (error) throw new Error(`Error leyendo ${table}: ${error.message}`)
        const rows = (data ?? []) as unknown as T[]
        out.push(...rows)
        if (rows.length < SUPABASE_PAGE) break
      }
    }
    return out
  }

  let productsQuery = buildProductsQuery(
    'codigo_modelo, description, category, familia, metal, karat, num_variantes, ingresos_12m, abc_ventas, metabase_synced_at, is_discontinued, lifecycle_status',
    true
  )
    .order('abc_ventas',   { ascending: true,  nullsFirst: false })
    .order('ingresos_12m', { ascending: false, nullsFirst: false })

  // ── Code-based filters (campaign, completitud, stock_min) ──

  let allowedCodes: Set<string> | null = null

  function intersect(codes: string[]) {
    if (allowedCodes === null) allowedCodes = new Set(codes)
    else allowedCodes = new Set(codes.filter(c => allowedCodes!.has(c)))
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
    const baseCodes = await fetchFilteredCodes()
    const effectiveCodes = allowedCodes ? baseCodes.filter(c => allowedCodes!.has(c)) : baseCodes

    let compCodes: string[] = []
    if (effectiveCodes.length > 0) {
      const [imgRows, fieldRes] = await Promise.all([
        fetchByCodes<{ codigo_modelo: string; is_primary: boolean }>(
          'product_images', 'codigo_modelo, is_primary', effectiveCodes),
        supabase.from('custom_field_definitions').select('field_key').eq('is_active', true),
      ])
      const primarySet    = new Set(imgRows.filter(r => r.is_primary).map(r => r.codigo_modelo))
      const additionalSet = new Set(imgRows.filter(r => !r.is_primary).map(r => r.codigo_modelo))
      const totalDefs     = (fieldRes.data ?? []).length
      compCodes = effectiveCodes.filter(code =>
        calcularCompletitud({
          hasImagenPrimaria:        primarySet.has(code),
          hasImagenAdicional:       additionalSet.has(code),
          hasDescripcionCustom:     false,
          camposCustomRellenos:     0,
          totalCamposCustomActivos: totalDefs,
        }).nivel === completitud
      )
    }
    allowedCodes = new Set(compCodes)
  }

  // Stock min filter
  if (stockMin > 0) {
    const baseCodes = await fetchFilteredCodes()
    const effectiveCodes = allowedCodes ? baseCodes.filter(c => allowedCodes!.has(c)) : baseCodes

    let stockCodes: string[] = []
    if (effectiveCodes.length > 0) {
      const stockData = await fetchByCodes<{ codigo_modelo: string; stock_variante: number | null }>(
        'product_variants', 'codigo_modelo, stock_variante', effectiveCodes)
      const stockByModel: Record<string, number> = {}
      for (const v of stockData) {
        stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
      }
      stockCodes = effectiveCodes.filter(c => (stockByModel[c] ?? 0) >= stockMin)
    }
    allowedCodes = new Set(stockCodes)
  }

  // Apply intersection
  if (allowedCodes !== null) {
    const arr = Array.from(allowedCodes)
    if (arr.length === 0) {
      const [optRes, camRes] = await Promise.all([
        supabase.from('products').select('metal, category, familia, karat, shopify_vendor, supplier_name'),
        supabase.from('campaigns').select('id, nombre').eq('estado', 'activa').order('nombre'),
      ])
      const allOpts    = (optRes.data ?? []) as FilterOption[]
      const uniq       = (key: keyof FilterOption) =>
        Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()
      const campaigns  = (camRes.data ?? []) as { id: string; nombre: string }[]
      return (
        <div className="p-6 max-w-[1400px] space-y-5">
          <PageHeader eyebrow="Catálogo" title="Productos" subtitle="0 modelos encontrados" />
          <Suspense>
            <ProductFilters
              metals={uniq('metal')} categories={uniq('category')} familias={uniq('familia')}
              karats={uniq('karat')} suppliers={uniq('shopify_vendor')} proveedores={uniq('supplier_name')} campaigns={campaigns}
            />
          </Suspense>
          <EmptyState icon="◻" message="Sin resultados" description="Ningún modelo coincide con los filtros activos." />
        </div>
      )
    }
    productsQuery = productsQuery.in('codigo_modelo', arr)
  }

  const paginatedQuery = productsQuery.range(offset, offset + PAGE_SIZE - 1)

  const [productsResult, optionsResult, campaignsResult] = await Promise.all([
    paginatedQuery,
    supabase.from('products').select('metal, category, familia, karat, shopify_vendor, supplier_name'),
    supabase.from('campaigns').select('id, nombre').eq('estado', 'activa').order('nombre'),
  ])

  const products   = (productsResult.data ?? []) as unknown as ProductRow[]
  const total      = allowedCodes ? (allowedCodes as Set<string>).size : (productsResult.count ?? 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Phase 2: images + stock + completitud
  const codes = products.map(p => p.codigo_modelo)
  const [imagesResult, imgCountResult, fieldDefsResult, leaderSlugsResult, stockResult, shopifyStatusResult] =
    codes.length > 0
      ? await Promise.all([
          supabase.from('product_images').select('codigo_modelo, url').in('codigo_modelo', codes).eq('is_primary', true),
          supabase.from('product_images').select('codigo_modelo').in('codigo_modelo', codes),
          supabase.from('custom_field_definitions').select('field_key').eq('is_active', true),
          supabase.from('product_variants').select('codigo_modelo, slug').in('codigo_modelo', codes).eq('es_variante_lider', true),
          supabase.from('product_variants').select('codigo_modelo, stock_variante').in('codigo_modelo', codes),
          supabase.from('product_shopify_data').select('codigo_modelo, shopify_status').in('codigo_modelo', codes),
        ])
      : [
          { data: [] as { codigo_modelo: string; url: string }[] },
          { data: [] as { codigo_modelo: string }[] },
          { data: [] as { field_key: string }[] },
          { data: [] as { codigo_modelo: string; slug: string }[] },
          { data: [] as { codigo_modelo: string; stock_variante: number | null }[] },
          { data: [] as { codigo_modelo: string; shopify_status: string | null }[] },
        ]

  const imageMap      = Object.fromEntries((imagesResult.data ?? []).map(r => [r.codigo_modelo, r.url]))
  const slugMap       = Object.fromEntries((leaderSlugsResult.data ?? []).map(r => [r.codigo_modelo, r.slug]))
  const shopifyMap    = Object.fromEntries(((shopifyStatusResult as { data: { codigo_modelo: string; shopify_status: string | null }[] | null }).data ?? []).map(r => [r.codigo_modelo, r.shopify_status]))

  const stockByModel: Record<string, number> = {}
  for (const v of (stockResult.data ?? [])) {
    stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
  }

  const primarySet       = new Set((imagesResult.data ?? []).map(r => r.codigo_modelo))
  const imgCounts: Record<string, number> = {}
  for (const r of imgCountResult.data ?? []) {
    imgCounts[r.codigo_modelo] = (imgCounts[r.codigo_modelo] ?? 0) + 1
  }
  const totalActiveDefs = (fieldDefsResult.data ?? []).length

  function getCompletitud(codigo: string) {
    return calcularCompletitud({
      hasImagenPrimaria:        primarySet.has(codigo),
      hasImagenAdicional:       (imgCounts[codigo] ?? 0) >= 2,
      hasDescripcionCustom:     false,
      camposCustomRellenos:     0,
      totalCamposCustomActivos: totalActiveDefs,
    })
  }

  const productRows = products.map(p => {
    const comp = getCompletitud(p.codigo_modelo)
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
      leaderSlug:       slugMap[p.codigo_modelo]  ?? null,
      completitudPct:   comp.score,
      completitudNivel: comp.nivel,
      is_discontinued:  p.is_discontinued ?? false,
      lifecycle_status: p.lifecycle_status ?? 'activo',
      stock_total:      stockByModel[p.codigo_modelo] ?? 0,
      shopify_status:   shopifyMap[p.codigo_modelo] ?? null,
    }
  })

  const allOpts     = (optionsResult.data ?? []) as FilterOption[]
  const uniq        = (key: keyof FilterOption) =>
    Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()
  const campaignOpts = (campaignsResult.data ?? []) as { id: string; nombre: string }[]

  const hasFilters = search || metal || category || familia || karat || abc || completitud || supplier || proveedor || estado || campaign || stockMin > 0

  return (
    <div className="p-6 max-w-[1400px] space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Catálogo"
          title="Productos"
          subtitle={`${total.toLocaleString('es-ES')} modelos${hasFilters ? ' encontrados' : ' en el catálogo'}`}
        />
        <Link
          href="/products/batch"
          className="shrink-0 mt-1 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-slate-50"
          style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
        >
          Edición en lote
        </Link>
      </div>

      <Suspense>
        <ProductFilters
          metals={uniq('metal')}
          categories={uniq('category')}
          familias={uniq('familia')}
          karats={uniq('karat')}
          suppliers={uniq('shopify_vendor')}
          proveedores={uniq('supplier_name')}
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
