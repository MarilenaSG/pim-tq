'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FilterSelect } from '@/components/ui'

interface Props {
  metals:      string[]
  categories:  string[]
  familias:    string[]
  karats:      string[]
  suppliers:   string[]
  proveedores: string[]
  campaigns:   { id: string; nombre: string }[]
}

export function ProductFilters({ metals, categories, familias, karats, suppliers, proveedores, campaigns }: Props) {
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
  const proveedor  = sp.get('proveedor')  ?? ''
  const estado     = sp.get('estado')     ?? ''
  const campaign   = sp.get('campaign')   ?? ''
  const completitud = sp.get('completitud') ?? ''
  const stockMin   = Number(sp.get('stock_min') ?? 0)

  const hasFilters = searchValue || metal || category || familia || karat || abc ||
                     supplier || proveedor || estado || campaign || completitud || stockMin > 0

  return (
    <div
      className="bg-white rounded-xl px-3 py-2.5"
      style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
    >
      {/* Fila principal: todos los filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Búsqueda */}
        <input
          type="search"
          placeholder="Buscar código o descripción…"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commitSearch(searchValue)}
          onBlur={() => commitSearch(searchValue)}
          className="h-8 flex-1 min-w-44 px-3 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#00557f]"
          style={{
            borderColor: searchValue ? '#00557f' : 'rgba(0,85,127,0.18)',
            color: '#00557f',
          }}
        />

        <FilterSelect value={supplier}   onChange={v => setParam('supplier', v)}    placeholder="Marca"       options={suppliers}   maxWidth={150} />
        <FilterSelect value={proveedor}  onChange={v => setParam('proveedor', v)}  placeholder="Proveedor"   options={proveedores} maxWidth={160} />
        <FilterSelect value={metal}      onChange={v => setParam('metal', v)}       placeholder="Metal"       options={metals}      />
        <FilterSelect value={familia}    onChange={v => setParam('familia', v)}     placeholder="Familia"     options={familias}    />
        <FilterSelect value={category}   onChange={v => setParam('category', v)}    placeholder="Categoría"   options={categories}  />
        <FilterSelect value={karat}      onChange={v => setParam('karat', v)}       placeholder="Quilates"    options={karats}      />

        {/* ABC */}
        <select
          value={abc}
          onChange={e => setParam('abc', e.target.value)}
          className="h-8 px-2.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#00557f] shrink-0 cursor-pointer"
          style={{
            borderColor: abc ? '#00557f' : 'rgba(0,85,127,0.18)',
            color:       abc ? '#00557f' : '#8fa8b8',
            background:  abc ? 'rgba(0,85,127,0.05)' : 'white',
            fontWeight:  abc ? 500 : 400,
          }}
        >
          <option value="">ABC</option>
          <option value="A">A — Alta rotación</option>
          <option value="B">B — Media rotación</option>
          <option value="C">C — Baja rotación</option>
        </select>

        {/* Estado */}
        <select
          value={estado}
          onChange={e => setParam('estado', e.target.value)}
          className="h-8 px-2.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#00557f] shrink-0 cursor-pointer"
          style={{
            borderColor: estado ? '#00557f' : 'rgba(0,85,127,0.18)',
            color:       estado ? '#00557f' : '#8fa8b8',
            background:  estado ? 'rgba(0,85,127,0.05)' : 'white',
            fontWeight:  estado ? 500 : 400,
          }}
        >
          <option value="">Estado</option>
          <option value="catalogo">En catálogo</option>
          <option value="descatalogado">Descatalogado</option>
        </select>

        {/* Completitud */}
        <select
          value={completitud}
          onChange={e => setParam('completitud', e.target.value)}
          className="h-8 px-2.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#00557f] shrink-0 cursor-pointer"
          style={{
            borderColor: completitud ? '#00557f' : 'rgba(0,85,127,0.18)',
            color:       completitud ? '#00557f' : '#8fa8b8',
            background:  completitud ? 'rgba(0,85,127,0.05)' : 'white',
            fontWeight:  completitud ? 500 : 400,
          }}
        >
          <option value="">Completitud</option>
          <option value="alta">Alta (≥ 80%)</option>
          <option value="media">Media (40–79%)</option>
          <option value="baja">Baja (&lt; 40%)</option>
        </select>

        {/* Campaña */}
        {campaigns.length > 0 && (
          <select
            value={campaign}
            onChange={e => setParam('campaign', e.target.value)}
            className="h-8 px-2.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#00557f] shrink-0 cursor-pointer"
            style={{
              borderColor: campaign ? '#00557f' : 'rgba(0,85,127,0.18)',
              color:       campaign ? '#00557f' : '#8fa8b8',
              background:  campaign ? 'rgba(0,85,127,0.05)' : 'white',
              fontWeight:  campaign ? 500 : 400,
              maxWidth: 160,
            }}
          >
            <option value="">Campaña</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={clearAll}
            className="h-8 px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}
          >
            ✕ Limpiar
          </button>
        )}

        {/* Stock slider — al final, solo si tiene valor o siempre visible */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#8fa8b8' }}>
            Stock mín
          </span>
          <input
            type="range"
            min={0} max={300} step={5}
            value={stockValue}
            onChange={e => setStockValue(Number(e.target.value))}
            onPointerUp={() => commitStock(stockValue)}
            onKeyUp={() => commitStock(stockValue)}
            className="w-24 cursor-pointer"
            style={{ accentColor: '#00557f' }}
          />
          <span
            className="text-xs font-semibold min-w-[3rem] text-center px-1.5 py-0.5 rounded"
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
