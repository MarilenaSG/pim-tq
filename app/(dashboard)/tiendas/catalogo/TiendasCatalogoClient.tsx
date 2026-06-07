'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'

function buildExportUrl(base: string, filters: ActiveFilters): string {
  const p = new URLSearchParams()
  if (filters.search)   p.set('search',   filters.search)
  if (filters.metal)    p.set('metal',    filters.metal)
  if (filters.familia)  p.set('familia',  filters.familia)
  if (filters.category) p.set('category', filters.category)
  if (filters.estado)   p.set('estado',   filters.estado)
  return `${base}?${p.toString()}`
}

async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href  = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

interface Variant {
  variante:        string | null
  precio_venta:    number | null
  stock:           number | null
  is_discontinued: boolean
}

interface CatalogProduct {
  codigo_modelo:   string
  description:     string | null
  category:        string | null
  familia:         string | null
  metal:           string | null
  karat:           string | null
  num_variantes:   number | null
  image_url:       string | null
  precio_venta:    number | null
  slug_lider:      string | null
  marca:           string | null
  activo:          boolean
  is_discontinued: boolean
  stock_total:     number
  variants:        Variant[]
}

interface FilterOptions {
  metals:     string[]
  familias:   string[]
  categories: string[]
}

interface ActiveFilters {
  search?:   string
  metal?:    string
  familia?:  string
  category?: string
  estado?:   string
}

function sortVariante(a: string | null, b: string | null): number {
  const na = parseFloat(a ?? ''), nb = parseFloat(b ?? '')
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return (a ?? '').localeCompare(b ?? '', 'es')
}

// ── Product card ───────────────────────────────────────────────

function ProductCard({ p }: { p: CatalogProduct }) {
  const [expanded, setExpanded] = useState(false)
  const hasStock        = p.stock_total > 0
  const allDiscontinued = p.is_discontinued

  const visibleVariants = [
    ...p.variants.filter(v => !v.is_discontinued).sort((a, b) => sortVariante(a.variante, b.variante)),
    ...p.variants.filter(v =>  v.is_discontinued).sort((a, b) => sortVariante(a.variante, b.variante)),
  ]

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        boxShadow: '0 2px 8px rgba(0,32,60,0.08)',
        opacity: allDiscontinued && !hasStock ? 0.6 : 1,
      }}
    >
      {/* Image */}
      <div className="relative aspect-square bg-[#f4f1ee]">
        {allDiscontinued && (
          <div
            className="absolute top-0 left-0 right-0 text-center text-[10px] font-black tracking-widest uppercase py-1 z-10"
            style={{ background: 'rgba(80,80,80,0.88)', color: '#ffffff' }}
          >
            ✕ Descatalogado
          </div>
        )}
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.description ?? p.codigo_modelo}
            className="w-full h-full object-cover"
            loading="lazy"
            style={{ filter: allDiscontinued ? 'grayscale(30%)' : 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: '#d0cdc9' }}>
            ◫
          </div>
        )}

        {/* Stock badge */}
        <span
          className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={
            hasStock
              ? { background: 'rgba(58,158,106,0.9)', color: '#fff' }
              : { background: 'rgba(80,80,80,0.75)',  color: '#fff' }
          }
        >
          {hasStock ? `${p.stock_total} uds` : 'Sin stock'}
        </span>
      </div>

      {/* Info */}
      <div className="px-3 pt-3 pb-2">
        {/* Categoría + marca + familia */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          {p.category && (
            <span
              className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,85,127,0.07)', color: '#00557f' }}
            >
              {p.category}
            </span>
          )}
          {p.marca && (
            <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: '#C8842A' }}>
              {p.marca}
            </span>
          )}
          {p.marca && p.familia && <span style={{ color: '#d0cdc9' }}>·</span>}
          {p.familia && (
            <span className="text-[10px]" style={{ color: '#b2b2b2' }}>{p.familia}</span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm font-medium leading-snug text-[#00557f] line-clamp-2 mb-1.5">
          {p.description ?? p.codigo_modelo}
        </p>

        {/* Metal + karat + code */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {p.metal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(0,85,127,0.07)', color: '#00557f' }}>
              {p.metal}
            </span>
          )}
          {p.karat && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(200,161,100,0.15)', color: '#8a6830' }}>
              {p.karat}
            </span>
          )}
          <span className="text-[10px] font-mono ml-auto" style={{ color: '#b2b2b2' }}>
            {p.slug_lider ?? p.codigo_modelo}
          </span>
        </div>

        {/* Price */}
        {p.precio_venta != null && (
          <p className="text-base font-bold text-[#00557f] mb-2">
            {p.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        )}

        {/* Variants toggle */}
        {visibleVariants.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full text-xs font-semibold py-1.5 rounded-lg transition-colors"
            style={{
              background: expanded ? 'rgba(0,85,127,0.08)' : 'rgba(0,85,127,0.04)',
              color: '#00557f',
            }}
          >
            {expanded
              ? '▲ Ocultar tallas'
              : `▼ Ver ${visibleVariants.length} talla${visibleVariants.length !== 1 ? 's' : ''}`}
          </button>
        )}

        {/* Variants list */}
        {expanded && (
          <div className="mt-2 border-t border-[#f0ece8] pt-2 space-y-px">
            {/* Header */}
            <div className="flex justify-between text-[9px] font-semibold uppercase tracking-widest px-1 pb-1" style={{ color: '#c0bbb7' }}>
              <span>Talla</span>
              <div className="flex gap-4">
                <span>Precio</span>
                <span>Stock</span>
              </div>
            </div>
            {visibleVariants.map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-1 py-1"
                style={{ opacity: v.is_discontinued ? 0.45 : 1 }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium" style={{ color: '#00557f' }}>
                    {v.variante ?? '—'}
                  </span>
                  {v.is_discontinued && (
                    <span className="text-[8px] font-bold tracking-wide uppercase px-1 py-px rounded"
                      style={{ background: 'rgba(80,80,80,0.10)', color: '#888' }}>
                      desc.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span style={{ color: '#555' }}>
                    {v.precio_venta != null
                      ? v.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                      : '—'}
                  </span>
                  <span className="font-semibold w-10 text-right"
                    style={{ color: v.is_discontinued ? '#b2b2b2' : (v.stock ?? 0) > 0 ? '#3A9E6A' : '#C0392B' }}>
                    {v.stock ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main client ────────────────────────────────────────────────

export default function TiendasCatalogoClient({
  products,
  filterOptions,
  activeFilters,
}: {
  products:      CatalogProduct[]
  filterOptions: FilterOptions
  activeFilters: ActiveFilters
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [search,       setSearch]       = useState(activeFilters.search ?? '')
  const [downloading,  setDownloading]  = useState<'pdf' | 'excel' | null>(null)

  async function downloadPDF() {
    if (downloading) return
    setDownloading('pdf')
    try {
      const date = new Date().toISOString().slice(0, 10)
      await triggerDownload(buildExportUrl('/api/catalog/export-pdf', activeFilters), `catalogo-tq-${date}.pdf`)
    } catch { alert('No se pudo generar el PDF. Inténtalo de nuevo.') }
    finally  { setDownloading(null) }
  }

  async function downloadExcel() {
    if (downloading) return
    setDownloading('excel')
    try {
      const date = new Date().toISOString().slice(0, 10)
      await triggerDownload(buildExportUrl('/api/catalog/pedidos-excel', activeFilters), `plantilla-pedido-tq-${date}.xlsx`)
    } catch { alert('No se pudo generar la plantilla Excel. Inténtalo de nuevo.') }
    finally  { setDownloading(null) }
  }

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (search                                         ) params.set('search',   search)
    if (key !== 'metal'    && activeFilters.metal     ) params.set('metal',    activeFilters.metal)
    if (key !== 'familia'  && activeFilters.familia   ) params.set('familia',  activeFilters.familia)
    if (key !== 'category' && activeFilters.category  ) params.set('category', activeFilters.category)
    if (key !== 'estado'   && activeFilters.estado    ) params.set('estado',   activeFilters.estado)
    if (value) params.set(key, value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function applySearch(value: string) {
    const params = new URLSearchParams()
    if (value)                  params.set('search',   value)
    if (activeFilters.metal)    params.set('metal',    activeFilters.metal)
    if (activeFilters.familia)  params.set('familia',  activeFilters.familia)
    if (activeFilters.category) params.set('category', activeFilters.category)
    if (activeFilters.estado)   params.set('estado',   activeFilters.estado)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const hasFilters = activeFilters.search || activeFilters.metal || activeFilters.familia || activeFilters.category || activeFilters.estado

  return (
    <>
      {/* Search */}
      <div className="relative mt-6 mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#b2b2b2' }}>🔍</span>
        <input
          type="search"
          placeholder="Buscar por código o descripción…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applySearch(search)}
          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
          style={{ background: '#fff', boxShadow: '0 2px 6px rgba(0,32,60,0.08)', color: '#00557f' }}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); applySearch('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
            style={{ color: '#b2b2b2' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {/* Metal */}
        <select
          value={activeFilters.metal ?? ''}
          onChange={e => applyFilter('metal', e.target.value)}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: activeFilters.metal ? '#00557f' : '#fff',
            color:      activeFilters.metal ? '#fff' : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Metal</option>
          {filterOptions.metals.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Familia */}
        <select
          value={activeFilters.familia ?? ''}
          onChange={e => applyFilter('familia', e.target.value)}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: activeFilters.familia ? '#00557f' : '#fff',
            color:      activeFilters.familia ? '#fff' : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Familia</option>
          {filterOptions.familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Categoría */}
        <select
          value={activeFilters.category ?? ''}
          onChange={e => applyFilter('category', e.target.value)}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: activeFilters.category ? '#00557f' : '#fff',
            color:      activeFilters.category ? '#fff' : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Categoría</option>
          {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Estado */}
        {(['catalogo', 'descatalogado'] as const).map(val => {
          const active = activeFilters.estado === val
          const label  = val === 'catalogo' ? '✓ En catálogo' : '✕ Descatalogado'
          return (
            <button
              key={val}
              onClick={() => applyFilter('estado', active ? '' : val)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: active
                  ? val === 'descatalogado' ? 'rgba(80,80,80,0.75)' : '#00557f'
                  : '#fff',
                color:     active ? '#fff' : '#00557f',
                boxShadow: '0 1px 4px rgba(0,32,60,0.1)',
              }}
            >
              {label}
            </button>
          )
        })}

        {/* Limpiar */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); startTransition(() => router.push(pathname)) }}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Results count + export buttons */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs" style={{ color: '#b2b2b2' }}>
          {hasFilters
            ? `${products.length} modelo${products.length !== 1 ? 's' : ''} encontrado${products.length !== 1 ? 's' : ''}`
            : `${products.length} modelo${products.length !== 1 ? 's' : ''} en catálogo`}
        </p>

        {products.length > 0 && (
          <div className="flex gap-2">
            {/* PDF */}
            <button
              onClick={downloadPDF}
              disabled={!!downloading}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: downloading === 'pdf' ? 'rgba(0,85,127,0.04)' : 'rgba(0,85,127,0.10)',
                color:      downloading ? '#aaaaaa' : '#00557f',
                cursor:     downloading ? 'wait' : 'pointer',
                boxShadow:  '0 1px 4px rgba(0,32,60,0.08)',
              }}
            >
              {downloading === 'pdf' ? (
                <><span className="inline-block w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: '#aaa', borderTopColor: 'transparent' }} /> Generando…</>
              ) : '↓ Catálogo PDF'}
            </button>

            {/* Excel plantilla pedido */}
            <button
              onClick={downloadExcel}
              disabled={!!downloading}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: downloading === 'excel' ? 'rgba(58,158,106,0.04)' : 'rgba(58,158,106,0.10)',
                color:      downloading ? '#aaaaaa' : '#3A9E6A',
                cursor:     downloading ? 'wait' : 'pointer',
                boxShadow:  '0 1px 4px rgba(0,32,60,0.08)',
              }}
            >
              {downloading === 'excel' ? (
                <><span className="inline-block w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: '#aaa', borderTopColor: 'transparent' }} /> Generando…</>
              ) : '↓ Plantilla pedido Excel'}
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">◫</p>
          <p className="text-sm font-medium text-[#00557f]">Sin resultados</p>
          <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>Prueba con otros filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...products]
            .sort((a, b) => (b.stock_total > 0 ? 1 : 0) - (a.stock_total > 0 ? 1 : 0))
            .map(p => <ProductCard key={p.codigo_modelo} p={p} />)}
        </div>
      )}
    </>
  )
}
