'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { SugerenciaIA }  from './SugerenciaIA'
import { CLUSTERS, nTiendasDesdeClusters, fmtEur } from '@/lib/lanzamiento'
import type { Lanzamiento, Tienda } from '@/types'

// ── Validación de dist. personalizada ────────────────────────
// Si los borradores anteriores tienen claves fake (ej: "A-1"), se resetean.
function validarCustomDist(
  saved: Record<string, number> | null,
  tiendaIds: Set<string>,
): Record<string, number> {
  if (!saved) return {}
  const allValid = Object.keys(saved).every(k => tiendaIds.has(k))
  return allValid ? saved : {}
}

// ── Chip de advertencia / info ────────────────────────────────

function AlertaVolumen({
  totalUds,
  media,
}: {
  totalUds: number
  media: number | null
}) {
  if (media == null || totalUds === 0) return null

  if (totalUds > media * 3) {
    return (
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-snug"
        style={{ background: 'rgba(200,132,42,0.08)', border: '1px solid rgba(200,132,42,0.2)', color: '#a06818' }}
      >
        <span className="shrink-0 mt-0.5">⚠️</span>
        <span>
          Esta cantidad supera <strong>3×</strong> la media mensual de productos similares
          ({media} uds/mes). Considera un pedido más conservador para el lanzamiento.
        </span>
      </div>
    )
  }

  if (totalUds < media * 0.5) {
    return (
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-snug"
        style={{ background: 'rgba(0,153,242,0.06)', border: '1px solid rgba(0,153,242,0.15)', color: '#006da3' }}
      >
        <span className="shrink-0 mt-0.5">ℹ️</span>
        <span>
          La cantidad es menor de la media habitual ({media} uds/mes).
          Podrías quedarte sin stock antes de que la demanda se consolide.
        </span>
      </div>
    )
  }

  return null
}

// ── Componente principal ──────────────────────────────────────

export function PasoDistribucion({
  lanzamiento,
  tiendas,
}: {
  lanzamiento: Lanzamiento
  tiendas:     Tienda[]
}) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  // Índice de IDs reales para validar distribuciones guardadas
  const tiendaIds = new Set(tiendas.map(t => t.id))

  // ── Estado ───────────────────────────────────────────────────
  const [selectedClusters,    setSelectedClusters]    = useState<string[]>(
    (lanzamiento.clusters_objetivo as string[] | null) ?? ['A', 'B', 'C'],
  )
  const [udsPerTienda,        setUdsPerTienda]        = useState<number>(
    lanzamiento.unidades_por_tienda ?? 2,
  )
  const [distribPersonalizada, setDistribPersonalizada] = useState(
    !!lanzamiento.distribucion_personalizada,
  )
  const [customDist, setCustomDist] = useState<Record<string, number>>(
    validarCustomDist(
      lanzamiento.distribucion_personalizada as Record<string, number> | null,
      tiendaIds,
    ),
  )
  const [mediaVentas, setMediaVentas] = useState<number | null>(null)

  // ── Tiendas activas filtradas por cluster ────────────────────
  const tiendasVisibles = tiendas.filter(
    t => t.cluster != null && selectedClusters.includes(t.cluster),
  )
  const totalTiendas    = nTiendasDesdeClusters(selectedClusters, tiendas)

  const totalUnidades = distribPersonalizada
    ? Object.values(customDist).reduce((s, v) => s + (v || 0), 0)
    : totalTiendas * udsPerTienda

  const presupuestoCompra = lanzamiento.coste
    ? Math.round(totalUnidades * lanzamiento.coste)
    : null

  // ── Fetch velocidad de ventas de referencia ──────────────────
  useEffect(() => {
    if (!lanzamiento.familia || !lanzamiento.precio_venta) return
    fetch(
      `/api/lanzamiento/velocidad-ventas?familia=${encodeURIComponent(lanzamiento.familia)}&pvp=${lanzamiento.precio_venta}`,
    )
      .then(r => r.json())
      .then((d: { media: number | null }) => setMediaVentas(d.media))
      .catch(() => null)
  }, [lanzamiento.familia, lanzamiento.precio_venta])

  // ── Handlers ─────────────────────────────────────────────────

  function toggleCluster(id: string) {
    const next = selectedClusters.includes(id)
      ? selectedClusters.filter(c => c !== id)
      : [...selectedClusters, id]
    setSelectedClusters(next)
    const nTiendas = nTiendasDesdeClusters(next, tiendas)
    save({ clusters_objetivo: next, n_tiendas: nTiendas })
  }

  function handleUdsPerTienda(v: number) {
    const safe = Math.max(1, Math.round(v))
    setUdsPerTienda(safe)
    save({ unidades_por_tienda: safe })
  }

  function handleTogglePersonalizada(on: boolean) {
    setDistribPersonalizada(on)
    if (on) {
      const initDist: Record<string, number> = {}
      tiendasVisibles.forEach(t => { initDist[t.id] = udsPerTienda })
      setCustomDist(initDist)
      save({ distribucion_personalizada: initDist })
    } else {
      setCustomDist({})
      save({ distribucion_personalizada: null })
    }
  }

  function handleCustomUds(tiendaId: string, v: number) {
    const safe = Math.max(0, Math.round(v))
    const next = { ...customDist, [tiendaId]: safe }
    setCustomDist(next)
    save({ distribucion_personalizada: next })
  }

  function distribuirIgual() {
    const dist: Record<string, number> = {}
    tiendasVisibles.forEach(t => { dist[t.id] = udsPerTienda })
    setCustomDist(dist)
    save({ distribucion_personalizada: dist })
  }

  async function handleNext() {
    await flush()
    await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        paso_actual:               Math.max(lanzamiento.paso_actual, 4),
        n_tiendas:                 totalTiendas,
        output_presupuesto_compra: presupuestoCompra,
      }),
    })
    router.push(`/lanzamiento/${lanzamiento.id}/paso/4`)
  }

  return (
    <WizardLayout
      step={3}
      lanzamientoId={lanzamiento.id}
      title="Distribución por tiendas"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-3"
        concepto="Selecciona qué clusters van a recibir este lanzamiento. El Cluster A son las 8 flagship (mayor volumen y visibilidad), el B son las 8 estándar, y el C son las 3 pequeñas con perfiles de rotación distintos. Empieza conservador: es más fácil ampliar una reposición que gestionar el exceso."
        ejemplo="Un anillo de oro con PVP 150€ arrancó solo en clusters A y B. A las 4 semanas ampliamos a C cuando confirmamos que la curva era buena. Evitamos tener stock parado en tiendas con menos tráfico."
        consecuencia="Si abres demasiados clusters de golpe y la demanda no se confirma, tendrás que hacer outlet o retirar antes de tiempo."
      />

      {/* ── Selector de clusters ─────────────────────────── */}
      <div className="mb-6">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          Clusters de distribución
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CLUSTERS.map(cl => {
            const active          = selectedClusters.includes(cl.id)
            const nTiendasCluster = tiendas.filter(t => t.cluster === cl.id).length
            return (
              <button
                key={cl.id}
                onClick={() => toggleCluster(cl.id)}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  background: active ? `${cl.color}10` : 'white',
                  border:     `2px solid ${active ? cl.color : 'rgba(0,85,127,0.1)'}`,
                  boxShadow:  active ? `0 0 0 3px ${cl.color}20` : 'var(--tq-shadow-xs)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-black" style={{ color: active ? cl.color : '#c0cfd8' }}>
                    {cl.id}
                  </span>
                  {active && (
                    <span className="text-[9px] font-bold" style={{ color: cl.color }}>✓</span>
                  )}
                </div>
                <p className="text-[13px] font-semibold leading-tight mb-0.5" style={{ color: active ? '#00264d' : '#8fa8b8' }}>
                  {nTiendasCluster} tiendas
                </p>
                <p className="text-[10px]" style={{ color: '#b2b2b2' }}>
                  {cl.descripcion}
                </p>
              </button>
            )
          })}
        </div>
        {selectedClusters.length === 0 && (
          <p className="mt-2 text-[11px]" style={{ color: '#C8842A' }}>
            ↑ Selecciona al menos un cluster para continuar
          </p>
        )}
      </div>

      {/* ── Unidades por tienda ──────────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Unidades por tienda (pedido inicial)
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,85,127,0.15)' }}>
            <button
              onClick={() => handleUdsPerTienda(udsPerTienda - 1)}
              className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
              style={{ color: '#00557f' }}
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={udsPerTienda}
              onChange={e => handleUdsPerTienda(parseInt(e.target.value) || 1)}
              className="w-14 h-9 text-center text-[15px] font-bold border-x border-[rgba(0,85,127,0.12)] bg-white focus:outline-none"
              style={{ color: '#00264d' }}
            />
            <button
              onClick={() => handleUdsPerTienda(udsPerTienda + 1)}
              className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
              style={{ color: '#00557f' }}
            >
              +
            </button>
          </div>
          <span className="text-[12px]" style={{ color: '#8fa8b8' }}>uds/tienda</span>
        </div>
      </div>

      {/* ── Resumen de totales ───────────────────────────── */}
      {selectedClusters.length > 0 && (
        <div
          className="grid grid-cols-3 gap-3 rounded-xl p-4 mb-5"
          style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)' }}
        >
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>Tiendas</p>
            <p className="text-[22px] font-black" style={{ color: '#00557f' }}>{totalTiendas}</p>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid rgba(0,85,127,0.08)', borderRight: '1px solid rgba(0,85,127,0.08)' }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>Uds. totales</p>
            <p className="text-[22px] font-black" style={{ color: '#00264d' }}>{totalUnidades.toLocaleString('es-ES')}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>Presupuesto</p>
            <p className="text-[22px] font-black" style={{ color: presupuestoCompra ? '#00264d' : '#c0cfd8' }}>
              {presupuestoCompra ? fmtEur(presupuestoCompra) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── Validación vs media histórica ───────────────── */}
      <AlertaVolumen totalUds={totalUnidades} media={mediaVentas} />

      {mediaVentas != null && (
        <p className="mt-2 mb-4 text-[11px]" style={{ color: '#b2b2b2' }}>
          Referencia: {mediaVentas} uds/mes de media en productos similares · {totalTiendas} tiendas · {lanzamiento.familia}
        </p>
      )}

      {/* ── Distribución personalizada ───────────────────── */}
      <div className="mb-5">
        <label className="flex items-center gap-2.5 cursor-pointer mb-4">
          <div
            onClick={() => handleTogglePersonalizada(!distribPersonalizada)}
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ background: distribPersonalizada ? '#00557f' : '#e0e0e0' }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
              style={{ left: distribPersonalizada ? '22px' : '2px' }}
            />
          </div>
          <span className="text-[12px] font-medium" style={{ color: '#00264d' }}>
            Distribución personalizada por tienda
          </span>
          <span className="text-[10px]" style={{ color: '#b2b2b2' }}>(opcional)</span>
        </label>

        {distribPersonalizada && tiendasVisibles.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,85,127,0.1)' }}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.08)' }}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                {tiendasVisibles.length} tiendas seleccionadas
              </span>
              <button
                onClick={distribuirIgual}
                className="text-[11px] font-semibold hover:underline"
                style={{ color: '#0099f2' }}
              >
                Distribuir igual ({udsPerTienda} uds)
              </button>
            </div>

            {/* Tiendas agrupadas por cluster */}
            <div className="divide-y divide-[rgba(0,85,127,0.06)]">
              {CLUSTERS.map(cl => {
                const clTiendas = tiendasVisibles.filter(t => t.cluster === cl.id)
                if (!clTiendas.length) return null

                const subtotal = clTiendas.reduce((s, t) => s + (customDist[t.id] ?? 0), 0)

                return (
                  <div key={cl.id}>
                    {/* Cluster header */}
                    <div
                      className="flex items-center justify-between px-4 py-1.5"
                      style={{ background: `${cl.color}08` }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cl.color }}>
                        {cl.label} — {cl.descripcion}
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: cl.color }}>
                        {subtotal} uds
                      </span>
                    </div>

                    {/* Tiendas del cluster con nombres reales */}
                    {clTiendas.map(tienda => (
                      <div
                        key={tienda.id}
                        className="flex items-center justify-between px-4 py-2"
                        style={{ borderTop: '1px solid rgba(0,85,127,0.04)' }}
                      >
                        <div className="min-w-0">
                          <span className="text-[12px] font-medium" style={{ color: '#00264d' }}>
                            {tienda.nombre_corto ?? tienda.nombre}
                          </span>
                          {tienda.zona && (
                            <span className="ml-1.5 text-[10px]" style={{ color: '#b2b2b2' }}>
                              {tienda.zona}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0 rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid rgba(0,85,127,0.12)' }}>
                          <button
                            onClick={() => handleCustomUds(tienda.id, (customDist[tienda.id] ?? 0) - 1)}
                            className="w-7 h-7 flex items-center justify-center text-[14px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                            style={{ color: '#00557f' }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={customDist[tienda.id] ?? 0}
                            onChange={e => handleCustomUds(tienda.id, parseInt(e.target.value) || 0)}
                            className="w-12 h-7 text-center text-[12px] font-bold border-x border-[rgba(0,85,127,0.1)] bg-white focus:outline-none"
                            style={{ color: '#00264d' }}
                          />
                          <button
                            onClick={() => handleCustomUds(tienda.id, (customDist[tienda.id] ?? 0) + 1)}
                            className="w-7 h-7 flex items-center justify-center text-[14px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                            style={{ color: '#00557f' }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* Total footer */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'rgba(0,85,127,0.03)', borderTop: '1.5px solid rgba(0,85,127,0.1)' }}
              >
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>Total</span>
                <span className="text-[13px] font-black" style={{ color: '#00264d' }}>
                  {totalUnidades.toLocaleString('es-ES')} uds
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sugerencia IA ────────────────────────────────── */}
      <SugerenciaIA
        lanzamientoId={lanzamiento.id}
        paso={3}
        contexto={{
          total_unidades: totalUnidades,
          media_ventas:   mediaVentas,
          clusters:       selectedClusters,
        }}
        label="¿Es razonable este pedido?"
        disabled={selectedClusters.length === 0 || totalUnidades === 0}
        disabledReason="Selecciona al menos un cluster y establece las unidades por tienda"
      />
    </WizardLayout>
  )
}
