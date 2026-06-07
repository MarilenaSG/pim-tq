'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LanzamientoTipo } from '@/types'
import { fmtEur, fmtPct, fmtDate } from '@/lib/lanzamiento'

// ── Types (subset for listing) ────────────────────────────────

type Borrador = {
  id: string; tipo: LanzamientoTipo | null; nombre: string | null
  familia: string | null; metal: string | null; precio_venta: number | null
  paso_actual: number; updated_at: string
}

type Confirmado = {
  id: string; tipo: LanzamientoTipo | null; nombre: string | null
  familia: string | null; metal: string | null; precio_venta: number | null
  n_tiendas: number | null
  output_unidades_total: number | null; output_presupuesto_compra: number | null
  output_margen_proyectado: number | null; output_breakeven_semanas: number | null
  fecha_lanzamiento: string | null; updated_at: string
}

// ── Tipo badge ────────────────────────────────────────────────

const TIPO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  sku:   { label: 'SKU',   bg: 'rgba(0,153,242,0.1)',  color: '#006da3' },
  marca: { label: 'Marca', bg: 'rgba(0,85,127,0.1)',   color: '#00557f' },
  drop:  { label: 'Drop',  bg: 'rgba(200,132,42,0.1)', color: '#a06818' },
}

function TipoBadge({ tipo }: { tipo: LanzamientoTipo | null }) {
  if (!tipo) return null
  const cfg = TIPO_CFG[tipo] ?? { label: tipo, bg: 'rgba(0,85,127,0.06)', color: '#8fa8b8' }
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

// ── Borrador card ─────────────────────────────────────────────

function BorradorCard({ b, onDelete }: { b: Borrador; onDelete: (id: string) => void }) {
  const router    = useRouter()
  const [del, setDel] = useState(false)

  async function eliminar() {
    setDel(true)
    await fetch(`/api/lanzamiento/${b.id}`, { method: 'DELETE' })
    onDelete(b.id)
  }

  return (
    <div
      className="bg-white rounded-xl p-4 flex items-start gap-4"
      style={{ border: '1px solid rgba(0,85,127,0.09)', boxShadow: 'var(--tq-shadow-xs)' }}
    >
      {/* Step progress pill */}
      <div
        className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center"
        style={{ background: 'rgba(0,85,127,0.05)' }}
      >
        <span className="text-[18px] font-bold" style={{ color: '#00557f', lineHeight: 1 }}>
          {b.paso_actual}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
          /7
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <TipoBadge tipo={b.tipo} />
        </div>
        <p className="text-[14px] font-semibold leading-tight truncate" style={{ color: '#00264d' }}>
          {b.nombre || <span style={{ color: '#b2b2b2' }}>Sin nombre</span>}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: '#8fa8b8' }}>
          {[b.familia, b.metal, b.precio_venta ? fmtEur(b.precio_venta) : null].filter(Boolean).join(' · ')}
        </p>
        <p className="text-[10px] mt-1" style={{ color: '#c0cfd8' }}>
          Actualizado {fmtDate(b.updated_at)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          onClick={() => router.push(`/lanzamiento/${b.id}/paso/${b.paso_actual}`)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-85"
          style={{ background: '#00557f' }}
        >
          Continuar →
        </button>
        <button
          onClick={eliminar}
          disabled={del}
          className="px-3 py-1 rounded-lg text-[11px] font-medium border transition-colors hover:bg-red-50 disabled:opacity-40"
          style={{ borderColor: 'rgba(192,57,43,0.25)', color: '#C0392B' }}
        >
          {del ? '…' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}

// ── Nuevo lanzamiento button ──────────────────────────────────

function NuevoButton() {
  const router    = useRouter()
  const [loading, setLoading] = useState(false)

  async function crear() {
    setLoading(true)
    try {
      const res  = await fetch('/api/lanzamiento', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      router.push(`/lanzamiento/${data.id}/paso/1`)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={crear}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: '#00557f' }}
    >
      {loading ? (
        <>
          <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          Creando…
        </>
      ) : '+ Nuevo lanzamiento'}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────

export function LanzamientoListado({
  borradores: initial,
  confirmados,
}: {
  borradores:  Borrador[]
  confirmados: Confirmado[]
}) {
  const router   = useRouter()
  const [borradores, setBorradores] = useState(initial)

  function onDelete(id: string) {
    setBorradores(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Borradores */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8', fontFamily: 'inherit' }}>
              Borradores en curso
            </h2>
            {borradores.length === 0 && (
              <p className="text-[12px] mt-0.5" style={{ color: '#c0cfd8' }}>
                Sin borradores — crea tu primer lanzamiento
              </p>
            )}
          </div>
          <NuevoButton />
        </div>

        {borradores.length > 0 && (
          <div className="space-y-2">
            {borradores.map(b => (
              <BorradorCard key={b.id} b={b} onDelete={onDelete} />
            ))}
          </div>
        )}

        {borradores.length === 0 && (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: 'rgba(0,85,127,0.03)', border: '1px dashed rgba(0,85,127,0.15)' }}
          >
            <p className="text-3xl mb-2 opacity-30">◈</p>
            <p className="text-[13px] font-medium" style={{ color: '#8fa8b8' }}>
              Ningún borrador activo
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#c0cfd8' }}>
              Usa el botón "+ Nuevo lanzamiento" para empezar
            </p>
          </div>
        )}
      </section>

      {/* Confirmados */}
      {confirmados.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8', fontFamily: 'inherit' }}>
            Confirmados (últimos 6 meses)
          </h2>
          <div className="tq-table-wrap">
            <table className="tq-table">
              <thead>
                <tr>
                  <th>Lanzamiento</th>
                  <th>Familia · Metal</th>
                  <th className="right">PVP</th>
                  <th className="right">Tiendas</th>
                  <th className="right">Uds. totales</th>
                  <th className="right">Presupuesto</th>
                  <th className="right">Margen proy.</th>
                  <th className="right">Break-even</th>
                  <th>F. lanzamiento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {confirmados.map(c => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/lanzamiento/${c.id}/paso/7`)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <TipoBadge tipo={c.tipo} />
                        <span className="font-medium text-[13px]" style={{ color: '#00264d' }}>
                          {c.nombre ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: '#8fa8b8', fontSize: 12 }}>
                      {[c.familia, c.metal].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="right font-mono" style={{ color: '#00264d', fontWeight: 500 }}>
                      {c.precio_venta ? fmtEur(c.precio_venta) : '—'}
                    </td>
                    <td className="right" style={{ color: '#00264d' }}>
                      {c.n_tiendas ?? '—'}
                    </td>
                    <td className="right font-mono" style={{ color: '#00264d', fontWeight: 500 }}>
                      {c.output_unidades_total?.toLocaleString('es-ES') ?? '—'}
                    </td>
                    <td className="right font-mono" style={{ color: '#00264d', fontWeight: 500 }}>
                      {c.output_presupuesto_compra ? fmtEur(c.output_presupuesto_compra) : '—'}
                    </td>
                    <td className="right" style={{ color: c.output_margen_proyectado && c.output_margen_proyectado >= 40 ? '#3A9E6A' : '#C8842A', fontWeight: 600 }}>
                      {c.output_margen_proyectado ? fmtPct(c.output_margen_proyectado) : '—'}
                    </td>
                    <td className="right" style={{ color: '#00264d' }}>
                      {c.output_breakeven_semanas ? `Sem. ${Math.round(c.output_breakeven_semanas)}` : '—'}
                    </td>
                    <td style={{ color: '#8fa8b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDate(c.fecha_lanzamiento)}
                    </td>
                    <td>
                      <span className="text-[10px]" style={{ color: '#0099f2' }}>Ver →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
