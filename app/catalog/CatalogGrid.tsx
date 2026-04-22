'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface Variant {
  variante:     string | null
  precio_venta: number | null
  stock:        number | null
}

interface CatalogProduct {
  codigo_modelo: string
  description:   string | null
  category:      string | null
  familia:       string | null
  metal:         string | null
  karat:         string | null
  num_variantes: number | null
  image_url:     string | null
  precio_venta:  number | null
  slug_lider:    string | null
  marca:         string | null
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
}

interface Props {
  products:      CatalogProduct[]
  filterOptions: FilterOptions
  activeFilters: ActiveFilters
}

function ProductCard({ p }: { p: CatalogProduct }) {
  const [expanded, setExpanded] = useState(false)
  const totalStock = p.stock_total
  const hasStock   = totalStock > 0

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        boxShadow: '0 2px 8px rgba(0,32,60,0.08)',
        opacity: p.is_discontinued && !hasStock ? 0.6 : 1,
      }}
    >
      {/* Image */}
      <div className="relative aspect-square bg-[#f5f3f0]">
        {p.is_discontinued && (
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
            style={{ filter: p.is_discontinued ? 'grayscale(30%)' : 'none' }}
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
          {hasStock ? `${totalStock} uds` : 'Sin stock'}
        </span>
      </div>

      {/* Info */}
      <div className="px-3 pt-3 pb-2">
        {/* Marca + familia */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
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
        <p className="text-sm font-medium leading-snug text-tq-snorkel line-clamp-2 mb-1.5">
          {p.description ?? p.codigo_modelo}
        </p>

        {/* Metal + karat + code */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {p.metal && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(0,85,127,0.07)', color: '#00557f' }}
            >
              {p.metal}
            </span>
          )}
          {p.karat && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(200,161,100,0.15)', color: '#8a6830' }}
            >
              {p.karat}
            </span>
          )}
          <span className="text-[10px] font-mono ml-auto" style={{ color: '#b2b2b2' }}>
            {p.slug_lider ?? p.codigo_modelo}
          </span>
        </div>

        {/* Price */}
        {p.precio_venta != null && (
          <p className="text-base font-bold text-tq-snorkel mb-2">
            {p.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        )}

        {/* Variants toggle */}
        {p.variants.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full text-xs font-semibold py-1.5 rounded-lg transition-colors"
            style={{
              background: expanded ? 'rgba(0,85,127,0.08)' : 'rgba(0,85,127,0.04)',
              color: '#00557f',
            }}
          >
            {expanded ? '▲ Ocultar tallas' : `▼ Ver ${p.variants.length} talla${p.variants.length !== 1 ? 's' : ''}`}
          </button>
        )}

        {/* Variants list */}
        {expanded && (
          <div className="mt-2 space-y-1">
            {p.variants.map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs px-2 py-1 rounded-lg"
                style={{ background: 'rgba(0,85,127,0.03)' }}
              >
                <span className="font-medium text-tq-snorkel">Talla {v.variante ?? '—'}</span>
                <div className="flex items-center gap-3">
                  {v.precio_venta != null && (
                    <span className="font-bold" style={{ color: '#00557f' }}>
                      {v.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </span>
                  )}
                  <span
                    className="font-medium"
                    style={{ color: (v.stock ?? 0) > 0 ? '#3A9E6A' : '#C0392B' }}
                  >
                    {v.stock ?? 0} uds
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

export function CatalogGrid({ products, filterOptions, activeFilters }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(activeFilters.search ?? '')

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (search)                       params.set('search',   search)
    if (key !== 'metal'    && activeFilters.metal)    params.set('metal',    activeFilters.metal)
    if (key !== 'familia'  && activeFilters.familia)  params.set('familia',  activeFilters.familia)
    if (key !== 'category' && activeFilters.category) params.set('category', activeFilters.category)
    if (value) params.set(key, value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function applySearch(value: string) {
    const params = new URLSearchParams()
    if (value)                        params.set('search',   value)
    if (activeFilters.metal)          params.set('metal',    activeFilters.metal)
    if (activeFilters.familia)        params.set('familia',  activeFilters.familia)
    if (activeFilters.category)       params.set('category', activeFilters.category)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const hasFilters = activeFilters.search || activeFilters.metal || activeFilters.familia || activeFilters.category

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#b2b2b2' }}>🔍</span>
        <input
          type="search"
          placeholder="Buscar por código o descripción…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applySearch(search)}
          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
          style={{
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,32,60,0.08)',
            color: '#00557f',
          }}
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
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
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

        {/* Category */}
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

        {/* Clear */}
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

      {/* Results count */}
      {hasFilters && (
        <p className="text-xs mb-4" style={{ color: '#b2b2b2' }}>
          {products.length} modelo{products.length !== 1 ? 's' : ''} encontrado{products.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">◫</p>
          <p className="text-sm font-medium text-tq-snorkel">Sin resultados</p>
          <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>Prueba con otros filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {products.map(p => <ProductCard key={p.codigo_modelo} p={p} />)}
        </div>
      )}
    </>
  )
}
