'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Variant = {
  variante: string | null
  precio_venta: number | null
  precio_tachado: number | null
  descuento_aplicado: number | null
  stock_variante: number | null
  es_variante_lider: boolean
}

type Image = {
  url: string
  is_primary: boolean
  orden: number
}

type Product = {
  codigo_modelo: string
  description: string | null
  familia: string | null
  metal: string | null
  karat: string | null
  supplier_name: string | null
  num_variantes: number | null
  lista_variantes: string | null
  primera_entrada: string | null
  product_variants: Variant[]
  product_images: Image[]
}

// ── Product card ──────────────────────────────────────────────
function CatalogoCard({ p }: { p: Product }) {
  const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
  const img    = p.product_images.find(i => i.is_primary) ?? p.product_images[0]
  const stockTotal = p.product_variants.reduce((s, v) => s + (v.stock_variante ?? 0), 0)

  const tallas = [...(p.product_variants ?? [])]
    .map(v => v.variante)
    .filter(Boolean)
    .sort((a, b) => {
      const na = parseFloat(a!), nb = parseFloat(b!)
      return !isNaN(na) && !isNaN(nb) ? na - nb : (a ?? '').localeCompare(b ?? '', 'es')
    })

  const [imgError, setImgError] = useState(false)

  return (
    <div className="tq-card overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-square bg-[#f4f1ee] flex items-center justify-center overflow-hidden">
        {img && !imgError ? (
          <img
            src={img.url}
            alt={p.description ?? ''}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-4xl text-[#c6c6c6]">◻</span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-[#b2b2b2] font-mono">{p.codigo_modelo}</p>
        <p className="text-sm font-semibold text-[#1d1d1b] leading-tight mt-0.5 line-clamp-2">
          {p.description ?? '—'}
        </p>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {p.metal && (
            <span className="text-xs rounded-full px-2 py-0.5 font-medium"
              style={{ background: '#e8f4fb', color: '#00557f' }}>{p.metal}</span>
          )}
          {p.karat && (
            <span className="text-xs rounded-full px-2 py-0.5 font-medium"
              style={{ background: '#fdf3e4', color: '#C8842A' }}>{p.karat}</span>
          )}
          {p.familia && (
            <span className="text-xs rounded-full px-2 py-0.5 font-medium"
              style={{ background: '#f4f1ee', color: '#666' }}>{p.familia}</span>
          )}
        </div>

        {/* Price — shown without margins/costs */}
        {leader && (
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-base font-bold text-[#00557f]">
              {leader.precio_venta != null
                ? leader.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                : '—'}
            </span>
            {leader.precio_tachado && leader.precio_tachado > (leader.precio_venta ?? 0) && (
              <>
                <span className="text-xs line-through text-[#b2b2b2]">
                  {leader.precio_tachado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </span>
                {leader.descuento_aplicado && leader.descuento_aplicado > 0 && (
                  <span className="text-xs font-semibold text-[#C8842A]">
                    -{Math.round(leader.descuento_aplicado)}%
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Sizes */}
        {tallas.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-[#b2b2b2] mb-1">
              {p.num_variantes === 1 ? 'Talla única' : `Tallas (${tallas.length})`}
            </p>
            <div className="flex flex-wrap gap-1">
              {tallas.slice(0, 8).map(t => (
                <span key={t}
                  className="text-xs border rounded px-1.5 py-0.5"
                  style={{ borderColor: '#e8e3df', color: '#555' }}
                >
                  {t}
                </span>
              ))}
              {tallas.length > 8 && (
                <span className="text-xs text-[#b2b2b2]">+{tallas.length - 8}</span>
              )}
            </div>
          </div>
        )}

        {/* Stock indicator */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: stockTotal > 5 ? '#3A9E6A' : stockTotal > 0 ? '#C8842A' : '#C0392B' }} />
          <span className="text-xs text-[#b2b2b2]">
            {stockTotal > 0 ? `${stockTotal} uds. disponibles` : 'Sin stock'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main client ───────────────────────────────────────────────
export default function TiendasCatalogoClient({
  products,
  familias,
  metales,
  initialSearch,
  initialFamilia,
  initialMetal,
}: {
  products: Product[]
  familias: string[]
  metales: string[]
  initialSearch: string
  initialFamilia: string
  initialMetal: string
}) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [search,  setSearch]  = useState(initialSearch)
  const [familia, setFamilia] = useState(initialFamilia)
  const [metal,   setMetal]   = useState(initialMetal)
  const [view,    setView]    = useState<'grid' | 'list'>('grid')

  function applyFilters(s: string, f: string, m: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (s) p.set('q', s); else p.delete('q')
    if (f && f !== 'all') p.set('familia', f); else p.delete('familia')
    if (m && m !== 'all') p.set('metal', m); else p.delete('metal')
    router.push(`?${p.toString()}`)
  }

  function handleSearch(val: string) {
    setSearch(val)
    if (val.length === 0 || val.length >= 2) applyFilters(val, familia, metal)
  }

  function handleFamilia(val: string) {
    setFamilia(val)
    applyFilters(search, val, metal)
  }

  function handleMetal(val: string) {
    setMetal(val)
    applyFilters(search, familia, val)
  }

  const totalStock = useMemo(
    () => products.reduce((s, p) => s + p.product_variants.reduce((vs, v) => vs + (v.stock_variante ?? 0), 0), 0),
    [products]
  )

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mt-6 mb-4">
        <input
          type="text"
          placeholder="Buscar por descripción o código…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="flex-1 min-w-52 border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white"
        />
        <select
          value={familia}
          onChange={e => handleFamilia(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={metal}
          onChange={e => handleMetal(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">Todos los metales</option>
          {metales.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <div className="flex border border-[#e8e3df] rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => setView('grid')}
            className="px-3 py-2 text-sm transition-colors"
            style={{ background: view === 'grid' ? '#e8f4fb' : 'transparent', color: view === 'grid' ? '#00557f' : '#b2b2b2' }}
          >▦</button>
          <button
            onClick={() => setView('list')}
            className="px-3 py-2 text-sm transition-colors"
            style={{ background: view === 'list' ? '#e8f4fb' : 'transparent', color: view === 'list' ? '#00557f' : '#b2b2b2' }}
          >☰</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 mb-4 text-sm text-[#b2b2b2]">
        <span><b className="text-[#1d1d1b]">{products.length}</b> referencias</span>
        <span><b className="text-[#1d1d1b]">{totalStock.toLocaleString('es-ES')}</b> unidades en stock</span>
      </div>

      {/* Grid / List */}
      {products.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(139,94,26,0.04)', border: '1px solid rgba(139,94,26,0.12)' }}>
          <p className="text-3xl mb-2">◻</p>
          <p className="text-sm font-semibold text-[#8B5E1A]">Sin resultados</p>
          <p className="text-xs text-[#b2b2b2] mt-1">Prueba a cambiar los filtros</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map(p => <CatalogoCard key={p.codigo_modelo} p={p} />)}
        </div>
      ) : (
        <div className="tq-card divide-y divide-[#f4f1ee]">
          {products.map(p => {
            const leader = p.product_variants.find(v => v.es_variante_lider) ?? p.product_variants[0]
            const img    = p.product_images.find(i => i.is_primary) ?? p.product_images[0]
            const stock  = p.product_variants.reduce((s, v) => s + (v.stock_variante ?? 0), 0)
            return (
              <div key={p.codigo_modelo} className="flex items-center gap-4 px-4 py-3">
                {img ? (
                  <img src={img.url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#f4f1ee] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#c6c6c6]">◻</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1d1d1b] truncate">{p.description ?? '—'}</p>
                  <p className="text-xs text-[#b2b2b2]">{p.codigo_modelo} · {p.metal ?? '—'} {p.karat ?? ''} · {p.familia ?? '—'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#00557f]">
                    {leader?.precio_venta != null
                      ? leader.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                      : '—'}
                  </p>
                  <p className="text-xs text-[#b2b2b2]">{stock} uds.</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
