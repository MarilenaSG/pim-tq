'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  metals:     string[]
  categories: string[]
  familias:   string[]
  karats:     string[]
  suppliers:  string[]
  vendors:    string[]
  campaigns:  { id: string; nombre: string }[]
}

export function ProductFilters({ metals, categories, familias, karats, suppliers, vendors, campaigns }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const [searchValue, setSearchValue] = useState(sp.get('search') ?? '')
  const [stockValue,  setStockValue]  = useState(Number(sp.get('stock_min') ?? 0))

  useEffect(() => { setSearchValue(sp.get('search') ?? '') }, [sp])
  useEffect(() => { setStockValue(Number(sp.get('stock_min') ?? 0)) }, [sp])

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value); else p.delete(key)
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  function commitSearch(value: string) { setParam('search', value.trim()) }

  function commitStock(value: number) {
    const p = new URLSearchParams(sp.toString())
    if (value > 0) p.set('stock_min', String(value)); else p.delete('stock_min')
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  function clearAll() {
    setSearchValue('')
    setStockValue(0)
    router.replace(pathname, { scroll: false })
  }

  const metal      = sp.get('metal')      ?? ''
  const category   = sp.get('category')   ?? ''
  const familia    = sp.get('familia')    ?? ''
  const karat      = sp.get('karat')      ?? ''
  const abc        = sp.get('abc')        ?? ''
  const supplier   = sp.get('supplier')   ?? ''
  const estado     = sp.get('estado')     ?? ''
  const vendor     = sp.get('vendor')     ?? ''
  const campaign   = sp.get('campaign')   ?? ''
  const stockMin   = Number(sp.get('stock_min') ?? 0)

  const hasFilters = searchValue || metal || category || familia || karat || abc || supplier ||
                     estado || vendor || campaign || stockMin > 0 || sp.get('completitud')

  return (
    <div
      className="bg-white rounded-xl px-4 py-3 space-y-3"
      style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
    >
      {/* Row 1: search + dropdowns */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <input
          type="search"
          placeholder="Buscar código o descripción…"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commitSearch(searchValue)}
          onBlur={() => commitSearch(searchValue)}
          className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1"
          style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
        />

        <FilterSelect value={metal}    onChange={v => setParam('metal', v)}    placeholder="Metal"      options={metals}     />
        <FilterSelect value={category} onChange={v => setParam('category', v)} placeholder="Categoría"  options={categories} />
        <FilterSelect value={familia}  onChange={v => setParam('familia', v)}  placeholder="Familia"    options={familias}   />
        <FilterSelect value={karat}    onChange={v => setParam('karat', v)}    placeholder="Quilates"   options={karats}     />

        {/* ABC */}
        <select
          value={abc}
          onChange={e => setParam('abc', e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
          style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
        >
          <option value="">ABC: todos</option>
          <option value="A">A — Alta rotación</option>
          <option value="B">B — Media rotación</option>
          <option value="C">C — Baja rotación</option>
        </select>

        {/* Completitud */}
        <select
          value={sp.get('completitud') ?? ''}
          onChange={e => setParam('completitud', e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
          style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
        >
          <option value="">Completitud: todas</option>
          <option value="alta">Alta (≥ 80%)</option>
          <option value="media">Media (40–79%)</option>
          <option value="baja">Baja (&lt; 40%)</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Row 2: new filters */}
      <div className="flex flex-wrap gap-2 items-center pt-1 border-t" style={{ borderColor: 'rgba(0,85,127,0.06)' }}>
        {/* Estado */}
        <select
          value={estado}
          onChange={e => setParam('estado', e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
          style={{
            borderColor: estado ? '#00557f' : 'rgba(0,85,127,0.2)',
            color: '#00557f',
            fontWeight: estado ? 600 : undefined,
          }}
        >
          <option value="">Estado: todos</option>
          <option value="catalogo">En catálogo</option>
          <option value="descatalogado">Descatalogado</option>
        </select>

        {/* Proveedor */}
        <FilterSelect value={supplier} onChange={v => setParam('supplier', v)} placeholder="Proveedor" options={suppliers} />

        {/* Marca (Shopify vendor) */}
        {vendors.length > 0 && (
          <FilterSelect value={vendor} onChange={v => setParam('vendor', v)} placeholder="Marca" options={vendors} />
        )}

        {/* Campaña */}
        {campaigns.length > 0 && (
          <select
            value={campaign}
            onChange={e => setParam('campaign', e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
            style={{
              borderColor: campaign ? '#00557f' : 'rgba(0,85,127,0.2)',
              color: '#00557f',
              fontWeight: campaign ? 600 : undefined,
            }}
          >
            <option value="">Campaña: todas</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        )}

        {/* Stock slider */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: '#00557f' }}>
            Stock mín:
          </span>
          <input
            type="range"
            min={0}
            max={300}
            step={5}
            value={stockValue}
            onChange={e => setStockValue(Number(e.target.value))}
            onPointerUp={() => commitStock(stockValue)}
            onKeyUp={() => commitStock(stockValue)}
            className="w-32 accent-tq-snorkel cursor-pointer"
            style={{ accentColor: '#00557f' }}
          />
          <span
            className="text-xs font-bold min-w-[3rem] text-center px-2 py-0.5 rounded"
            style={{
              background: stockValue > 0 ? 'rgba(0,85,127,0.08)' : 'transparent',
              color: '#00557f',
            }}
          >
            {stockValue > 0 ? `≥ ${stockValue}` : 'todos'}
          </span>
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
      style={{
        borderColor: value ? '#00557f' : 'rgba(0,85,127,0.2)',
        color: '#00557f',
        fontWeight: value ? 600 : undefined,
      }}
    >
      <option value="">{placeholder}: todos</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
