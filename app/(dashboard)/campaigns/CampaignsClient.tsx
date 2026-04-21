'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui'
import type { CampaignRow } from './page'

// ── helpers ───────────────────────────────────────────────────────

const TIPOS = ['GTM', 'Propia', 'Estacional', 'Liquidacion'] as const
const ESTADOS = ['borrador', 'activa', 'finalizada'] as const
const COLORES = ['#C8842A', '#3A9E6A', '#0099f2', '#9B59B6', '#E74C3C', '#1ABC9C', '#E67E22', '#00557f']

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = {
    activa:     { bg: 'rgba(58,158,106,0.12)',  color: '#2d7a54',  label: 'Activa'     },
    borrador:   { bg: 'rgba(0,85,127,0.08)',    color: '#b2b2b2',  label: 'Borrador'   },
    finalizada: { bg: 'rgba(192,57,43,0.10)',   color: '#992d22',  label: 'Finalizada' },
  }[estado] ?? { bg: 'rgba(0,85,127,0.08)', color: '#b2b2b2', label: estado }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return null
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(200,132,42,0.12)', color: '#8B5E1A' }}>
      {tipo}
    </span>
  )
}

// ── types ─────────────────────────────────────────────────────────

type ProductInCampaign = {
  id: string
  codigo_modelo: string
  added_by: string | null
  added_at: string
  products: { codigo_modelo: string; description: string | null; familia: string | null; metal: string | null; abc_ventas: string | null; ingresos_12m: number | null } | null
}

type FormState = {
  nombre: string; tipo: string; descripcion: string
  fecha_inicio: string; fecha_fin: string; estado: string; color: string
}

const EMPTY_FORM: FormState = { nombre: '', tipo: '', descripcion: '', fecha_inicio: '', fecha_fin: '', estado: 'borrador', color: '' }

// ── main component ────────────────────────────────────────────────

export function CampaignsClient({ campaigns: initial }: { campaigns: CampaignRow[] }) {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initial)
  const [selected, setSelected] = useState<CampaignRow | null>(null)
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Products in selected campaign
  const [products, setProducts] = useState<ProductInCampaign[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)

  const loadProducts = useCallback(async (id: string) => {
    setLoadingProducts(true)
    const res = await fetch(`/api/campaigns/${id}/products`)
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoadingProducts(false)
  }, [])

  useEffect(() => {
    if (selected && mode === 'view') loadProducts(selected.id)
  }, [selected, mode, loadProducts])

  function openCreate() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setMode('create')
  }

  function openEdit(c: CampaignRow) {
    setSelected(c)
    setForm({ nombre: c.nombre, tipo: c.tipo ?? '', descripcion: c.descripcion ?? '', fecha_inicio: c.fecha_inicio ?? '', fecha_fin: c.fecha_fin ?? '', estado: c.estado, color: c.color ?? '' })
    setMode('edit')
  }

  function openView(c: CampaignRow) {
    setSelected(c)
    setMode('view')
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast('Nombre requerido', 'error'); return }
    setSaving(true)
    try {
      const url  = mode === 'create' ? '/api/campaigns' : `/api/campaigns/${selected!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Error', 'error'); return }

      if (mode === 'create') {
        const newRow: CampaignRow = { ...data, numProductos: 0 }
        setCampaigns(prev => [newRow, ...prev])
        setSelected(newRow)
      } else {
        const updated: CampaignRow = { ...selected!, ...data }
        setCampaigns(prev => prev.map(c => c.id === selected!.id ? updated : c))
        setSelected(updated)
      }
      setMode('view')
      toast(mode === 'create' ? 'Campaña creada' : 'Campaña actualizada', 'success')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected || !confirm(`¿Eliminar la campaña "${selected.nombre}"?`)) return
    setDeleting(true)
    const res = await fetch(`/api/campaigns/${selected.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) { toast('Error al eliminar', 'error'); return }
    setCampaigns(prev => prev.filter(c => c.id !== selected.id))
    setSelected(null)
    setMode('view')
    toast('Campaña eliminada', 'success')
  }

  async function handleAddProduct() {
    if (!addCode.trim() || !selected) return
    setAddingProduct(true)
    const res = await fetch(`/api/campaigns/${selected.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos: [addCode.trim().toUpperCase()] }),
    })
    const data = await res.json()
    setAddingProduct(false)
    if (!res.ok) { toast(data.error ?? 'Error', 'error'); return }
    setAddCode('')
    loadProducts(selected.id)
    setCampaigns(prev => prev.map(c => c.id === selected.id ? { ...c, numProductos: c.numProductos + 1 } : c))
    toast('Producto añadido', 'success')
  }

  async function handleRemoveProduct(codigo: string) {
    if (!selected) return
    const res = await fetch(`/api/campaigns/${selected.id}/products?codigo_modelo=${encodeURIComponent(codigo)}`, { method: 'DELETE' })
    if (!res.ok) { toast('Error al quitar producto', 'error'); return }
    setProducts(prev => prev.filter(p => p.codigo_modelo !== codigo))
    setCampaigns(prev => prev.map(c => c.id === selected.id ? { ...c, numProductos: Math.max(0, c.numProductos - 1) } : c))
  }

  const F = (k: keyof FormState) => (
    <input
      value={form[k]}
      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
      className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
      style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
    />
  )

  return (
    <div className="flex h-full">
      {/* Main */}
      <div className="flex-1 p-6 max-w-[1200px] space-y-5 overflow-auto">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#0099f2' }}>Operativo</p>
            <h1 className="text-2xl font-bold text-tq-snorkel">Campañas</h1>
            <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>{campaigns.length} campañas</p>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#00557f' }}
          >
            + Nueva campaña
          </button>
        </div>

        {campaigns.length === 0 && mode !== 'create' ? (
          <div className="text-center py-20" style={{ color: '#b2b2b2' }}>
            <p className="text-4xl mb-3">◈</p>
            <p className="text-sm font-medium">Sin campañas todavía</p>
            <p className="text-xs mt-1">Crea la primera para organizar productos por iniciativas comerciales.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                  {['Campaña', 'Tipo', 'Estado', 'Inicio', 'Fin', 'Productos', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[rgba(0,85,127,0.02)] cursor-pointer transition-colors"
                    style={{
                      borderBottom: i < campaigns.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                      background: selected?.id === c.id ? 'rgba(0,153,242,0.03)' : undefined,
                    }}
                    onClick={() => openView(c)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {c.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />}
                        <span className="font-semibold text-tq-snorkel">{c.nombre}</span>
                      </div>
                      {c.descripcion && <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: '#b2b2b2' }}>{c.descripcion}</p>}
                    </td>
                    <td className="px-3 py-2.5"><TipoBadge tipo={c.tipo} /></td>
                    <td className="px-3 py-2.5"><EstadoBadge estado={c.estado} /></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#b2b2b2' }}>{fmtDate(c.fecha_inicio)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#b2b2b2' }}>{fmtDate(c.fecha_fin)}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold text-tq-snorkel">{c.numProductos}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        className="text-xs px-2 py-1 rounded hover:bg-[rgba(0,85,127,0.08)] transition-colors"
                        style={{ color: '#0099f2' }}
                        onClick={e => { e.stopPropagation(); openEdit(c) }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sidebar */}
      {(selected || mode === 'create') && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setSelected(null); setMode('view') }} />
          <aside
            className="fixed right-0 top-0 h-full w-[420px] bg-white z-30 flex flex-col overflow-y-auto"
            style={{ boxShadow: '-4px 0 24px rgba(0,32,60,0.12)', borderLeft: '1px solid rgba(0,85,127,0.1)' }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
              <div className="flex items-center gap-2">
                {(mode === 'view' && selected?.color) && (
                  <span className="w-3 h-3 rounded-full" style={{ background: selected.color }} />
                )}
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
                    {mode === 'create' ? 'Nueva campaña' : mode === 'edit' ? 'Editar campaña' : 'Campaña'}
                  </p>
                  <h2 className="text-base font-bold text-tq-snorkel">
                    {mode === 'create' ? 'Sin título' : selected?.nombre}
                  </h2>
                </div>
              </div>
              <button onClick={() => { setSelected(null); setMode('view') }} className="text-lg opacity-40 hover:opacity-70">✕</button>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* ── FORM (create / edit) ── */}
              {(mode === 'create' || mode === 'edit') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Nombre *</label>
                    <input
                      value={form.nombre}
                      onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: San Valentín 2026"
                      className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                      style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Tipo</label>
                      <select
                        value={form.tipo}
                        onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
                        style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                      >
                        <option value="">—</option>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Estado</label>
                      <select
                        value={form.estado}
                        onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
                        style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                      >
                        {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Inicio</label>
                      {F('fecha_inicio')}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Fin</label>
                      {F('fecha_fin')}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Descripción</label>
                    <textarea
                      value={form.descripcion}
                      onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none resize-none"
                      style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORES.map(c => (
                        <button
                          key={c}
                          onClick={() => setForm(p => ({ ...p, color: p.color === c ? '' : c }))}
                          className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                          style={{ background: c, borderColor: form.color === c ? '#00557f' : 'transparent' }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ background: '#00557f' }}
                    >
                      {saving ? 'Guardando…' : mode === 'create' ? 'Crear campaña' : 'Guardar cambios'}
                    </button>
                    <button
                      onClick={() => { setMode(selected ? 'view' : 'view'); if (!selected) { setSelected(null) } else { setMode('view') } }}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
                    >
                      Cancelar
                    </button>
                  </div>

                  {mode === 'edit' && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}
                    >
                      {deleting ? 'Eliminando…' : 'Eliminar campaña'}
                    </button>
                  )}
                </div>
              )}

              {/* ── VIEW ── */}
              {mode === 'view' && selected && (
                <>
                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Estado',    value: <EstadoBadge estado={selected.estado} /> },
                      { label: 'Tipo',      value: selected.tipo ? <TipoBadge tipo={selected.tipo} /> : '—' },
                      { label: 'Inicio',    value: fmtDate(selected.fecha_inicio) },
                      { label: 'Fin',       value: fmtDate(selected.fecha_fin) },
                      { label: 'Productos', value: selected.numProductos },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,85,127,0.04)' }}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#b2b2b2' }}>{label}</div>
                        <div className="text-sm font-bold text-tq-snorkel">{value}</div>
                      </div>
                    ))}
                  </div>

                  {selected.descripcion && (
                    <p className="text-sm leading-relaxed" style={{ color: '#00557f' }}>{selected.descripcion}</p>
                  )}

                  {/* Products */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Productos en campaña</p>

                    {/* Add product */}
                    <div className="flex gap-2 mb-3">
                      <input
                        value={addCode}
                        onChange={e => setAddCode(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                        placeholder="Código modelo (ej: 002AA)"
                        className="flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none"
                        style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                      />
                      <button
                        onClick={handleAddProduct}
                        disabled={addingProduct || !addCode.trim()}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                        style={{ background: '#00557f' }}
                      >
                        {addingProduct ? '…' : '+'}
                      </button>
                    </div>

                    {loadingProducts ? (
                      <p className="text-xs text-center py-4" style={{ color: '#b2b2b2' }}>Cargando…</p>
                    ) : products.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#b2b2b2' }}>Sin productos. Añade el primer modelo.</p>
                    ) : (
                      <div className="space-y-1">
                        {products.map(p => (
                          <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[rgba(0,85,127,0.04)] group">
                            <Link href={`/products/${p.codigo_modelo}`} className="flex-1 min-w-0">
                              <span className="font-mono text-xs font-bold text-tq-sky">{p.codigo_modelo}</span>
                              {p.products?.description && (
                                <span className="ml-2 text-xs line-clamp-1" style={{ color: '#b2b2b2' }}>{p.products.description}</span>
                              )}
                            </Link>
                            {p.products?.abc_ventas && (
                              <span className="text-[10px] font-bold" style={{ color: p.products.abc_ventas === 'A' ? '#3A9E6A' : p.products.abc_ventas === 'B' ? '#0099f2' : '#C8842A' }}>
                                {p.products.abc_ventas}
                              </span>
                            )}
                            <button
                              onClick={() => handleRemoveProduct(p.codigo_modelo)}
                              className="opacity-0 group-hover:opacity-100 text-xs transition-opacity ml-1"
                              style={{ color: '#C0392B' }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openEdit(selected)}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
                  >
                    Editar campaña
                  </button>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
