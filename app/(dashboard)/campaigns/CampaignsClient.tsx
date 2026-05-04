'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui'
import { ProductSelectorModal } from './ProductSelectorModal'
import type { CampaignRow } from './page'

// ── constants ─────────────────────────────────────────────────────

const TIPOS   = ['GTM', 'Propia', 'Estacional', 'Liquidacion'] as const
const ESTADOS = ['borrador', 'activa', 'finalizada'] as const
const COLORES = ['#C8842A', '#3A9E6A', '#0099f2', '#9B59B6', '#E74C3C', '#1ABC9C', '#E67E22', '#00557f']
const CANALES_OPT = ['online', 'tiendas'] as const

// ── helpers ───────────────────────────────────────────────────────

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

function CanalBadge({ canal }: { canal: string }) {
  const isOnline = canal === 'online'
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
      background: isOnline ? 'rgba(0,153,242,0.1)' : 'rgba(58,158,106,0.1)',
      color:      isOnline ? '#0070b8' : '#2d7a54',
    }}>
      {isOnline ? '🌐 Online' : '🏪 Tiendas'}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>
      {children}
    </label>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-[rgba(0,85,127,0.3)]'
const inputSty = { borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }

// ── types ─────────────────────────────────────────────────────────

type ProductInCampaign = {
  id: string
  codigo_modelo: string
  added_by: string | null
  added_at: string
  products: { codigo_modelo: string; description: string | null; familia: string | null; metal: string | null; abc_ventas: string | null; ingresos_12m: number | null } | null
}

type FormState = {
  nombre:      string
  tipo:        string
  descripcion: string
  narrativa:   string
  objetivos:   string
  canales:     string
  soportes:    string
  fecha_inicio: string
  fecha_fin:   string
  estado:      string
  color:       string
}

const EMPTY_FORM: FormState = {
  nombre: '', tipo: '', descripcion: '', narrativa: '',
  objetivos: '', canales: '', soportes: '',
  fecha_inicio: '', fecha_fin: '', estado: 'borrador', color: '',
}

// ── main component ────────────────────────────────────────────────

export function CampaignsClient({ campaigns: initial }: { campaigns: CampaignRow[] }) {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initial)
  const [selected, setSelected]   = useState<CampaignRow | null>(null)
  const [mode, setMode]           = useState<'view' | 'create' | 'edit'>('view')
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)

  // Products in campaign
  const [products, setProducts]           = useState<ProductInCampaign[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [removingCode, setRemovingCode]   = useState<string | null>(null)
  const [showSelector, setShowSelector]   = useState(false)

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

  function toggleCanal(val: string) {
    const current = form.canales ? form.canales.split(',').filter(Boolean) : []
    const updated = current.includes(val) ? current.filter(c => c !== val) : [...current, val]
    setForm(p => ({ ...p, canales: updated.join(',') }))
  }

  function openCreate() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setMode('create')
  }

  function openEdit(c: CampaignRow) {
    setSelected(c)
    setForm({
      nombre:      c.nombre,
      tipo:        c.tipo        ?? '',
      descripcion: c.descripcion ?? '',
      narrativa:   c.narrativa   ?? '',
      objetivos:   c.objetivos   ?? '',
      canales:     c.canales     ?? '',
      soportes:    c.soportes    ?? '',
      fecha_inicio: c.fecha_inicio ?? '',
      fecha_fin:   c.fecha_fin   ?? '',
      estado:      c.estado,
      color:       c.color       ?? '',
    })
    setMode('edit')
  }

  function openView(c: CampaignRow) {
    setSelected(c)
    setMode('view')
  }

  function closeModal() {
    if (selected) setMode('view')
    else { setMode('view'); setSelected(null) }
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast('Nombre requerido', 'error'); return }
    setSaving(true)
    try {
      const url    = mode === 'create' ? '/api/campaigns' : `/api/campaigns/${selected!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data   = await res.json()
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

  async function handleBatchAdd(codigos: string[]) {
    if (!selected || codigos.length === 0) return
    const res = await fetch(`/api/campaigns/${selected.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error ?? 'Error', 'error'); return }
    setShowSelector(false)
    loadProducts(selected.id)
    setCampaigns(prev => prev.map(c =>
      c.id === selected.id ? { ...c, numProductos: c.numProductos + codigos.length } : c
    ))
    toast(codigos.length === 1 ? 'Producto añadido' : `${codigos.length} productos añadidos`, 'success')
  }

  async function handleRemoveProduct(codigo: string) {
    if (!selected) return
    setRemovingCode(codigo)
    const res = await fetch(`/api/campaigns/${selected.id}/products?codigo_modelo=${encodeURIComponent(codigo)}`, { method: 'DELETE' })
    setRemovingCode(null)
    if (!res.ok) { toast('Error al quitar producto', 'error'); return }
    setProducts(prev => prev.filter(p => p.codigo_modelo !== codigo))
    setCampaigns(prev => prev.map(c => c.id === selected.id ? { ...c, numProductos: Math.max(0, c.numProductos - 1) } : c))
  }

  const addedCodes = new Set(products.map(p => p.codigo_modelo))

  // ── Form modal (create / edit) ────────────────────────────────────
  const FormModal = (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={closeModal} />
      <div
        className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] z-10 flex flex-col"
        style={{ boxShadow: '0 24px 80px rgba(0,32,60,0.22)' }}
      >
        <div className="px-7 pt-6 pb-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: '#b2b2b2' }}>
              {mode === 'create' ? 'Nueva campaña' : 'Editar campaña'}
            </p>
            <h2 className="text-lg font-bold" style={{ color: '#00557f' }}>
              {mode === 'create' ? 'Crear campaña' : selected?.nombre}
            </h2>
          </div>
          <button onClick={closeModal} className="text-xl leading-none opacity-30 hover:opacity-60 transition-opacity ml-4">✕</button>
        </div>

        <div className="p-7 space-y-5 overflow-y-auto flex-1">
          <div>
            <Label>Nombre *</Label>
            <input
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: San Valentín 2026"
              className={inputCls}
              style={inputSty}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Tipo</Label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className={`${inputCls} bg-white`} style={inputSty}>
                <option value="">—</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Estado</Label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className={`${inputCls} bg-white`} style={inputSty}>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap pt-1.5">
                {COLORES.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: p.color === c ? '' : c }))}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: form.color === c ? '#00557f' : 'transparent' }} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Inicio</Label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className={inputCls} style={inputSty} />
            </div>
            <div>
              <Label>Fin</Label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} className={inputCls} style={inputSty} />
            </div>
          </div>

          <div>
            <Label>Descripción interna</Label>
            <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} className={`${inputCls} resize-none`} style={inputSty} />
          </div>

          <div>
            <Label>Objetivos</Label>
            <textarea value={form.objetivos} onChange={e => setForm(p => ({ ...p, objetivos: e.target.value }))} rows={2}
              placeholder="Ej: Aumentar las ventas de anillos de oro un 20 %" className={`${inputCls} resize-none`} style={inputSty} />
          </div>

          <div>
            <Label>Canales</Label>
            <div className="flex gap-3 mt-1">
              {CANALES_OPT.map(c => {
                const active = form.canales.split(',').includes(c)
                return (
                  <button key={c} type="button" onClick={() => toggleCanal(c)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all"
                    style={{ borderColor: active ? '#00557f' : 'rgba(0,85,127,0.15)', background: active ? 'rgba(0,85,127,0.07)' : 'transparent', color: active ? '#00557f' : '#b2b2b2' }}>
                    <span>{c === 'online' ? '🌐' : '🏪'}</span>
                    <span className="capitalize">{c}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Soportes</Label>
            <textarea value={form.soportes} onChange={e => setForm(p => ({ ...p, soportes: e.target.value }))} rows={2}
              placeholder="Ej: Escaparate principal, rebajas, newsletter, stories…" className={`${inputCls} resize-none`} style={inputSty} />
          </div>

          <div>
            <Label>Narrativa / Brief de campaña</Label>
            <p className="text-[10px] mb-1.5" style={{ color: '#b2b2b2' }}>Aparece en la cabecera del export de marketing.</p>
            <textarea value={form.narrativa} onChange={e => setForm(p => ({ ...p, narrativa: e.target.value }))} rows={4}
              placeholder="Concepto, target, mensaje clave…" className={`${inputCls} resize-none`} style={inputSty} />
          </div>
        </div>

        <div className="px-7 pb-7 pt-4 flex gap-3 border-t shrink-0" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#00557f' }}>
            {saving ? 'Guardando…' : mode === 'create' ? 'Crear campaña' : 'Guardar cambios'}
          </button>
          <button onClick={closeModal} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors" style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}>
            Cancelar
          </button>
        </div>
        {mode === 'edit' && (
          <div className="px-7 pb-5 shrink-0">
            <button onClick={handleDelete} disabled={deleting}
              className="w-full py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}>
              {deleting ? 'Eliminando…' : 'Eliminar campaña'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── View modal (two-column) ───────────────────────────────────────
  const ViewModal = selected && mode === 'view' && (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setSelected(null)} />
      <div
        className="relative bg-white rounded-2xl w-full z-10 flex flex-col"
        style={{ maxWidth: 980, maxHeight: '90vh', boxShadow: '0 24px 80px rgba(0,32,60,0.22)' }}
      >
        {/* Header */}
        <div className="px-7 pt-5 pb-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {selected.color && <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: selected.color }} />}
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Campaña</p>
              <h2 className="text-lg font-bold truncate" style={{ color: '#00557f' }}>{selected.nombre}</h2>
            </div>
            <div className="flex gap-2 ml-2">
              {selected.tipo && <TipoBadge tipo={selected.tipo} />}
              <EstadoBadge estado={selected.estado} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => openEdit(selected)} className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors" style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}>
              Editar
            </button>
            <button onClick={() => setSelected(null)} className="text-xl leading-none opacity-30 hover:opacity-60 transition-opacity ml-1">✕</button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">

          {/* Left — campaign info */}
          <div className="w-[420px] shrink-0 overflow-y-auto p-6 space-y-4 border-r" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
            <div className="grid grid-cols-2 gap-2">
              {[{ label: 'Inicio', value: fmtDate(selected.fecha_inicio) }, { label: 'Fin', value: fmtDate(selected.fecha_fin) }].map(({ label, value }) => (
                <div key={label} className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,85,127,0.04)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#b2b2b2' }}>{label}</div>
                  <div className="text-xs font-semibold" style={{ color: '#00557f' }}>{value}</div>
                </div>
              ))}
            </div>

            {selected.canales && (
              <div className="flex gap-2 flex-wrap">
                {selected.canales.split(',').filter(Boolean).map(c => <CanalBadge key={c} canal={c} />)}
              </div>
            )}
            {selected.descripcion && <p className="text-xs leading-relaxed" style={{ color: '#777' }}>{selected.descripcion}</p>}
            {selected.objetivos && (
              <div className="rounded-lg px-3 py-3" style={{ background: 'rgba(200,132,42,0.06)', borderLeft: '3px solid rgba(200,132,42,0.3)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#C8842A' }}>Objetivos</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#6b4a18' }}>{selected.objetivos}</p>
              </div>
            )}
            {selected.soportes && (
              <div className="rounded-lg px-3 py-3" style={{ background: 'rgba(0,85,127,0.04)', borderLeft: '3px solid rgba(0,85,127,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Soportes</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#00557f' }}>{selected.soportes}</p>
              </div>
            )}
            {selected.narrativa && (
              <div className="rounded-lg px-3 py-3" style={{ background: 'rgba(0,85,127,0.04)', borderLeft: '3px solid rgba(0,85,127,0.2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Narrativa de campaña</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#00557f' }}>{selected.narrativa}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Exportar para marketing</p>
              <div className="flex gap-2">
                <a href={`/api/campaigns/${selected.id}/export/excel`} download
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ background: 'rgba(58,158,106,0.1)', color: '#2d7a54', border: '1px solid rgba(58,158,106,0.25)' }}>
                  ↓ Excel
                </a>
                <a href={`/api/campaigns/${selected.id}/export/pdf`} download
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ background: 'rgba(200,132,42,0.1)', color: '#a06818', border: '1px solid rgba(200,132,42,0.25)' }}>
                  ↓ PDF
                </a>
              </div>
            </div>
          </div>

          {/* Right — products */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="px-6 pt-5 pb-3 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#b2b2b2' }}>
                  Productos en campaña <span style={{ color: '#00557f' }}>({selected.numProductos})</span>
                </p>
                <button
                  onClick={() => setShowSelector(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#00557f' }}
                >
                  ＋ Añadir productos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loadingProducts ? (
                <p className="text-xs text-center py-8" style={{ color: '#b2b2b2' }}>Cargando…</p>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2">◈</p>
                  <p className="text-sm font-medium" style={{ color: '#b2b2b2' }}>Sin productos</p>
                  <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>Usa el selector para buscar y añadir modelos en lote.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[rgba(0,85,127,0.04)] group transition-colors">
                      <Link href={`/products/${p.codigo_modelo}`} className="flex-1 min-w-0">
                        <span className="font-mono text-xs font-bold" style={{ color: '#0099f2' }}>{p.codigo_modelo}</span>
                        {p.products?.description && <span className="ml-2 text-xs" style={{ color: '#777' }}>{p.products.description}</span>}
                      </Link>
                      {p.products?.familia && <span className="text-[10px] shrink-0" style={{ color: '#b2b2b2' }}>{p.products.familia}</span>}
                      {p.products?.abc_ventas && (
                        <span className="text-[10px] font-bold shrink-0 w-4 text-center" style={{
                          color: p.products.abc_ventas === 'A' ? '#3A9E6A' : p.products.abc_ventas === 'B' ? '#0099f2' : '#C8842A'
                        }}>
                          {p.products.abc_ventas}
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveProduct(p.codigo_modelo)}
                        disabled={removingCode === p.codigo_modelo}
                        className="opacity-0 group-hover:opacity-100 text-xs transition-opacity disabled:opacity-30"
                        style={{ color: '#C0392B' }}
                      >
                        {removingCode === p.codigo_modelo ? '…' : '✕'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── render ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 max-w-[1200px] space-y-5 overflow-auto">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#0099f2' }}>Operativo</p>
            <h1 className="text-2xl font-bold" style={{ color: '#00557f' }}>Campañas</h1>
            <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>{campaigns.length} campañas</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#00557f' }}>
            + Nueva campaña
          </button>
        </div>

        {campaigns.length === 0 ? (
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
                  {['Campaña', 'Canales', 'Estado', 'Inicio', 'Fin', 'Prods.', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={c.id} className="hover:bg-[rgba(0,85,127,0.02)] cursor-pointer transition-colors"
                    style={{ borderBottom: i < campaigns.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none', background: selected?.id === c.id && mode === 'view' ? 'rgba(0,153,242,0.03)' : undefined }}
                    onClick={() => openView(c)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {c.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />}
                        <span className="font-semibold" style={{ color: '#00557f' }}>{c.nombre}</span>
                        {c.tipo && <TipoBadge tipo={c.tipo} />}
                      </div>
                      {c.descripcion && <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: '#b2b2b2' }}>{c.descripcion}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {(c.canales ?? '').split(',').filter(Boolean).map(ch => <CanalBadge key={ch} canal={ch} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><EstadoBadge estado={c.estado} /></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#b2b2b2' }}>{fmtDate(c.fecha_inicio)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#b2b2b2' }}>{fmtDate(c.fecha_fin)}</td>
                    <td className="px-3 py-2.5"><span className="text-xs font-bold" style={{ color: '#00557f' }}>{c.numProductos}</span></td>
                    <td className="px-3 py-2.5">
                      <button className="text-xs px-2 py-1 rounded hover:bg-[rgba(0,85,127,0.08)] transition-colors" style={{ color: '#0099f2' }}
                        onClick={e => { e.stopPropagation(); openEdit(c) }}>
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

      {(mode === 'create' || mode === 'edit') && FormModal}
      {ViewModal}

      {showSelector && selected && (
        <ProductSelectorModal
          alreadyAdded={addedCodes}
          onAdd={handleBatchAdd}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  )
}
