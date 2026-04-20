'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  metals:     string[]
  categories: string[]
  familias:   string[]
  karats:     string[]
}

export function ProductFilters({ metals, categories, familias, karats }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const currentSearch = sp.get('search') ?? ''
  const [searchValue, setSearchValue] = useState(currentSearch)

  // Sync search input when URL changes (e.g., "clear all")
  useEffect(() => { setSearchValue(sp.get('search') ?? '') }, [sp])

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) { p.set(key, value) } else { p.delete(key) }
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  function commitSearch(value: string) {
    setParam('search', value.trim())
  }

  function clearAll() {
    setSearchValue('')
    router.replace(pathname, { scroll: false })
  }

  const metal    = sp.get('metal')    ?? ''
  const category = sp.get('category') ?? ''
  const familia  = sp.get('familia')  ?? ''
  const karat    = sp.get('karat')    ?? ''
  const abc      = sp.get('abc')      ?? ''

  const hasFilters = searchValue || metal || category || familia || karat || abc

  return (
    <div
      className="bg-white rounded-xl px-4 py-3 flex flex-wrap gap-3 items-center"
      style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
    >
      {/* Search */}
      <input
        type="search"
        placeholder="Buscar código o descripción…"
        value={searchValue}
        onChange={e => setSearchValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && commitSearch(searchValue)}
        onBlur={() => commitSearch(searchValue)}
        className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm border focus:outline-none"
        style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
      />

      {/* Dropdowns */}
      <FilterSelect value={metal}    onChange={v => setParam('metal', v)}    placeholder="Metal: todos"      options={metals}     />
      <FilterSelect value={category} onChange={v => setParam('category', v)} placeholder="Categoría: todas"  options={categories} />
      <FilterSelect value={familia}  onChange={v => setParam('familia', v)}  placeholder="Familia: todas"    options={familias}   />
      <FilterSelect value={karat}    onChange={v => setParam('karat', v)}    placeholder="Quilates: todos"   options={karats}     />

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

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}
        >
          ✕ Limpiar filtros
        </button>
      )}
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
      style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
