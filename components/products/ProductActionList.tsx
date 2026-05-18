'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────

export type ProductActionListContext = 'analytics' | 'sin-rotacion' | 'general'

export interface ProductActionListProps {
  codigosModelo: string[]
  titulo?: string
  onClose?: () => void
  context?: ProductActionListContext
}

type Row = {
  codigo_modelo:    string
  description:      string | null
  familia:          string | null
  metal:            string | null
  karat:            string | null
  abc_ventas:       string | null
  lifecycle_status: string
  is_discontinued:  boolean
  imageUrl:         string | null
  stock_total:      number
  precio_venta:     number | null
  pct_margen_bruto: number | null
}

type Campaign = { id: string; nombre: string }
type FieldDef = { field_key: string; label: string; field_type: string; options: string[] | null }

const LIFECYCLE_OPTIONS = [
  { value: 'activo',         label: 'Activo',          color: '#3A9E6A' },
  { value: 'en_revision',    label: 'En revisión',     color: '#C8842A' },
  { value: 'a_discontinuar', label: 'A discontinuar',  color: '#C0392B' },
  { value: 'descatalogado',  label: 'Descatalogado',   color: '#888888' },
]

// ── Sub-components ────────────────────────────────────────────────

function AbcBadge({ abc }: { abc: string | null }) {
  if (!abc) return <span style={{ color: '#d0cdc9' }}>—</span>
  const cfg: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54' },
    B: { bg: 'rgba(0,153,242,0.12)',   text: '#007acc' },
    C: { bg: 'rgba(200,132,42,0.12)',  text: '#a06818' },
  }
  const { bg, text } = cfg[abc] ?? { bg: 'rgba(0,85,127,0.06)', text: '#b2b2b2' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: bg, color: text }}>
      {abc}
    </span>
  )
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}>
      ⚠ 0
    </span>
  )
  return <span className="font-mono text-xs font-bold" style={{ color: '#3A9E6A' }}>{stock.toLocaleString('es-ES')}</span>
}

function LifecycleBadge({ value }: { value: string }) {
  const opt = LIFECYCLE_OPTIONS.find(o => o.value === value) ?? LIFECYCLE_OPTIONS[0]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: `${opt.color}18`, color: opt.color }}>
      {opt.label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────

export function ProductActionList({ codigosModelo, titulo, onClose, context = 'general' }: ProductActionListProps) {
  const { toast } = useToast()
  const router = useRouter()

  const [rows, setRows]               = useState<Row[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [fieldDefs, setFieldDefs]     = useState<FieldDef[]>([])

  // Bulk lifecycle UI
  const [showLifecycleDrop, setShowLifecycleDrop]   = useState(false)
  const [pendingLifecycle, setPendingLifecycle]     = useState<string | null>(null)

  // Bulk campaign UI
  const [showCampaignDrop, setShowCampaignDrop]     = useState(false)
  const [addingCampaign, setAddingCampaign]         = useState(false)

  // Bulk custom field UI
  const [showFieldPanel, setShowFieldPanel]         = useState(false)
  const [bulkFieldKey, setBulkFieldKey]             = useState('')
  const [bulkFieldValue, setBulkFieldValue]         = useState('')
  const [savingField, setSavingField]               = useState(false)

  // Export
  const [exporting, setExporting]                   = useState(false)

  // ── Fetch products ──
  useEffect(() => {
    if (codigosModelo.length === 0) { setLoading(false); return }
    setLoading(true)
    fetch('/api/products/by-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: codigosModelo }),
    })
      .then(r => r.json())
      .then(data => { setRows(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { toast('Error cargando productos', 'error'); setLoading(false) })
  }, [codigosModelo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch campaigns + field defs ──
  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns').then(r => r.json()),
      fetch('/api/settings/fields').then(r => r.json()).catch(() => []),
    ]).then(([camps, fields]) => {
      setCampaigns(Array.isArray(camps) ? camps.filter((c: Campaign & { estado: string }) => c.estado === 'activa' || c.estado === 'borrador') : [])
      setFieldDefs(Array.isArray(fields) ? fields : [])
    })
  }, [])

  // ── Selection ──
  function toggleAll() {
    setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.codigo_modelo)))
  }
  function toggle(code: string) {
    setSelected(s => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n })
  }

  const selectedCodes = Array.from(selected)
  const hasSelection  = selectedCodes.length > 0

  // ── Lifecycle inline change ──
  async function changeLifecycleOne(code: string, value: string) {
    setRows(prev => prev.map(r => r.codigo_modelo === code ? { ...r, lifecycle_status: value } : r))
    const res = await fetch('/api/products/lifecycle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: [code], lifecycle_status: value }),
    })
    if (!res.ok) { toast('Error actualizando estado', 'error'); return }
    toast('Estado actualizado', 'success')
  }

  // ── Lifecycle bulk ──
  async function applyBulkLifecycle() {
    if (!pendingLifecycle || !hasSelection) return
    const res = await fetch('/api/products/lifecycle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: selectedCodes, lifecycle_status: pendingLifecycle }),
    })
    setPendingLifecycle(null)
    setShowLifecycleDrop(false)
    if (!res.ok) { toast('Error actualizando estados', 'error'); return }
    setRows(prev => prev.map(r => selected.has(r.codigo_modelo) ? { ...r, lifecycle_status: pendingLifecycle } : r))
    toast(`${selectedCodes.length} producto(s) actualizados`, 'success')
    setSelected(new Set())
  }

  // ── Add to campaign ──
  async function addToCampaign(campaign: Campaign) {
    setAddingCampaign(true)
    setShowCampaignDrop(false)
    const res = await fetch(`/api/campaigns/${campaign.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos: selectedCodes }),
    })
    setAddingCampaign(false)
    if (!res.ok) { toast('Error añadiendo a campaña', 'error'); return }
    toast(`${selectedCodes.length} producto(s) añadidos a "${campaign.nombre}"`, 'success')
    setSelected(new Set())
  }

  // ── Export Excel ──
  async function exportExcel() {
    setExporting(true)
    const codes = hasSelection ? selectedCodes : rows.map(r => r.codigo_modelo)
    const res = await fetch('/api/export/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualCodes: codes }),
    })
    setExporting(false)
    if (!res.ok) { toast('Error exportando', 'error'); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'productos.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Bulk custom field ──
  async function saveBulkField() {
    if (!bulkFieldKey || !bulkFieldValue || !hasSelection) return
    setSavingField(true)
    const res = await fetch('/api/batch/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: [bulkFieldKey],
        rows: selectedCodes.map(c => ({ codigo_modelo: c, [bulkFieldKey]: bulkFieldValue })),
      }),
    })
    setSavingField(false)
    setShowFieldPanel(false)
    setBulkFieldKey(''); setBulkFieldValue('')
    if (!res.ok) { toast('Error guardando campo', 'error'); return }
    toast(`Campo actualizado en ${selectedCodes.length} producto(s)`, 'success')
  }

  // ── Send to sin-rotacion ──
  function sendToSinRotacion() {
    const codes = hasSelection ? selectedCodes : rows.map(r => r.codigo_modelo)
    router.push(`/sin-rotacion?codes=${codes.join(',')}`)
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div
      className="mt-4 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ border: '1px solid rgba(0,85,127,0.1)', boxShadow: '0 4px 16px rgba(0,32,60,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-tq-snorkel">{titulo ?? 'Productos seleccionados'}</span>
          {!loading && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}>
              {rows.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="text-xs px-2 py-1 rounded-lg hover:bg-white/60 transition-colors" style={{ color: '#b2b2b2' }}>
              ✕ Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Toolbar — only when items selected */}
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ background: '#00557f', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-white text-xs font-semibold mr-1">{selectedCodes.length} seleccionado{selectedCodes.length !== 1 ? 's' : ''}</span>

          {/* Lifecycle bulk */}
          <div className="relative">
            <button
              onClick={() => { setShowLifecycleDrop(v => !v); setShowCampaignDrop(false); setShowFieldPanel(false) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              ◈ Estado ciclo vida
            </button>
            {showLifecycleDrop && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLifecycleDrop(false)} />
                <div className="absolute top-full mt-1 left-0 z-20 rounded-xl py-1 min-w-44" style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,32,60,0.18)', border: '1px solid rgba(0,85,127,0.1)' }}>
                  {pendingLifecycle && (
                    <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
                      <span className="text-xs text-tq-snorkel flex-1">Cambiar a: <strong>{LIFECYCLE_OPTIONS.find(o => o.value === pendingLifecycle)?.label}</strong></span>
                      <button onClick={applyBulkLifecycle} className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: '#00557f' }}>Confirmar</button>
                    </div>
                  )}
                  {LIFECYCLE_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setPendingLifecycle(o.value)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[rgba(0,85,127,0.05)] transition-colors"
                      style={{ color: o.color, fontWeight: pendingLifecycle === o.value ? 700 : 400 }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Add to campaign */}
          <div className="relative">
            <button
              onClick={() => { setShowCampaignDrop(v => !v); setShowLifecycleDrop(false); setShowFieldPanel(false) }}
              disabled={addingCampaign}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              {addingCampaign ? '…' : '◈ Añadir a campaña'}
            </button>
            {showCampaignDrop && campaigns.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCampaignDrop(false)} />
                <div className="absolute top-full mt-1 left-0 z-20 rounded-xl py-1 min-w-48" style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,32,60,0.18)', border: '1px solid rgba(0,85,127,0.1)' }}>
                  {campaigns.map(c => (
                    <button key={c.id} onClick={() => addToCampaign(c)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[rgba(0,85,127,0.05)] transition-colors text-tq-snorkel">
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </>
            )}
            {showCampaignDrop && campaigns.length === 0 && (
              <div className="absolute top-full mt-1 left-0 z-20 rounded-xl px-4 py-3 text-xs" style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,32,60,0.18)', color: '#b2b2b2' }}>
                Sin campañas activas
              </div>
            )}
          </div>

          {/* Export Excel */}
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            {exporting ? '…' : '↓ Excel'}
          </button>

          {/* Bulk custom field */}
          {fieldDefs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowFieldPanel(v => !v); setShowLifecycleDrop(false); setShowCampaignDrop(false) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                ✏ Campo custom
              </button>
              {showFieldPanel && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFieldPanel(false)} />
                  <div className="absolute top-full mt-1 left-0 z-20 rounded-xl p-3 min-w-64" style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,32,60,0.18)', border: '1px solid rgba(0,85,127,0.1)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Editar campo en bulk</p>
                    <select value={bulkFieldKey} onChange={e => setBulkFieldKey(e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs mb-2 border" style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}>
                      <option value="">Selecciona campo…</option>
                      {fieldDefs.map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
                    </select>
                    {bulkFieldKey && (
                      fieldDefs.find(f => f.field_key === bulkFieldKey)?.options?.length
                        ? <select value={bulkFieldValue} onChange={e => setBulkFieldValue(e.target.value)}
                            className="w-full rounded-lg px-2 py-1.5 text-xs mb-2 border" style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}>
                            <option value="">Selecciona valor…</option>
                            {fieldDefs.find(f => f.field_key === bulkFieldKey)!.options!.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        : <input value={bulkFieldValue} onChange={e => setBulkFieldValue(e.target.value)}
                            placeholder="Valor…"
                            className="w-full rounded-lg px-2 py-1.5 text-xs mb-2 border" style={{ borderColor: 'rgba(0,85,127,0.2)' }} />
                    )}
                    <button onClick={saveBulkField} disabled={savingField || !bulkFieldKey || !bulkFieldValue}
                      className="w-full py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 transition-colors"
                      style={{ background: '#00557f' }}>
                      {savingField ? 'Guardando…' : 'Aplicar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Send to sin-rotacion */}
          {context !== 'sin-rotacion' && (
            <button
              onClick={sendToSinRotacion}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              → Sin rotación
            </button>
          )}

          <button onClick={() => setSelected(new Set())} className="ml-auto text-white/50 hover:text-white text-xs transition-colors">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12" style={{ color: '#b2b2b2' }}>
            <span className="text-sm animate-pulse">Cargando productos…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-10" style={{ color: '#b2b2b2' }}>
            <span className="text-sm">Sin productos</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length }}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="w-12 px-3 py-2.5" />
                {(['Código', 'Descripción', 'Familia / Metal', 'ABC', 'Stock', 'Estado ciclo vida', 'Precio / Margen'] as const).map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr
                  key={p.codigo_modelo}
                  className="hover:bg-[rgba(0,85,127,0.02)] transition-colors"
                  style={{
                    borderBottom: i < rows.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                    background: selected.has(p.codigo_modelo) ? 'rgba(0,153,242,0.04)' : undefined,
                  }}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(p.codigo_modelo)} onChange={() => toggle(p.codigo_modelo)} className="cursor-pointer" />
                  </td>

                  {/* Image */}
                  <td className="px-3 py-2">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" style={{ background: '#f5f3f0' }} />
                      : <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(0,85,127,0.06)', color: '#d0cdc9' }}>◫</div>
                    }
                  </td>

                  {/* Código */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/products/${p.codigo_modelo}`} className="font-mono text-xs font-bold text-tq-sky hover:underline">
                      {p.codigo_modelo}
                    </Link>
                  </td>

                  {/* Descripción */}
                  <td className="px-3 py-2 max-w-xs">
                    <span className="line-clamp-2 text-xs leading-snug text-tq-snorkel">{p.description ?? '—'}</span>
                  </td>

                  {/* Familia / Metal */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-tq-snorkel">{p.familia ?? '—'}</span>
                    {p.metal && <span className="ml-1.5 text-[10px]" style={{ color: '#b2b2b2' }}>· {p.metal}</span>}
                  </td>

                  {/* ABC */}
                  <td className="px-3 py-2"><AbcBadge abc={p.abc_ventas} /></td>

                  {/* Stock */}
                  <td className="px-3 py-2"><StockBadge stock={p.stock_total} /></td>

                  {/* Lifecycle inline */}
                  <td className="px-3 py-2">
                    <LifecycleSelect value={p.lifecycle_status} onChange={v => changeLifecycleOne(p.codigo_modelo, v)} />
                  </td>

                  {/* Precio / Margen */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.precio_venta != null ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-tq-snorkel">
                          {p.precio_venta.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                        {p.pct_margen_bruto != null && (
                          <span className="text-[10px]" style={{ color: p.pct_margen_bruto >= 40 ? '#3A9E6A' : p.pct_margen_bruto >= 20 ? '#C8842A' : '#C0392B' }}>
                            {p.pct_margen_bruto.toFixed(1)}% mg
                          </span>
                        )}
                      </div>
                    ) : <span style={{ color: '#d0cdc9' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Lifecycle inline select ────────────────────────────────────────

function LifecycleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opt = LIFECYCLE_OPTIONS.find(o => o.value === value) ?? LIFECYCLE_OPTIONS[0]
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg px-2 py-1 text-[11px] font-bold border-0 cursor-pointer outline-none"
      style={{ background: `${opt.color}18`, color: opt.color, minWidth: 120 }}
    >
      {LIFECYCLE_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
