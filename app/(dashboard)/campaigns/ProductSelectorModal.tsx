'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type ProductResult = {
  codigo_modelo: string
  description: string | null
  familia: string | null
  supplier_name: string | null
  abc_ventas: string | null
  is_discontinued: boolean
}

interface Props {
  alreadyAdded: Set<string>
  onAdd: (codigos: string[]) => Promise<void>
  onClose: () => void
}

function AbcDot({ abc }: { abc: string | null }) {
  if (!abc) return null
  const color = abc === 'A' ? '#3A9E6A' : abc === 'B' ? '#0099f2' : '#C8842A'
  return <span className="text-[10px] font-bold" style={{ color }}>{abc}</span>
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
        borderColor: 'rgba(0,85,127,0.2)',
        color: value ? '#00557f' : '#b2b2b2',
        minWidth: 120,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function ProductSelectorModal({ alreadyAdded, onAdd, onClose }: Props) {
  const [search, setSearch]     = useState('')
  const [familia, setFamilia]   = useState('')
  const [abc, setAbc]           = useState('')
  const [supplier, setSupplier] = useState('')

  const [products, setProducts] = useState<ProductResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding]     = useState(false)

  const [familias, setFamilias]   = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [optionsLoaded, setOptionsLoaded] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Load filter options once on mount
  useEffect(() => {
    fetch('/api/products/filter-options')
      .then(r => r.json())
      .then(d => {
        setFamilias(d.familias ?? [])
        setSuppliers(d.suppliers ?? [])
        setOptionsLoaded(true)
      })
  }, [])

  const doSearch = useCallback(async (q: string, f: string, a: string, s: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (f) params.set('familia', f)
    if (a) params.set('abc', a)
    if (s) params.set('supplier', s)
    const res = await fetch(`/api/products/search?${params}`)
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  // Debounced re-search whenever filters change
  useEffect(() => {
    if (!optionsLoaded) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(search, familia, abc, supplier), 280)
    return () => clearTimeout(debounceRef.current)
  }, [search, familia, abc, supplier, optionsLoaded, doSearch])

  // Initial load when options are ready
  useEffect(() => {
    if (optionsLoaded) doSearch('', '', '', '')
  }, [optionsLoaded, doSearch])

  const available = products.filter(p => !alreadyAdded.has(p.codigo_modelo))
  const allSelected = available.length > 0 && available.every(p => selected.has(p.codigo_modelo))
  const hasFilters = search || familia || abc || supplier

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        available.forEach(p => next.delete(p.codigo_modelo))
      } else {
        available.forEach(p => next.add(p.codigo_modelo))
      }
      return next
    })
  }

  function toggle(codigo: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  function clearFilters() {
    setSearch(''); setFamilia(''); setAbc(''); setSupplier('')
  }

  async function handleAdd() {
    if (selected.size === 0 || adding) return
    setAdding(true)
    await onAdd(Array.from(selected))
    setAdding(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl flex flex-col w-full max-w-2xl"
        style={{
          boxShadow: '0 20px 60px rgba(0,32,60,0.22)',
          maxHeight: 'min(85vh, 700px)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0 border-b"
          style={{ borderColor: 'rgba(0,85,127,0.1)' }}
        >
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
              Selector de productos
            </p>
            <h3 className="text-base font-bold text-tq-snorkel">Añadir productos a campaña</h3>
          </div>
          <button onClick={onClose} className="text-lg opacity-40 hover:opacity-70 transition-opacity">✕</button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 shrink-0 space-y-2 border-b" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
          <input
            type="search"
            autoFocus
            placeholder="Buscar por descripción, slug, código interno…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
            style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <FilterSelect value={familia}  onChange={setFamilia}  placeholder="Familia: todas"   options={familias} />
            <FilterSelect value={abc}      onChange={setAbc}      placeholder="ABC: todos"        options={['A', 'B', 'C']} />
            <FilterSelect value={supplier} onChange={setSupplier} placeholder="Marca: todas"      options={suppliers} />
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs px-3 py-2 rounded-lg transition-colors"
                style={{ color: '#b2b2b2', background: 'rgba(0,85,127,0.04)' }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Results table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-sm" style={{ color: '#b2b2b2' }}>Buscando…</div>
          ) : products.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: '#b2b2b2' }}>
              {hasFilters ? 'Sin resultados con estos filtros.' : 'No hay productos.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="sticky top-0 bg-white"
                  style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}
                >
                  <th className="px-4 py-2.5 w-9">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      title="Seleccionar todos los disponibles"
                      className="rounded cursor-pointer"
                    />
                  </th>
                  {['Código', 'Descripción', 'Familia', 'Marca', 'ABC'].map(h => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: '#b2b2b2' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const inCampaign = alreadyAdded.has(p.codigo_modelo)
                  const isSelected = selected.has(p.codigo_modelo)
                  return (
                    <tr
                      key={p.codigo_modelo}
                      onClick={() => !inCampaign && toggle(p.codigo_modelo)}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(0,85,127,0.04)',
                        background: isSelected ? 'rgba(0,153,242,0.04)' : undefined,
                        opacity: inCampaign ? 0.45 : 1,
                        cursor: inCampaign ? 'default' : 'pointer',
                      }}
                    >
                      <td className="px-4 py-2 text-center">
                        {inCampaign ? (
                          <span className="text-xs font-bold" style={{ color: '#3A9E6A' }}>✓</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(p.codigo_modelo)}
                            onClick={e => e.stopPropagation()}
                            className="rounded cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-bold" style={{ color: '#0099f2' }}>
                          {p.codigo_modelo}
                        </span>
                        {p.is_discontinued && (
                          <span className="ml-1 text-[9px] px-1 rounded" style={{ background: 'rgba(192,57,43,0.1)', color: '#992d22' }}>
                            desc.
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs max-w-[200px]" style={{ color: '#00557f' }}>
                        <span className="line-clamp-1">{p.description ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#b2b2b2' }}>
                        {p.familia ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#b2b2b2' }}>
                        {p.supplier_name ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <AbcDot abc={p.abc_ventas} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 shrink-0 flex items-center justify-between border-t"
          style={{ borderColor: 'rgba(0,85,127,0.1)' }}
        >
          <p className="text-xs" style={{ color: '#b2b2b2' }}>
            {selected.size > 0
              ? `${selected.size} producto${selected.size !== 1 ? 's' : ''} seleccionado${selected.size !== 1 ? 's' : ''}`
              : `${products.length} resultado${products.length !== 1 ? 's' : ''}`}
            {alreadyAdded.size > 0 && (
              <span> · {alreadyAdded.size} ya en campaña</span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || adding}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: '#00557f' }}
            >
              {adding
                ? 'Añadiendo…'
                : selected.size > 0
                  ? `Añadir ${selected.size} producto${selected.size !== 1 ? 's' : ''}`
                  : 'Añadir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
