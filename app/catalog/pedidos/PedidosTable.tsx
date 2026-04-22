'use client'

import { useState } from 'react'
import type { PedidoRow } from './page'

interface Props {
  rows: PedidoRow[]
}

export function PedidosTable({ rows }: Props) {
  const [search,          setSearch]          = useState('')
  const [filtroMetal,     setFiltroMetal]     = useState('')
  const [filtroFamilia,   setFiltroFamilia]   = useState('')
  const [filtroCategory,  setFiltroCategory]  = useState('')
  const [filtroEstado,    setFiltroEstado]    = useState('')
  const [descargando,     setDescargando]     = useState(false)

  const metals     = Array.from(new Set(rows.map(r => r.metal).filter(Boolean))).sort() as string[]
  const familias   = Array.from(new Set(rows.map(r => r.familia).filter(Boolean))).sort() as string[]
  const categories = Array.from(new Set(rows.map(r => r.category).filter(Boolean))).sort() as string[]

  const filtered = rows.filter(r => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.description?.toLowerCase().includes(q) && !r.codigo_modelo.toLowerCase().includes(q)) return false
    }
    if (filtroMetal    && r.metal    !== filtroMetal)    return false
    if (filtroFamilia  && r.familia  !== filtroFamilia)  return false
    if (filtroCategory && r.category !== filtroCategory) return false
    if (filtroEstado === 'catalogo')      return !r.is_discontinued
    if (filtroEstado === 'descatalogado') return r.is_discontinued
    return true
  })

  const hasFilters = search || filtroMetal || filtroFamilia || filtroCategory || filtroEstado

  function limpiarFiltros() {
    setSearch('')
    setFiltroMetal('')
    setFiltroFamilia('')
    setFiltroCategory('')
    setFiltroEstado('')
  }

  async function handleDescargarExcel() {
    setDescargando(true)
    try {
      const params = new URLSearchParams()
      if (filtroMetal)    params.set('metal',    filtroMetal)
      if (filtroFamilia)  params.set('familia',  filtroFamilia)
      if (filtroCategory) params.set('category', filtroCategory)

      const res  = await fetch(`/api/catalog/pedidos-excel?${params}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      a.href     = url
      a.download = `Plantilla-Pedidos-TQ-${fecha}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Search */}
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

        {/* Metal */}
        <select
          value={filtroMetal}
          onChange={e => setFiltroMetal(e.target.value)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: filtroMetal ? '#00557f' : '#fff',
            color:      filtroMetal ? '#fff'    : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Metal</option>
          {metals.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Familia */}
        <select
          value={filtroFamilia}
          onChange={e => setFiltroFamilia(e.target.value)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: filtroFamilia ? '#00557f' : '#fff',
            color:      filtroFamilia ? '#fff'    : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Familia</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Categoría */}
        <select
          value={filtroCategory}
          onChange={e => setFiltroCategory(e.target.value)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: filtroCategory ? '#00557f' : '#fff',
            color:      filtroCategory ? '#fff'    : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Categoría</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Estado */}
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold border-0 focus:outline-none"
          style={{
            background: filtroEstado ? '#00557f' : '#fff',
            color:      filtroEstado ? '#fff'    : '#00557f',
            boxShadow:  '0 1px 4px rgba(0,32,60,0.1)',
          }}
        >
          <option value="">Estado</option>
          <option value="catalogo">En Catálogo</option>
          <option value="descatalogado">Descatalogado</option>
        </select>

        {/* Limpiar */}
        {hasFilters && (
          <button
            onClick={limpiarFiltros}
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}
          >
            ✕ Limpiar filtros
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Contador */}
        <span className="text-xs shrink-0" style={{ color: '#b2b2b2' }}>
          {filtered.length} modelo{filtered.length !== 1 ? 's' : ''}
        </span>

        {/* Excel */}
        <button
          onClick={handleDescargarExcel}
          disabled={descargando}
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-opacity"
          style={{ background: '#C8842A', color: '#fff', opacity: descargando ? 0.6 : 1 }}
        >
          {descargando ? '…' : '↓ Descargar plantilla Excel'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ boxShadow: '0 2px 8px rgba(0,32,60,0.08)' }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: '#00557f', color: '#fff' }} className="sticky top-0 z-10">
              <th className="px-3 py-2.5 text-left text-xs font-semibold w-12">Img</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Categoría</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Metal</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Familia</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Código</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold min-w-48">Descripción</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-sm" style={{ color: '#b2b2b2', background: '#fff' }}>
                  Sin resultados para estos filtros
                </td>
              </tr>
            ) : (
              filtered.map(r => (
                <tr
                  key={r.codigo_modelo}
                  className="border-b hover:bg-[#f8f7f5] transition-colors"
                  style={{
                    background: '#fff',
                    borderColor: 'rgba(0,0,0,0.05)',
                    opacity: r.is_discontinued ? 0.6 : 1,
                  }}
                >
                  {/* Imagen */}
                  <td className="px-3 py-2">
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt={r.description ?? r.codigo_modelo}
                        width={40}
                        height={40}
                        className="rounded-md object-cover shrink-0"
                        style={{ width: 40, height: 40 }}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-md text-lg shrink-0"
                        style={{ width: 40, height: 40, background: '#f5f3f0', color: '#d0cdc9' }}
                      >
                        ◫
                      </div>
                    )}
                  </td>

                  {/* Categoría */}
                  <td className="px-3 py-2 text-xs" style={{ color: '#00557f' }}>
                    {r.category ?? '—'}
                  </td>

                  {/* Metal */}
                  <td className="px-3 py-2 text-xs" style={{ color: '#444' }}>
                    {r.metal ?? '—'}
                  </td>

                  {/* Familia */}
                  <td className="px-3 py-2 text-xs" style={{ color: '#444' }}>
                    {r.familia ?? '—'}
                  </td>

                  {/* Código */}
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs" style={{ color: '#888' }}>
                      {r.codigo_modelo}
                    </span>
                  </td>

                  {/* Descripción */}
                  <td className="px-3 py-2 max-w-xs">
                    <span className="line-clamp-2 text-xs leading-snug" style={{ color: '#00557f' }}>
                      {r.description ?? '—'}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-3 py-2">
                    {r.is_discontinued ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(80,80,80,0.12)', color: '#555' }}
                      >
                        Descatalogado
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(58,158,106,0.12)', color: '#2a7a50' }}
                      >
                        En Catálogo
                      </span>
                    )}
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
