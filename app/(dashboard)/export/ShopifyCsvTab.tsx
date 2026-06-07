'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ShopifyCsvTabProps {
  familias:       string[]
  metals:         string[]
  abcs:           string[]
  totalProducts:  number
  syncedProducts: number
  sinDescripcion: number
}

export function ShopifyCsvTab({
  familias, metals, abcs, totalProducts, syncedProducts, sinDescripcion,
}: ShopifyCsvTabProps) {
  const [filterNoSync, setFilterNoSync] = useState(false)
  const [filterDraft,  setFilterDraft]  = useState(false)
  const [familia,      setFamilia]      = useState('')
  const [metal,        setMetal]        = useState('')
  const [abc,          setAbc]          = useState('')
  const [downloading,  setDownloading]  = useState(false)

  const noSync = totalProducts - syncedProducts

  async function download() {
    setDownloading(true)
    const params = new URLSearchParams()
    if (filterNoSync)      params.set('no_sync', 'true')
    if (filterDraft)       params.set('draft', 'true')
    if (familia)           params.set('familia', familia)
    if (metal)             params.set('metal', metal)
    if (abc)               params.set('abc', abc)

    const res = await fetch(`/api/export/shopify-csv?${params.toString()}`)
    setDownloading(false)
    if (!res.ok) { alert('Error al generar CSV'); return }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'shopify.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Productos activos', value: totalProducts, color: '#00557f' },
          { label: 'En Shopify',        value: syncedProducts, color: '#3A9E6A' },
          { label: 'Sin sincronizar',   value: noSync,         color: noSync > 0 ? '#C8842A' : '#3A9E6A' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl px-5 py-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#b2b2b2' }}>{k.label}</div>
            <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Warning */}
      {sinDescripcion > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(200,132,42,0.08)', border: '1px solid rgba(200,132,42,0.25)', color: '#a06818' }}
        >
          <span className="text-base mt-0.5">⚠</span>
          <div>
            <strong>{sinDescripcion} producto{sinDescripcion !== 1 ? 's' : ''} sin descripción Shopify</strong>
            {' '}· Puedes generarlos con IA desde la ficha del producto antes de exportar.{' '}
            <Link href="/products" className="underline font-semibold">Ir al catálogo →</Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl px-5 py-4 space-y-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Filtros de exportación</p>

        <div className="flex flex-wrap gap-3">
          {/* Quick filters */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterNoSync}
              onChange={e => { setFilterNoSync(e.target.checked); if (e.target.checked) setFilterDraft(false) }}
              style={{ accentColor: '#C8842A' }}
            />
            <span style={{ color: filterNoSync ? '#C8842A' : '#b2b2b2' }}>Solo sin sincronizar ({noSync})</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterDraft}
              onChange={e => { setFilterDraft(e.target.checked); if (e.target.checked) setFilterNoSync(false) }}
              style={{ accentColor: '#C8842A' }}
            />
            <span style={{ color: filterDraft ? '#C8842A' : '#b2b2b2' }}>Solo borradores</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={familia}
            onChange={e => setFamilia(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border outline-none"
            style={{ borderColor: familia ? '#C8842A' : 'rgba(0,85,127,0.2)', color: familia ? '#C8842A' : '#b2b2b2' }}
          >
            <option value="">Todas las familias</option>
            {familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <select
            value={metal}
            onChange={e => setMetal(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border outline-none"
            style={{ borderColor: metal ? '#C8842A' : 'rgba(0,85,127,0.2)', color: metal ? '#C8842A' : '#b2b2b2' }}
          >
            <option value="">Todos los metales</option>
            {metals.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={abc}
            onChange={e => setAbc(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border outline-none"
            style={{ borderColor: abc ? '#C8842A' : 'rgba(0,85,127,0.2)', color: abc ? '#C8842A' : '#b2b2b2' }}
          >
            <option value="">Todos los ABC</option>
            {abcs.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {(familia || metal || abc || filterNoSync || filterDraft) && (
            <button
              onClick={() => { setFamilia(''); setMetal(''); setAbc(''); setFilterNoSync(false); setFilterDraft(false) }}
              className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(0,85,127,0.06)', color: '#b2b2b2' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Columns reference */}
      <div
        className="px-4 py-3 rounded-xl text-xs"
        style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)', color: '#b2b2b2' }}
      >
        <span className="font-semibold text-tq-snorkel">Columnas del CSV: </span>
        Handle · Title · Body (HTML) · Vendor · Type · Tags · Published · Option1 Name · Option1 Value · Variant SKU · Variant Price · Variant Compare At Price · Image Src · Image Position · SEO Title · SEO Description
      </div>

      {/* Download button */}
      <button
        onClick={download}
        disabled={downloading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: '#96BF48' }}
      >
        {downloading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generando CSV…
          </>
        ) : (
          <>↓ Descargar CSV de Shopify</>
        )}
      </button>
    </div>
  )
}
