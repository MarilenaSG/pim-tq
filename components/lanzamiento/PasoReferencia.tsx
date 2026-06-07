'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from 'recharts'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { SugerenciaIA }  from './SugerenciaIA'
import { fmtEur, fmtPct, mbColor } from '@/lib/lanzamiento'
import type { Lanzamiento } from '@/types'

// ── Tipos de referencia análoga ──────────────────────────────────

interface ReferenciaAnaloga {
  codigo_modelo:    string
  nombre:           string
  precio_venta:     number
  coste:            number | null
  mb_pct:           number | null
  avg_uds_mes:      number
  total_uds_12m:    number
  meses_con_ventas: number
  serie:            Array<{ label: string; uds: number }>
}

// ── Sparkline mini ────────────────────────────────────────────────

function Sparkline({ data, color }: { data: Array<{ label: string; uds: number }>; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            fontSize: 10, border: 'none', background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', borderRadius: 6, padding: '3px 8px',
          }}
          itemStyle={{ color: '#00264d', fontWeight: 600 }}
          labelStyle={{ color: '#8fa8b8', fontSize: 9 }}
          formatter={(v) => [`${v as number} uds`, '']}
        />
        <Area
          type="monotone"
          dataKey="uds"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${color.replace('#', '')})`}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Card de referencia ────────────────────────────────────────────

function ReferenciaCard({
  ref: r,
  isSelected,
  onSelect,
}: {
  ref:        ReferenciaAnaloga
  isSelected: boolean
  onSelect:   () => void
}) {
  const chartColor = isSelected ? '#00557f' : '#0099f2'

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all"
      style={{
        background: isSelected ? 'rgba(0,85,127,0.04)' : 'white',
        border:     `2px solid ${isSelected ? '#00557f' : 'rgba(0,85,127,0.1)'}`,
        boxShadow:  isSelected ? '0 0 0 3px rgba(0,85,127,0.08)' : 'var(--tq-shadow-xs)',
      }}
      onClick={onSelect}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p
            className="text-[12px] font-bold leading-snug truncate"
            style={{ color: isSelected ? '#00557f' : '#00264d' }}
          >
            {r.nombre}
          </p>
          <p className="text-[10px] mt-0.5 font-mono" style={{ color: '#0099f2' }}>
            {r.codigo_modelo}
          </p>
        </div>
        {isSelected && (
          <span
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px] font-bold"
            style={{ background: '#00557f' }}
          >
            ✓
          </span>
        )}
      </div>

      {/* Métricas en línea */}
      <div className="flex items-center gap-3 mb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#c0cfd8' }}>PVP</span>
          <p className="text-[12px] font-semibold" style={{ color: '#00264d' }}>
            {fmtEur(r.precio_venta)}
          </p>
        </div>
        {r.mb_pct != null && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#c0cfd8' }}>MB</span>
            <p className="text-[12px] font-semibold" style={{ color: mbColor(r.mb_pct) }}>
              {fmtPct(r.mb_pct, 0)}
            </p>
          </div>
        )}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#c0cfd8' }}>Uds/mes</span>
          <p className="text-[12px] font-semibold" style={{ color: '#00264d' }}>
            {r.avg_uds_mes}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#c0cfd8' }}>12m</span>
          <p className="text-[12px] font-semibold" style={{ color: '#00264d' }}>
            {r.total_uds_12m.toLocaleString('es-ES')} uds
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline data={r.serie} color={chartColor} />

      {/* Footer */}
      <p className="text-[9px] mt-1 text-right" style={{ color: '#c0cfd8' }}>
        {r.meses_con_ventas} meses con ventas · últimos 12 meses
      </p>
    </div>
  )
}

// ── Esqueleto de carga ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)', height: 140 }}
    >
      <div className="h-3 bg-[rgba(0,85,127,0.1)] rounded w-3/4 mb-2" />
      <div className="h-2 bg-[rgba(0,85,127,0.06)] rounded w-1/3 mb-4" />
      <div className="h-10 bg-[rgba(0,85,127,0.06)] rounded" />
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────

export function PasoReferencia({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [loading,     setLoading]     = useState(true)
  const [referencias, setReferencias] = useState<ReferenciaAnaloga[]>([])
  const [seleccionada, setSeleccionada] = useState<string | null>(
    lanzamiento.referencia_analoga ?? null,
  )
  const [sinReferencia, setSinReferencia] = useState(false)

  // ── Cargar referencias análogas ──────────────────────────────
  useEffect(() => {
    if (!lanzamiento.familia || !lanzamiento.precio_venta) {
      setLoading(false)
      return
    }
    fetch(
      `/api/lanzamiento/referencias-analogas?familia=${encodeURIComponent(lanzamiento.familia)}&pvp=${lanzamiento.precio_venta}`,
    )
      .then(r => r.json())
      .then((d: { referencias: ReferenciaAnaloga[] }) => setReferencias(d.referencias ?? []))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [lanzamiento.familia, lanzamiento.precio_venta])

  // ── Handlers ─────────────────────────────────────────────────

  function handleSeleccionar(codigo: string) {
    setSeleccionada(codigo)
    setSinReferencia(false)
    save({ referencia_analoga: codigo })
  }

  function handleSinReferencia() {
    setSinReferencia(true)
    setSeleccionada(null)
    save({ referencia_analoga: null })
  }

  async function handleNext() {
    await flush()
    await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paso_actual: Math.max(lanzamiento.paso_actual, 5) }),
    })
    router.push(`/lanzamiento/${lanzamiento.id}/paso/5`)
  }

  // ── Contexto para la IA ──────────────────────────────────────
  const ctxIA = {
    referencias: referencias.map(r => ({
      nombre:       r.nombre,
      avg_uds_mes:  r.avg_uds_mes,
      precio_venta: r.precio_venta,
      mb_pct:       r.mb_pct,
    })),
  }

  // ── Referencia actualmente elegida ───────────────────────────
  const refElegida = referencias.find(r => r.codigo_modelo === seleccionada)

  return (
    <WizardLayout
      step={4}
      lanzamientoId={lanzamiento.id}
      title="Referencia análoga"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-4"
        concepto="Una referencia análoga es un producto del catálogo histórico con características similares (familia, metal, rango de precio) que usaremos para anclar la proyección de demanda. Su curva real de ventas es el punto de partida más honesto que tenemos."
        ejemplo="Para el lanzamiento del anillo de zafiro de oro a 195€, tomamos como referencia un modelo de turmalina a 175€ que vendió 6 uds/mes de media en los clusters A+B. Ajustamos un factor +20% por el mayor precio de la piedra."
        consecuencia="Si no hay ninguna referencia válida, el paso 5 usará una curva genérica conservadora. Es menos preciso, pero sigue siendo útil."
      />

      {/* ── Aviso si no hay familia/pvp ────────────────────────── */}
      {!lanzamiento.familia || !lanzamiento.precio_venta ? (
        <div
          className="rounded-xl p-6 text-center mb-5"
          style={{ background: 'rgba(200,132,42,0.05)', border: '1px solid rgba(200,132,42,0.15)' }}
        >
          <p className="text-[13px] font-medium" style={{ color: '#a06818' }}>
            Completa la familia y el PVP en el Paso 2 para buscar referencias análogas.
          </p>
          <a
            href={`/lanzamiento/${lanzamiento.id}/paso/2`}
            className="text-[12px] underline mt-1 inline-block"
            style={{ color: '#0099f2' }}
          >
            ← Ir al Paso 2
          </a>
        </div>
      ) : (
        <>
          {/* ── Resultados ──────────────────────────────────────── */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px]" style={{ color: '#8fa8b8' }}>
                {loading
                  ? 'Buscando referencias similares…'
                  : referencias.length > 0
                  ? `${referencias.length} referencias encontradas · ${lanzamiento.familia} · ±30% de ${fmtEur(lanzamiento.precio_venta)}`
                  : 'No se encontraron referencias con suficiente histórico.'}
              </p>
              {!loading && (seleccionada || sinReferencia) && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: sinReferencia ? 'rgba(200,132,42,0.1)' : 'rgba(0,85,127,0.1)', color: sinReferencia ? '#a06818' : '#00557f' }}
                >
                  {sinReferencia ? 'Sin referencia' : '1 seleccionada'}
                </span>
              )}
            </div>

            {/* Skeleton mientras carga */}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* Cards de referencias */}
            {!loading && referencias.length > 0 && (
              <div className="space-y-3">
                {referencias.map(r => (
                  <ReferenciaCard
                    key={r.codigo_modelo}
                    ref={r}
                    isSelected={seleccionada === r.codigo_modelo}
                    onSelect={() => handleSeleccionar(r.codigo_modelo)}
                  />
                ))}
              </div>
            )}

            {/* Sin datos históricos */}
            {!loading && referencias.length === 0 && (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: 'rgba(0,85,127,0.03)', border: '1px dashed rgba(0,85,127,0.15)' }}
              >
                <p className="text-3xl mb-2 opacity-20">◈</p>
                <p className="text-[13px] font-medium mb-1" style={{ color: '#8fa8b8' }}>
                  No hay referencias análogas con suficiente histórico
                </p>
                <p className="text-[11px]" style={{ color: '#c0cfd8' }}>
                  Necesitamos al menos 6 meses de ventas en familia y rango de precio similar.
                </p>
              </div>
            )}
          </div>

          {/* ── Sin referencia ──────────────────────────────────── */}
          {!loading && (
            <div className="mb-5">
              <button
                onClick={handleSinReferencia}
                className="w-full rounded-xl px-4 py-3 text-[12px] font-medium transition-colors text-left"
                style={{
                  background: sinReferencia ? 'rgba(200,132,42,0.06)' : 'rgba(0,85,127,0.02)',
                  border:     `1.5px solid ${sinReferencia ? 'rgba(200,132,42,0.3)' : 'rgba(0,85,127,0.1)'}`,
                  color:      sinReferencia ? '#a06818' : '#8fa8b8',
                }}
              >
                {sinReferencia ? '✓ ' : ''} Ninguna se parece — usaré una curva genérica
                <span className="block text-[10px] font-normal mt-0.5" style={{ color: '#c0cfd8' }}>
                  El paso 5 generará una curva conservadora sin ancla histórica.
                </span>
              </button>
            </div>
          )}

          {/* ── Referencia seleccionada → detalle rápido ───────── */}
          {refElegida && (
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-3 mb-5"
              style={{ background: 'rgba(0,85,127,0.05)', border: '1px solid rgba(0,85,127,0.12)' }}
            >
              <span style={{ color: '#00557f', fontSize: 16 }}>✓</span>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: '#00557f' }}>
                  Referencia elegida: {refElegida.nombre}
                </p>
                <p className="text-[11px]" style={{ color: '#8fa8b8' }}>
                  {refElegida.avg_uds_mes} uds/mes de media · {refElegida.meses_con_ventas} meses activo · {fmtEur(refElegida.precio_venta)}
                </p>
              </div>
            </div>
          )}

          {/* ── Sugerencia IA ───────────────────────────────────── */}
          {!loading && referencias.length > 0 && (
            <SugerenciaIA
              lanzamientoId={lanzamiento.id}
              paso={4}
              contexto={ctxIA}
              label="¿Cuál referencia elegirías tú?"
              disabled={referencias.length === 0}
              disabledReason="No hay referencias disponibles para analizar"
            />
          )}
        </>
      )}
    </WizardLayout>
  )
}
