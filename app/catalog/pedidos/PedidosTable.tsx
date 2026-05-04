'use client'

import { useState, useMemo } from 'react'
import type { PedidoRow } from './page'

interface Props {
  rows: PedidoRow[]
}

type SortKey = 'metal' | 'familia' | 'description' | 'precio_venta' | 'stock_total'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 opacity-60 text-[10px]">
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

export function PedidosTable({ rows }: Props) {
  const [search,         setSearch]         = useState('')
  const [filtroMetal,    setFiltroMetal]    = useState('')
  const [filtroFamilia,  setFiltroFamilia]  = useState('')
  const [filtroCategory, setFiltroCategory] = useState('')
  const [sortKey,        setSortKey]        = useState<SortKey>('metal')
  const [sortDir,        setSortDir]        = useState<SortDir>('asc')
  const [descargando,    setDescargando]    = useState(false)

  const metals     = useMemo(() => Array.from(new Set(rows.map(r => r.metal).filter(Boolean))).sort() as string[], [rows])
  const familias   = useMemo(() => Array.from(new Set(rows.map(r => r.familia).filter(Boolean))).sort() as string[], [rows])
  const categories = useMemo(() => Array.from(new Set(rows.map(r => r.category).filter(Boolean))).sort() as string[], [rows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      if (q && !r.description?.toLowerCase().includes(q) && !r.codigo_modelo.toLowerCase().includes(q)) return false
      if (filtroMetal    && r.metal    !== filtroMetal)    return false
      if (filtroFamilia  && r.familia  !== filtroFamilia)  return false
      if (filtroCategory && r.category !== filtroCategory) return false
      return true
    })
  }, [rows, search, filtroMetal, filtroFamilia, filtroCategory])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'precio_venta') {
        cmp = (a.precio_venta ?? 0) - (b.precio_venta ?? 0)
      } else if (sortKey === 'stock_total') {
        cmp = a.stock_total - b.stock_total
      } else {
        cmp = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'es')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const hasFilters = search || filtroMetal || filtroFamilia || filtroCategory

  function limpiarFiltros() {
    setSearch('')
    setFiltroMetal('')
    setFiltroFamilia('')
    setFiltroCategory('')
  }

  async function handleDescargarExcel() {
    setDescargando(true)
    try {
      const params = new URLSearchParams()
      if (filtroMetal)    params.set('metal',    filtroMetal)
      if (filtroFamilia)  params.set('familia',  filtroFamilia)
      if (filtroCategory) params.set('category', filtroCategory)
      const res   = await fetch(`/api/catalog/pedidos-excel?${params}`)
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement('a')
      a.href      = url
      a.download  = `Plantilla-Pedidos-TQ-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDescargando(false)
    }
  }

  const thStyle = (key: SortKey) => ({
    cursor: 'pointer' as const,
    userSelect: 'none' as const,
    background: sortKey === key ? 'rgba(255,255,255,0.12)' : undefined,
    whiteSpace: 'nowrap' as const,
  })

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#b2b2b2' }}>🔍</span>
          <input
            type="search"
            placeholder="Buscar código o descripción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border-0 focus:outline-none focus:ring-2"
            style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,32,60,0.08)', color: '#00557f' }}
          />
        </div>

        {[
          { label: 'Metal',     value: filtroMetal,    set: setFiltroMetal,    opts: metals     },
          { label: 'Familia',   value: filtroFamilia,  set: setFiltroFamilia,  opts: familias   },
          { label: 'Categoría', value: filtroCategory, set: setFiltroCategory, opts: categories },
        ].map(f => (
          <select
            key={f.label}
            value={f.value}
            onChange={e => f.set(e.target.value)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
            style={{
              background: f.value ? '#00557f' : '#fff',
              color:      f.value ? '#fff'    : '#00557f',
              boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
            }}
          >
            <option value="">{f.label}</option>
            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}

        {hasFilters && (
          <button
            onClick={limpiarFiltros}
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}
          >
            ✕ Limpiar
          </button>
        )}

        <div className="flex-1" />

        <span className="text-xs shrink-0" style={{ color: '#b2b2b2' }}>
          {sorted.length} modelo{sorted.length !== 1 ? 's' : ''}
        </span>

        <button
          onClick={handleDescargarExcel}
          disabled={descargando}
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-opacity"
          style={{ background: '#C8842A', color: '#fff', opacity: descargando ? 0.6 : 1 }}
        >
          {descargando ? '…' : '↓ Descargar Excel por talla'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ boxShadow: '0 2px 8px rgba(0,32,60,0.08)' }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: '#00557f', color: '#fff' }} className="sticky top-0 z-10">
              <th className="px-3 py-3 text-left text-xs font-semibold w-20">Img</th>
              <th className="px-3 py-3 text-left text-xs font-semibold">Categoría</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={thStyle('metal')} onClick={() => toggleSort('metal')}>
                Metal <SortIcon active={sortKey === 'metal'} dir={sortDir} />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={thStyle('familia')} onClick={() => toggleSort('familia')}>
                Familia <SortIcon active={sortKey === 'familia'} dir={sortDir} />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold">Código</th>
              <th className="px-3 py-3 text-left text-xs font-semibold min-w-52" style={thStyle('description')} onClick={() => toggleSort('description')}>
                Descripción <SortIcon active={sortKey === 'description'} dir={sortDir} />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold min-w-48">Tallas activas</th>
              <th className="px-3 py-3 text-right text-xs font-semibold" style={thStyle('precio_venta')} onClick={() => toggleSort('precio_venta')}>
                Precio <SortIcon active={sortKey === 'precio_venta'} dir={sortDir} />
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold" style={thStyle('stock_total')} onClick={() => toggleSort('stock_total')}>
                Stock <SortIcon active={sortKey === 'stock_total'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-sm" style={{ color: '#b2b2b2', background: '#fff' }}>
                  Sin resultados para estos filtros
                </td>
              </tr>
            ) : (
              sorted.map(r => (
                <tr
                  key={r.codigo_modelo}
                  className="border-b hover:bg-[#f8f7f5] transition-colors"
                  style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.05)' }}
                >
                  {/* Imagen */}
                  <td className="px-3 py-2.5">
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt={r.description ?? r.codigo_modelo}
                        className="rounded-lg object-cover shrink-0"
                        style={{ width: 64, height: 64 }}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-lg text-2xl shrink-0"
                        style={{ width: 64, height: 64, background: '#f5f3f0', color: '#d0cdc9' }}
                      >
                        ◫
                      </div>
                    )}
                  </td>

                  {/* Categoría */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#00557f' }}>
                    {r.category ?? '—'}
                  </td>

                  {/* Metal */}
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#444' }}>
                    {r.metal ?? '—'}{r.karat ? ` ${r.karat}` : ''}
                  </td>

                  {/* Familia */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#444' }}>
                    {r.familia ?? '—'}
                  </td>

                  {/* Código */}
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs" style={{ color: '#888' }}>
                      {r.codigo_modelo}
                    </span>
                  </td>

                  {/* Descripción */}
                  <td className="px-3 py-2.5 max-w-xs">
                    <span className="line-clamp-2 text-xs leading-snug" style={{ color: '#00557f' }}>
                      {r.description ?? '—'}
                    </span>
                  </td>

                  {/* Tallas activas */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.variantes.map(v => (
                        <span
                          key={v}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Precio */}
                  <td className="px-3 py-2.5 text-xs text-right font-semibold whitespace-nowrap" style={{ color: '#00557f' }}>
                    {r.precio_venta != null
                      ? r.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                      : '—'}
                  </td>

                  {/* Stock */}
                  <td className="px-3 py-2.5 text-xs text-right whitespace-nowrap">
                    <span style={{ color: r.stock_total > 0 ? '#3A9E6A' : '#b2b2b2', fontWeight: 600 }}>
                      {r.stock_total} uds
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
