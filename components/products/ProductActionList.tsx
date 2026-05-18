'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  codigo:          string
  desc:            string | null
  familia:         string | null
  metal:           string | null
  abc:             string | null
  lifecycleStatus: string
  stockTotal:      number
  precioVenta:     number | null
  pctMargen:       number | null
  imageUrl:        string | null
}

interface Campaign { id: string; nombre: string }
interface FieldDef  { field_key: string; label: string; field_type: string }

type LifecycleStatus = 'activo' | 'en_revision' | 'a_discontinuar' | 'descatalogado'

interface Props {
  codigosModelo: string[]
  titulo?:       string
  onClose?:      () => void
  context?:      'analytics' | 'sin-rotacion' | 'general'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS: { value: LifecycleStatus; label: string; color: string }[] = [
  { value: 'activo',          label: 'Activo',          color: '#3A9E6A' },
  { value: 'en_revision',     label: 'En revisión',     color: '#C8842A' },
  { value: 'a_discontinuar',  label: 'A discontinuar',  color: '#C0392B' },
  { value: 'descatalogado',   label: 'Descatalogado',   color: '#6b7280' },
]

const ABC_CLS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-red-100 text-red-700',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductActionList({ codigosModelo, titulo, onClose, context = 'general' }: Props) {
  const [products,   setProducts]   = useState<ProductRow[]>([])
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([])
  const [fieldDefs,  setFieldDefs]  = useState<FieldDef[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())

  // Bulk action state
  const [lifecycleOpen,   setLifecycleOpen]   = useState(false)
  const [campaignOpen,    setCampaignOpen]     = useState(false)
  const [fieldOpen,       setFieldOpen]        = useState(false)
  const [confirmLifecycle, setConfirmLifecycle] = useState<LifecycleStatus | null>(null)
  const [selectedField,   setSelectedField]    = useState('')
  const [fieldValue,      setFieldValue]       = useState('')
  const [saving,          setSaving]           = useState(false)
  const [toast,           setToast]            = useState<{ msg: string; ok: boolean } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [prodRes, campRes, fieldRes] = await Promise.all([
          fetch('/api/products/by-codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes: codigosModelo }),
          }).then(r => r.json()),
          fetch('/api/campaigns').then(r => r.json()),
          fetch('/api/settings/fields').then(r => r.json()),
        ])
        setProducts(Array.isArray(prodRes) ? prodRes as ProductRow[] : [])
        setCampaigns(Array.isArray(campRes) ? campRes as Campaign[] : [])
        setFieldDefs(Array.isArray(fieldRes) ? fieldRes as FieldDef[] : [])
        setSelected(new Set(codigosModelo))
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [codigosModelo])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Scroll into view
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const allSelected  = products.length > 0 && products.every(p => selected.has(p.codigo))
  const selectedList = products.filter(p => selected.has(p.codigo))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map(p => p.codigo)))
  }

  function toggleOne(code: string) {
    const next = new Set(selected)
    next.has(code) ? next.delete(code) : next.add(code)
    setSelected(next)
  }

  function show(msg: string, ok = true) {
    setToast({ msg, ok })
  }

  async function applyLifecycle(status: LifecycleStatus) {
    if (selectedList.length === 0) return
    setSaving(true)
    try {
      const r = await fetch('/api/products/lifecycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: selectedList.map(p => p.codigo), lifecycle_status: status }),
      })
      if (!r.ok) throw new Error()
      setProducts(prev => prev.map(p =>
        selected.has(p.codigo) ? { ...p, lifecycleStatus: status } : p
      ))
      show(`Estado actualizado (${selectedList.length} productos)`)
    } catch {
      show('Error al actualizar estado', false)
    }
    setSaving(false)
    setConfirmLifecycle(null)
    setLifecycleOpen(false)
  }

  async function addToCampaign(campaignId: string) {
    if (selectedList.length === 0) return
    setSaving(true)
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigosModelo: selectedList.map(p => p.codigo) }),
      })
      if (!r.ok) throw new Error()
      show(`${selectedList.length} productos añadidos a la campaña`)
    } catch {
      show('Error al añadir a campaña', false)
    }
    setSaving(false)
    setCampaignOpen(false)
  }

  async function applyBulkField() {
    if (!selectedField || !fieldValue.trim() || selectedList.length === 0) return
    setSaving(true)
    try {
      await Promise.all(
        selectedList.map(p =>
          fetch(`/api/products/${p.codigo}/custom-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field_key: selectedField, field_value: fieldValue.trim() }),
          })
        )
      )
      show(`Campo actualizado en ${selectedList.length} productos`)
    } catch {
      show('Error al actualizar campo', false)
    }
    setSaving(false)
    setFieldOpen(false)
    setSelectedField('')
    setFieldValue('')
  }

  async function exportExcel() {
    setSaving(true)
    try {
      const r = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualCodes: selectedList.map(p => p.codigo) }),
      })
      if (!r.ok) throw new Error()
      const blob = await r.blob()
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: 'productos-tq.xlsx' })
      a.click()
      URL.revokeObjectURL(url)
      show('Excel descargado')
    } catch {
      show('Error al exportar', false)
    }
    setSaving(false)
  }

  return (
    <div ref={containerRef} className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,32,60,0.12)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2ddd9] bg-[#fafaf9]">
        <div>
          <h3 className="text-sm font-bold text-[#00557f]">{titulo ?? `${codigosModelo.length} productos`}</h3>
          <p className="text-xs text-[#b2b2b2] mt-0.5">
            {selected.size} seleccionados de {products.length} · clic en fila para ver ficha
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#b2b2b2] hover:text-[#1d1d1b] text-xl leading-none p-1"
          >
            ×
          </button>
        )}
      </div>

      {/* Toolbar */}
      {selectedList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-b border-[#f0ece8] bg-[#f8f7f5]">
          <span className="text-xs font-semibold text-[#00557f] mr-1">
            {selectedList.length} sel.
          </span>

          {/* Lifecycle dropdown */}
          <div className="relative">
            <button
              onClick={() => { setLifecycleOpen(!lifecycleOpen); setCampaignOpen(false); setFieldOpen(false) }}
              className="px-3 py-1 text-xs border border-[#e2ddd9] rounded-lg hover:border-[#00557f] transition-colors bg-white"
            >
              Estado →
            </button>
            {lifecycleOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#e2ddd9] rounded-lg shadow-lg min-w-[160px] py-1">
                {LIFECYCLE_OPTIONS.map(opt => (
                  confirmLifecycle === opt.value ? (
                    <div key={opt.value} className="px-3 py-2 bg-amber-50">
                      <p className="text-xs text-[#1d1d1b] mb-2">¿Confirmar para {selectedList.length} productos?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => applyLifecycle(opt.value)}
                          disabled={saving}
                          className="px-2 py-1 text-[10px] bg-[#00557f] text-white rounded font-semibold disabled:opacity-50"
                        >
                          {saving ? '…' : 'Sí'}
                        </button>
                        <button onClick={() => setConfirmLifecycle(null)} className="px-2 py-1 text-[10px] border border-[#e2ddd9] rounded">
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={opt.value}
                      onClick={() => setConfirmLifecycle(opt.value)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0ece8] transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Campaign dropdown */}
          {campaigns.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setCampaignOpen(!campaignOpen); setLifecycleOpen(false); setFieldOpen(false) }}
                className="px-3 py-1 text-xs border border-[#e2ddd9] rounded-lg hover:border-[#C8842A] transition-colors bg-white"
              >
                + Campaña
              </button>
              {campaignOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#e2ddd9] rounded-lg shadow-lg min-w-[200px] py-1 max-h-48 overflow-y-auto">
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      onClick={() => addToCampaign(c.id)}
                      disabled={saving}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0ece8] transition-colors disabled:opacity-50"
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom field bulk */}
          {fieldDefs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setFieldOpen(!fieldOpen); setLifecycleOpen(false); setCampaignOpen(false) }}
                className="px-3 py-1 text-xs border border-[#e2ddd9] rounded-lg hover:border-[#3A9E6A] transition-colors bg-white"
              >
                Campo →
              </button>
              {fieldOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#e2ddd9] rounded-lg shadow-lg p-3 min-w-[220px]">
                  <select
                    value={selectedField}
                    onChange={e => setSelectedField(e.target.value)}
                    className="w-full text-xs border border-[#e2ddd9] rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-[#00557f]"
                  >
                    <option value="">Seleccionar campo…</option>
                    {fieldDefs.map(f => (
                      <option key={f.field_key} value={f.field_key}>{f.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Valor…"
                    value={fieldValue}
                    onChange={e => setFieldValue(e.target.value)}
                    className="w-full text-xs border border-[#e2ddd9] rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-[#00557f]"
                  />
                  <button
                    onClick={applyBulkField}
                    disabled={!selectedField || !fieldValue.trim() || saving}
                    className="w-full py-1 text-xs bg-[#00557f] text-white rounded font-semibold disabled:opacity-40"
                  >
                    {saving ? 'Guardando…' : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Export */}
          <button
            onClick={exportExcel}
            disabled={saving}
            className="px-3 py-1 text-xs border border-[#e2ddd9] rounded-lg hover:border-[#00557f] transition-colors bg-white disabled:opacity-50"
          >
            ↓ Excel
          </button>

          {/* → Sin rotación (hidden in sin-rotacion context) */}
          {context !== 'sin-rotacion' && (
            <Link
              href={`/sin-rotacion?codes=${selectedList.map(p => p.codigo).join(',')}`}
              className="px-3 py-1 text-xs border border-[#e2ddd9] rounded-lg hover:border-[#C0392B] transition-colors bg-white"
            >
              ⊗ Sin rotación
            </Link>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-sm text-[#b2b2b2]">Cargando productos…</div>
      ) : products.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#b2b2b2]">No se encontraron productos</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e2ddd9] bg-[#fafaf9]">
                <th className="w-8 pl-4 pr-2 py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#00557f]" />
                </th>
                <th className="w-10 py-2.5"></th>
                {['Código', 'Descripción', 'Familia/Metal', 'ABC', 'Stock', 'Estado', 'Precio', 'Margen'].map(h => (
                  <th key={h} className="text-left py-2.5 pr-3 font-bold text-[#00557f] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const lcOpt = LIFECYCLE_OPTIONS.find(o => o.value === p.lifecycleStatus) ?? LIFECYCLE_OPTIONS[0]
                return (
                  <tr
                    key={p.codigo}
                    className={`border-b border-[#f0ece8] transition-colors ${
                      selected.has(p.codigo) ? 'bg-blue-50/30' : 'hover:bg-[#fafaf9]'
                    }`}
                  >
                    <td className="pl-4 pr-2 py-2" onClick={() => toggleOne(p.codigo)}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.codigo)}
                        onChange={() => toggleOne(p.codigo)}
                        className="accent-[#00557f]"
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td className="w-10 py-2 pr-2">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.desc ?? p.codigo}
                          width={32}
                          height={32}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#f0ece8]" />
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/products/${p.codigo}`}
                        className="font-mono text-[#b2b2b2] hover:text-[#00557f]"
                        target="_blank"
                      >
                        {p.codigo}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate text-[#1d1d1b]">{p.desc ?? '—'}</td>
                    <td className="py-2 pr-3 text-[#b2b2b2]">
                      {[p.familia, p.metal].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {p.abc
                        ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ABC_CLS[p.abc] ?? 'bg-gray-100 text-gray-500'}`}>{p.abc}</span>
                        : <span className="text-[#b2b2b2]">—</span>
                      }
                    </td>
                    <td className="py-2 pr-3">
                      {p.stockTotal > 0
                        ? <span className="font-semibold text-[#1d1d1b]">{p.stockTotal.toLocaleString('es-ES')}</span>
                        : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">⚠ 0</span>
                      }
                    </td>
                    <td className="py-2 pr-3">
                      <LifecycleSelect
                        codigo={p.codigo}
                        value={p.lifecycleStatus as LifecycleStatus}
                        color={lcOpt.color}
                        onChange={status => setProducts(prev => prev.map(r => r.codigo === p.codigo ? { ...r, lifecycleStatus: status } : r))}
                      />
                    </td>
                    <td className="py-2 pr-3 text-[#00557f]">
                      {p.precioVenta != null
                        ? p.precioVenta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                        : '—'}
                    </td>
                    <td className="py-2 text-[#b2b2b2]">
                      {p.pctMargen != null ? `${p.pctMargen}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.ok ? 'bg-[#3A9E6A]' : 'bg-[#C0392B]'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Inline lifecycle selector ────────────────────────────────────────────────

function LifecycleSelect({
  codigo,
  value,
  color,
  onChange,
}: {
  codigo:   string
  value:    LifecycleStatus
  color:    string
  onChange: (v: LifecycleStatus) => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as LifecycleStatus
    setSaving(true)
    try {
      await fetch('/api/products/lifecycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: [codigo], lifecycle_status: next }),
      })
      onChange(next)
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="text-[10px] px-1.5 py-0.5 rounded border-0 font-semibold cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[#00557f]"
      style={{ background: `${color}18`, color }}
      onClick={e => e.stopPropagation()}
    >
      {LIFECYCLE_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
