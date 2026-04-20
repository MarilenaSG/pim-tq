import { Suspense } from 'react'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, EmptyState } from '@/components/ui'
import { ProductFilters } from './ProductFilters'

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
  metal:    string | null
  category: string | null
  familia:  string | null
  karat:    string | null
}

// ── Page ──────────────────────────────────────────────────────────

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const str = (k: string) => String(searchParams[k] ?? '')
  const search   = str('search')
  const metal    = str('metal')
  const category = str('category')
  const familia  = str('familia')
  const karat    = str('karat')
  const abc      = str('abc')
  const page     = Math.max(1, Number(searchParams.page ?? 1))
  const offset   = (page - 1) * PAGE_SIZE

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

  productsQuery = productsQuery
    .order('abc_ventas',          { ascending: true,  nullsFirst: false })
    .order('ingresos_12m', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const [productsResult, optionsResult] = await Promise.all([
    productsQuery,
    supabase.from('products').select('metal, category, familia, karat'),
  ])

  const products   = (productsResult.data ?? []) as ProductRow[]
  const total      = productsResult.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Phase 2: images + shopify status for visible products
  const codes = products.map(p => p.codigo_modelo)
  const [imagesResult, shopifyResult] =
    codes.length > 0
      ? await Promise.all([
          supabase
            .from('product_images')
            .select('codigo_modelo, url')
            .in('codigo_modelo', codes)
            .eq('is_primary', true),
          supabase
            .from('product_shopify_data')
            .select('codigo_modelo, shopify_status')
            .in('codigo_modelo', codes),
        ])
      : [
          { data: [] as { codigo_modelo: string; url: string }[] },
          { data: [] as { codigo_modelo: string; shopify_status: string }[] },
        ]

  const imageMap   = Object.fromEntries((imagesResult.data ?? []).map(r => [r.codigo_modelo, r.url]))
  const shopifyMap = Object.fromEntries((shopifyResult.data ?? []).map(r => [r.codigo_modelo, r.shopify_status]))

  // Distinct filter options
  const allOpts    = (optionsResult.data ?? []) as FilterOption[]
  const uniq       = (key: keyof FilterOption) =>
    Array.from(new Set(allOpts.map(r => r[key]).filter((v): v is string => !!v))).sort()

  const hasFilters = search || metal || category || familia || karat || abc

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
          {/* Table */}
          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                  <th className="w-14 px-3 py-3" />
                  {(['Código', 'Descripción', 'Metal / Qt', 'Familia', 'ABC', 'Ingresos 12m', 'Vars', 'Shopify'] as const).map(h => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: '#b2b2b2' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr
                    key={p.codigo_modelo}
                    className="hover:bg-[rgba(0,85,127,0.02)] transition-colors"
                    style={{ borderBottom: i < products.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none' }}
                  >
                    {/* Imagen */}
                    <td className="px-3 py-2">
                      {imageMap[p.codigo_modelo] ? (
                        <img
                          src={imageMap[p.codigo_modelo]}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                          style={{ background: '#f5f3f0' }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-base"
                          style={{ background: 'rgba(0,85,127,0.06)', color: '#d0cdc9' }}
                        >
                          ◫
                        </div>
                      )}
                    </td>

                    {/* Código */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={`/products/${p.codigo_modelo}`}
                        className="font-mono text-xs font-bold text-tq-sky hover:underline"
                      >
                        {p.codigo_modelo}
                      </Link>
                    </td>

                    {/* Descripción */}
                    <td className="px-3 py-2 max-w-xs">
                      <span className="line-clamp-2 text-xs leading-snug text-tq-snorkel">
                        {p.description ?? '—'}
                      </span>
                    </td>

                    {/* Metal / Quilates */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-tq-snorkel">{p.metal ?? '—'}</span>
                      {p.karat && (
                        <span
                          className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(200,161,100,0.15)', color: '#8a6830' }}
                        >
                          {p.karat}
                        </span>
                      )}
                    </td>

                    {/* Familia */}
                    <td className="px-3 py-2 text-xs" style={{ color: '#b2b2b2' }}>
                      {p.familia ?? '—'}
                    </td>

                    {/* ABC */}
                    <td className="px-3 py-2">
                      <AbcBadge abc={p.abc_ventas} />
                    </td>

                    {/* Ingresos 12m */}
                    <td className="px-3 py-2 font-mono text-xs text-right text-tq-snorkel whitespace-nowrap">
                      {p.ingresos_12m != null
                        ? p.ingresos_12m.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
                        : '—'}
                    </td>

                    {/* Variantes */}
                    <td className="px-3 py-2 text-xs text-center" style={{ color: '#b2b2b2' }}>
                      {p.num_variantes ?? '—'}
                    </td>

                    {/* Shopify */}
                    <td className="px-3 py-2">
                      <ShopifyCell status={shopifyMap[p.codigo_modelo] ?? null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

function AbcBadge({ abc }: { abc: string | null }) {
  if (!abc) return <span style={{ color: '#d0cdc9' }}>—</span>
  const cfg: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54' },
    B: { bg: 'rgba(0,153,242,0.12)',   text: '#007acc' },
    C: { bg: 'rgba(200,132,42,0.12)',  text: '#a06818' },
  }
  const { bg, text } = cfg[abc] ?? { bg: 'rgba(0,85,127,0.06)', text: '#b2b2b2' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: bg, color: text }}
    >
      {abc}
    </span>
  )
}

function ShopifyCell({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px]" style={{ color: '#d0cdc9' }}>—</span>
  const color =
    status === 'active' ? '#3A9E6A' :
    status === 'draft'  ? '#C8842A' : '#b2b2b2'
  return (
    <span className="text-[10px] font-bold capitalize" style={{ color }}>
      {status}
    </span>
  )
}

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
