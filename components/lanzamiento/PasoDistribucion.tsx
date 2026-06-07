'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { SugerenciaIA }  from './SugerenciaIA'
import {
  CLUSTERS, CLUSTER_WEIGHTS,
  calcularDistribucionPorCluster,
  nTiendasDesdeClusters, fmtEur,
} from '@/lib/lanzamiento'
import type { Lanzamiento, Tienda } from '@/types'

// ── Validación de dist. personalizada ────────────────────────
function validarCustomDist(
  saved: Record<string, number> | null,
  tiendaIds: Set<string>,
): Record<string, number> {
  if (!saved) return {}
  const allValid = Object.keys(saved).every(k => tiendaIds.has(k))
  return allValid ? saved : {}
}

// ── Chip de advertencia / info ────────────────────────────────

function AlertaVolumen({ totalUds, media }: { totalUds: number; media: number | null }) {
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
  step = 3,
}: {
  lanzamiento: Lanzamiento
  tiendas:     Tienda[]
  step?:       number
}) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const tiendaIds = new Set(tiendas.map(t => t.id))

  // ── Estado ───────────────────────────────────────────────────
  const [selectedClusters, setSelectedClusters] = useState<string[]>(
    (lanzamiento.clusters_objetivo as string[] | null) ?? ['A', 'B', 'C'],
  )

  // Total de unidades a comprar al proveedor
  const initUds = lanzamiento.unidades_compra_total
    ?? ((lanzamiento.unidades_por_tienda ?? 2) * (lanzamiento.n_tiendas ?? 19))
  const [unidadesCompraTotal, setUnidadesCompraTotal] = useState<number>(initUds)
  // valor crudo del input — permite borrar y reescribir sin que salte a 1
  const [inputUds, setInputUds] = useState<string>(String(initUds))

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

  // ── Métricas derivadas ───────────────────────────────────────
  const totalTiendas = nTiendasDesdeClusters(selectedClusters, tiendas)

  const totalUnidades = distribPersonalizada
    ? Object.values(customDist).reduce((s, v) => s + (v || 0), 0)
    : unidadesCompraTotal

  const presupuestoCompra = lanzamiento.coste
    ? Math.round(totalUnidades * lanzamiento.coste)
    : null

  // Distribución automática por cluster (solo cuando no es personalizada)
  const distribucionAuto = calcularDistribucionPorCluster(
    unidadesCompraTotal,
    tiendas,
    selectedClusters,
  )

  // Tiendas visibles para la distribución personalizada
  const tiendasVisibles = tiendas.filter(
    t => t.cluster != null && selectedClusters.includes(t.cluster),
  )

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

  function handleUnidadesCompraTotal(v: number) {
    const safe = Math.max(1, Math.round(v))
    setUnidadesCompraTotal(safe)
    setInputUds(String(safe))
    save({ unidades_compra_total: safe })
  }

  function handleInputUdsChange(raw: string) {
    setInputUds(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 1) {
      setUnidadesCompraTotal(parsed)
      save({ unidades_compra_total: parsed })
    }
  }

  function handleInputUdsBlur() {
    const parsed = parseInt(inputUds, 10)
    const safe   = isNaN(parsed) || parsed < 1 ? 1 : Math.round(parsed)
    setUnidadesCompraTotal(safe)
    setInputUds(String(safe))
    save({ unidades_compra_total: safe })
  }

  function handleTogglePersonalizada(on: boolean) {
    setDistribPersonalizada(on)
    if (on) {
      // Inicializar con la distribución automática por cluster
      const initDist: Record<string, number> = {}
      const dist = calcularDistribucionPorCluster(unidadesCompraTotal, tiendas, selectedClusters)
      const distByCluster: Record<string, number> = {}
      dist.forEach(d => { distByCluster[d.clusterId] = Math.round(d.udsPorTienda) })
      tiendasVisibles.forEach(t => {
        initDist[t.id] = distByCluster[t.cluster!] ?? 1
      })
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

  async function handleNext() {
    await flush()
    await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        paso_actual:               Math.max(lanzamiento.paso_actual, step + 1),
        n_tiendas:                 totalTiendas,
        output_presupuesto_compra: presupuestoCompra,
      }),
    })
    router.push(`/lanzamiento/${lanzamiento.id}/paso/${step + 1}`)
  }

  return (
    <WizardLayout
      step={step}
      tipo={lanzamiento.tipo}
      lanzamientoId={lanzamiento.id}
      title="Distribución por tiendas"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-3"
        concepto="Indica cuántas unidades totales vas a pedir al proveedor. El sistema las distribuye por cluster ponderando automáticamente: Flagship ×1,5, Estándar ×1,0, Pequeña ×0,5. Una Flagship puede vender hasta el triple que una tienda Pequeña para el mismo producto. Puedes ajustar tienda a tienda si lo necesitas."
        ejemplo="Cuando abrió Galeón, la demanda dio un subidón que no habíamos previsto — sin stock extra, muchas referencias rotaron más rápido de lo proyectado. En Villalba, la Navidad disparó la demanda y provocó roturas en las semanas clave. Ambos casos pedían más stock del que se había planificado para esas tiendas."
        consecuencia="Abrir demasiados clusters de golpe sin stock suficiente genera roturas y frustra al equipo de tienda. Mejor empezar en Flagship+Estándar y ampliar cuando confirmes la demanda real."
      />

      {/* ── 1. Total de unidades a comprar ───────────────── */}
      <div className="mb-6">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          Unidades totales a comprar (pedido al proveedor)
        </label>

        <div className="flex items-center gap-4">
          {/* Stepper grande */}
          <div
            className="flex items-center gap-0 rounded-xl overflow-hidden"
            style={{ border: '2px solid rgba(0,85,127,0.18)' }}
          >
            {([-10, -1] as number[]).map(delta => (
              <button
                key={delta}
                onClick={() => handleUnidadesCompraTotal(unidadesCompraTotal + delta)}
                className="h-12 px-3 flex items-center justify-center transition-colors hover:bg-[rgba(0,85,127,0.06)] text-[13px] font-bold"
                style={{ color: '#00557f', minWidth: 36 }}
              >
                {delta}
              </button>
            ))}
            <input
              type="number"
              min={1}
              value={inputUds}
              onChange={e => handleInputUdsChange(e.target.value)}
              onBlur={handleInputUdsBlur}
              className="w-20 h-12 text-center text-[22px] font-black border-x border-[rgba(0,85,127,0.14)] bg-white focus:outline-none"
              style={{ color: '#00264d' }}
            />
            {[+1, +10].map(delta => (
              <button
                key={delta}
                onClick={() => handleUnidadesCompraTotal(unidadesCompraTotal + delta)}
                className="h-12 px-3 flex items-center justify-center transition-colors hover:bg-[rgba(0,85,127,0.06)] text-[13px] font-bold"
                style={{ color: '#00557f', minWidth: 36 }}
              >
                +{delta}
              </button>
            ))}
          </div>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: '#00264d' }}>uds. totales</p>
            {presupuestoCompra && (
              <p className="text-[11px]" style={{ color: '#8fa8b8' }}>
                coste pedido: <span className="font-bold" style={{ color: '#00557f' }}>{fmtEur(presupuestoCompra)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Selector de clusters ──────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          Clusters de distribución
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CLUSTERS.map(cl => {
            const active          = selectedClusters.includes(cl.id)
            const nTiendasCluster = tiendas.filter(t => t.cluster === cl.id).length
            const weight          = CLUSTER_WEIGHTS[cl.id] ?? 1
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
                  <span className="text-lg font-black" style={{ color: active ? cl.color : '#8fa8b8' }}>
                    {cl.id}
                  </span>
                  {active && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${cl.color}18`, color: cl.color }}>
                      ×{weight}
                    </span>
                  )}
                </div>
                <p className="text-[13px] font-semibold leading-tight mb-0.5" style={{ color: active ? '#00264d' : '#5a7a8a' }}>
                  {nTiendasCluster} tiendas
                </p>
                <p className="text-[10px] mb-2" style={{ color: active ? '#5a7a8a' : '#8fa8b8' }}>
                  {cl.descripcion}
                </p>
                {/* Nombres de tiendas del cluster */}
                <p className="text-[9px] leading-relaxed" style={{ color: active ? '#5a7a8a' : '#8fa8b8' }}>
                  {tiendas
                    .filter(t => t.cluster === cl.id)
                    .map(t => {
                      const nombre = t.nombre_corto ?? t.nombre
                      const isla   = t.isla && t.isla !== 'Tenerife' ? ` (${t.isla})` : ''
                      return nombre + isla
                    })
                    .join(' · ')}
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

      {/* ── 3. Distribución automática por cluster ───────── */}
      {selectedClusters.length > 0 && !distribPersonalizada && (
        <div
          className="rounded-xl overflow-hidden mb-5"
          style={{ border: '1px solid rgba(0,85,127,0.1)' }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.08)' }}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
              Distribución por cluster
            </span>
            <span className="text-[10px]" style={{ color: '#6b8a9a' }}>calculado automáticamente</span>
          </div>

          {distribucionAuto.map(row => {
            const cl = CLUSTERS.find(c => c.id === row.clusterId)
            if (!cl) return null
            const udsPorTiendaRounded = Math.round(row.udsPorTienda * 10) / 10
            return (
              <div
                key={row.clusterId}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: `${cl.color}18`, color: cl.color }}
                  >
                    {cl.id}
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: '#00264d' }}>
                      {cl.descripcion} <span style={{ color: '#5a7a8a' }}>({row.nTiendas} tiendas)</span>
                    </p>
                    <p className="text-[10px]" style={{ color: '#5a7a8a' }}>
                      factor ×{CLUSTER_WEIGHTS[cl.id]}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-black" style={{ color: cl.color }}>
                    {row.udsCluster} uds
                  </p>
                  <p className="text-[10px]" style={{ color: '#5a7a8a' }}>
                    ~{udsPorTiendaRounded} uds/tienda
                  </p>
                </div>
              </div>
            )
          })}

          {/* Totales */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'rgba(0,85,127,0.03)', borderTop: '1.5px solid rgba(0,85,127,0.1)' }}
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>Total pedido</p>
              <p className="text-[10px]" style={{ color: '#5a7a8a' }}>{totalTiendas} tiendas</p>
            </div>
            <div className="text-right">
              <p className="text-[17px] font-black" style={{ color: '#00264d' }}>
                {unidadesCompraTotal.toLocaleString('es-ES')} uds
              </p>
              {presupuestoCompra && (
                <p className="text-[11px] font-semibold" style={{ color: '#00557f' }}>
                  {fmtEur(presupuestoCompra)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Validación vs media histórica ───────────────── */}
      <AlertaVolumen totalUds={totalUnidades} media={mediaVentas} />
      {mediaVentas != null && (
        <p className="mt-2 mb-4 text-[11px]" style={{ color: '#6b8a9a' }}>
          Referencia: {mediaVentas} uds/mes de media en {lanzamiento.familia} · {totalTiendas} tiendas
        </p>
      )}

      {/* ── 4. Distribución personalizada ───────────────── */}
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
            Ajustar distribución por tienda
          </span>
          <span className="text-[10px]" style={{ color: '#6b8a9a' }}>(opcional)</span>
        </label>

        {distribPersonalizada && tiendasVisibles.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,85,127,0.1)' }}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.08)' }}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                {tiendasVisibles.length} tiendas
              </span>
              <button
                onClick={() => {
                  const dist = calcularDistribucionPorCluster(unidadesCompraTotal, tiendas, selectedClusters)
                  const distByCluster: Record<string, number> = {}
                  dist.forEach(d => { distByCluster[d.clusterId] = Math.round(d.udsPorTienda) })
                  const next: Record<string, number> = {}
                  tiendasVisibles.forEach(t => { next[t.id] = distByCluster[t.cluster!] ?? 1 })
                  setCustomDist(next)
                  save({ distribucion_personalizada: next })
                }}
                className="text-[11px] font-semibold hover:underline"
                style={{ color: '#0099f2' }}
              >
                Resetear a distribución automática
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
                          <span className="ml-1.5 text-[10px]" style={{ color: '#6b8a9a' }}>
                            {[
                              tienda.zona,
                              tienda.isla && tienda.isla !== 'Tenerife' ? tienda.isla : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
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
        disabledReason="Selecciona al menos un cluster y establece las unidades"
      />
    </WizardLayout>
  )
}
