'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/ui'
import type { BoletinCategoria } from '@/types'
import type { BoletinItem } from '@/app/api/boletin/route'

// ── Category config ───────────────────────────────────────────
const CATS: { key: BoletinCategoria; label: string; color: string; bg: string; icon: string; desc: string }[] = [
  { key: 'campaña', label: 'Campaña',   color: '#00557f', bg: '#e8f4fb', icon: '◈', desc: 'Productos incluidos en campañas activas' },
  { key: 'nuevo',   label: 'Nuevo',     color: '#3A9E6A', bg: '#e8f5f0', icon: '★', desc: 'Incorporados al catálogo en los últimos 2 meses' },
  { key: 'outlet',  label: 'Outlet',    color: '#C8842A', bg: '#fdf3e4', icon: '▼', desc: 'Con descuento aplicado ≥ 15%' },
  { key: 'retirar', label: 'A retirar', color: '#C0392B', bg: '#fdf0f0', icon: '⊗', desc: 'Descatalogados o sin ventas en +6 meses' },
]

function fmtEur(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

// ── Override modal ────────────────────────────────────────────
function OverrideModal({
  item,
  onClose,
  onSaved,
}: {
  item: BoletinItem
  onClose: () => void
  onSaved: () => void
}) {
  const [categoria, setCategoria] = useState<BoletinCategoria>(item.categoria)
  const [nota, setNota]           = useState(item.nota_interna ?? '')
  const [expira, setExpira]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/boletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_modelo: item.codigo_modelo,
          categoria,
          nota_interna: nota || null,
          expira_en: expira || null,
          creado_por: 'equipo-tiendas',
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function removeOverride() {
    setSaving(true)
    try {
      await fetch(`/api/boletin?codigo_modelo=${item.codigo_modelo}`, { method: 'DELETE' })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-semibold text-[#1d1d1b]">{item.description ?? item.codigo_modelo}</p>
            <p className="text-xs text-[#b2b2b2] mt-0.5">{item.codigo_modelo}</p>
          </div>
          <button onClick={onClose} className="text-[#b2b2b2] hover:text-[#1d1d1b] text-xl leading-none">×</button>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-widest text-[#00557f] mb-1">
          Categoría
        </label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {CATS.map(c => (
            <button
              key={c.key}
              onClick={() => setCategoria(c.key)}
              className="rounded-lg border-2 p-2 text-sm font-medium transition-all"
              style={{
                borderColor: categoria === c.key ? c.color : 'transparent',
                background:  categoria === c.key ? c.bg : '#f5f5f5',
                color:       categoria === c.key ? c.color : '#666',
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold uppercase tracking-widest text-[#00557f] mb-1">
          Nota interna <span className="font-normal text-[#b2b2b2]">(opcional)</span>
        </label>
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          className="w-full border border-[#e8e3df] rounded-lg p-2 text-sm resize-none mb-3"
          rows={2}
          placeholder="Ej: pendiente de confirmación con proveedor…"
        />

        <label className="block text-xs font-semibold uppercase tracking-widest text-[#00557f] mb-1">
          Expira el <span className="font-normal text-[#b2b2b2]">(opcional)</span>
        </label>
        <input
          type="date"
          value={expira}
          onChange={e => setExpira(e.target.value)}
          className="w-full border border-[#e8e3df] rounded-lg p-2 text-sm mb-4"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-opacity"
            style={{ background: '#00557f', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar override'}
          </button>
          {item.categoria_origen === 'override' && (
            <button
              onClick={removeOverride}
              disabled={saving}
              className="px-3 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────
function ProductCard({
  item,
  catColor,
  onEdit,
}: {
  item: BoletinItem
  catColor: string
  onEdit: (item: BoletinItem) => void
}) {
  return (
    <div className="tq-card flex gap-3 p-3 hover:shadow-md transition-shadow">
      {item.image_url ? (
        <img src={item.image_url} alt={item.description ?? ''} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f4f1ee' }}>
          <span className="text-[#b2b2b2] text-xl">◻</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1d1d1b] truncate">{item.description ?? item.codigo_modelo}</p>
        <p className="text-xs text-[#b2b2b2]">{item.codigo_modelo} · {item.familia ?? '—'} · {item.metal ?? '—'} {item.karat ?? ''}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm font-bold" style={{ color: catColor }}>{fmtEur(item.precio_venta)}</span>
          {item.precio_tachado && (
            <span className="text-xs line-through text-[#b2b2b2]">{fmtEur(item.precio_tachado)}</span>
          )}
          {item.descuento_aplicado && item.descuento_aplicado > 0 && (
            <span className="text-xs font-semibold text-[#C8842A]">-{Math.round(item.descuento_aplicado)}%</span>
          )}
          <span className="text-xs text-[#b2b2b2]">Stock: {item.stock_total}</span>
        </div>
        {item.nota_interna && (
          <p className="text-xs italic text-[#8B5E1A] mt-1 truncate">{item.nota_interna}</p>
        )}
      </div>

      <button
        onClick={() => onEdit(item)}
        className="self-start p-1.5 rounded-lg text-xs text-[#b2b2b2] hover:text-[#00557f] hover:bg-[#e8f4fb] transition-colors"
        title="Editar categoría"
      >
        {item.categoria_origen === 'override' ? (
          <span className="font-bold" style={{ color: catColor }}>⊞</span>
        ) : '✎'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function BoletinPage() {
  const [items, setItems]       = useState<BoletinItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [editing, setEditing]   = useState<BoletinItem | null>(null)
  const [filter, setFilter]     = useState<BoletinCategoria | 'all'>('all')
  const [search, setSearch]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/boletin')
      if (!res.ok) throw new Error('Error al cargar el boletín')
      setItems(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(it => {
    if (filter !== 'all' && it.categoria !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        it.codigo_modelo.toLowerCase().includes(q) ||
        (it.description ?? '').toLowerCase().includes(q) ||
        (it.familia ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const countsByCategory = Object.fromEntries(
    CATS.map(c => [c.key, items.filter(it => it.categoria === c.key).length])
  )

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        eyebrow="Zona Tiendas"
        title="Boletín"
        subtitle="Novedades de campaña, nuevos, outlet y productos a retirar"
        actions={
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#e8e3df] hover:bg-white transition-colors"
          >
            ↻ Actualizar
          </button>
        }
      />

      {/* Category summary cards */}
      <div className="grid grid-cols-4 gap-3 mt-6">
        {CATS.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
            className="rounded-xl p-4 text-left transition-all border-2"
            style={{
              background:  filter === c.key ? c.bg : 'white',
              borderColor: filter === c.key ? c.color : 'transparent',
              boxShadow:   '0 2px 6px rgba(0,32,60,0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg" style={{ color: c.color }}>{c.icon}</span>
              <span className="text-2xl font-bold" style={{ color: c.color }}>{countsByCategory[c.key] ?? 0}</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</p>
            <p className="text-xs text-[#b2b2b2] mt-0.5 leading-tight">{c.desc}</p>
          </button>
        ))}
      </div>

      {/* Search + total */}
      <div className="flex items-center gap-3 mt-6 mb-4">
        <input
          type="text"
          placeholder="Buscar por código, descripción o familia…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white"
        />
        <span className="text-sm text-[#b2b2b2]">
          {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` en ${CATS.find(c => c.key === filter)?.label}`}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#b2b2b2] text-sm">Cargando boletín…</div>
      ) : error ? (
        <div className="rounded-xl p-8 text-center" style={{ background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(139,94,26,0.04)', border: '1px solid rgba(139,94,26,0.12)' }}>
          <p className="text-3xl mb-2">◫</p>
          <p className="text-sm font-semibold text-[#8B5E1A]">No hay productos en esta categoría</p>
          <p className="text-xs text-[#b2b2b2] mt-1">Prueba con otro filtro o activa el sync de datos</p>
        </div>
      ) : filter === 'all' ? (
        // Grouped view
        <div className="space-y-8">
          {CATS.filter(c => (countsByCategory[c.key] ?? 0) > 0).map(c => {
            const catItems = filtered.filter(it => it.categoria === c.key)
            if (!catItems.length) return null
            return (
              <section key={c.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base" style={{ color: c.color }}>{c.icon}</span>
                  <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: c.color }}>{c.label}</h2>
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: c.bg, color: c.color }}>
                    {catItems.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {catItems.map(it => (
                    <ProductCard key={it.codigo_modelo} item={it} catColor={c.color} onEdit={setEditing} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        // Single category grid
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {filtered.map(it => {
            const c = CATS.find(cc => cc.key === it.categoria)!
            return <ProductCard key={it.codigo_modelo} item={it} catColor={c.color} onEdit={setEditing} />
          })}
        </div>
      )}

      {/* Override modal */}
      {editing && (
        <OverrideModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
