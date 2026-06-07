'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { calcularCurva, calcularKpis, fmtEur, fmtPct } from '@/lib/lanzamiento'
import type { CalcularCurvaParams } from '@/lib/lanzamiento'
import type { Lanzamiento } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────

function factorLabel(f: number): { text: string; color: string } {
  if (f < 80)  return { text: 'Conservador',       color: '#C8842A' }
  if (f <= 120) return { text: 'Ajuste estándar',  color: '#3A9E6A' }
  return              { text: 'Agresivo',           color: '#0099f2' }
}

function rampLabel(s: number): string {
  if (s === 1)  return 'Sin rampa — arranca a pleno rendimiento desde la semana 1'
  if (s <= 3)   return 'Rampa rápida'
  if (s <= 6)   return 'Rampa moderada'
  return              'Rampa lenta — crecimiento gradual'
}

// ── Mini KPI block ────────────────────────────────────────────────

function KpiBlock({
  label, value, sub, color = '#00264d',
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.07)' }}
    >
      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8fa8b8' }}>
        {label}
      </p>
      <p className="text-[16px] font-black leading-tight" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: '#b2b2b2' }}>{sub}</p>}
    </div>
  )
}

// ── Tooltip personalizado ─────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-left"
      style={{ background: 'white', boxShadow: '0 4px 12px rgba(0,32,60,0.12)', border: 'none' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#8fa8b8' }}>
        Semana {label}
      </p>
      <p className="text-[13px] font-bold" style={{ color: '#00264d' }}>
        {Math.round(payload[0]?.value ?? 0)} uds
      </p>
    </div>
  )
}

// ── Aviso datos incompletos ───────────────────────────────────────

function AvisoDatosIncompletos({ lanzamientoId, campo }: { lanzamientoId: string; campo: string }) {
  return (
    <div
      className="rounded-xl p-6 text-center mb-5"
      style={{ background: 'rgba(200,132,42,0.05)', border: '1px solid rgba(200,132,42,0.15)' }}
    >
      <p className="text-[13px] font-medium mb-1" style={{ color: '#a06818' }}>
        Necesitas completar el {campo} en pasos anteriores para ver la curva.
      </p>
      <a
        href={`/lanzamiento/${lanzamientoId}/paso/2`}
        className="text-[12px] underline"
        style={{ color: '#0099f2' }}
      >
        ← Ir al Paso 2 (datos del producto)
      </a>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────

export function PasoCurva({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [semanasRampa,          setSemanasRampa]          = useState(lanzamiento.semanas_rampa ?? 3)
  const [crecimientoSemanalPct, setCrecimientoSemanalPct] = useState(lanzamiento.crecimiento_semanal_pct ?? 5)
  const [factorAjustePct,       setFactorAjustePct]       = useState(lanzamiento.factor_ajuste_pct ?? 100)

  // ── Cálculo de la curva ─────────────────────────────────────────
  const canCompute = !!(
    lanzamiento.precio_venta &&
    lanzamiento.coste &&
    (lanzamiento.unidades_compra_total != null || lanzamiento.unidades_por_tienda != null)
  )

  const unidadesTotalCompra = lanzamiento.unidades_compra_total
    ?? ((lanzamiento.unidades_por_tienda ?? 2) * (lanzamiento.n_tiendas ?? 19))

  const curvaParams: CalcularCurvaParams | null = canCompute ? {
    unidadesTotalCompra,
    semanasRampa,
    crecimientoSemanalPct,
    factorAjustePct,
    precioVenta:           lanzamiento.precio_venta!,
    coste:                 lanzamiento.coste!,
    descuentoPct:          0,
    semanasPromo:          0,
  } : null

  const curva = useMemo(() => {
    if (!curvaParams) return []
    return calcularCurva(curvaParams)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    unidadesTotalCompra,
    lanzamiento.precio_venta, lanzamiento.coste,
    semanasRampa, crecimientoSemanalPct, factorAjustePct,
  ])

  const kpis = useMemo(() => {
    if (!curva.length || !curvaParams) return null
    return calcularKpis(curva, curvaParams)
  }, [curva, curvaParams])

  const chartData = curva.map(r => ({
    semana:   r.semana,
    unidades: r.unidades,
  }))

  const pctFactor = factorAjustePct
  const fCfg      = factorLabel(pctFactor)

  // ── Handlers ───────────────────────────────────────────────────

  function handleRampa(v: number) {
    setSemanasRampa(v)
    save({ semanas_rampa: v })
  }

  function handleCrecimiento(v: number) {
    const safe = Math.max(0, Math.min(30, v))
    setCrecimientoSemanalPct(safe)
    save({ crecimiento_semanal_pct: safe })
  }

  function handleFactor(v: number) {
    const safe = Math.max(50, Math.min(150, v))
    setFactorAjustePct(safe)
    save({ factor_ajuste_pct: safe })
  }

  async function handleNext() {
    await flush()
    if (kpis) {
      // Guardar outputs de la curva para usar en paso 7 y listado confirmados
      await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          paso_actual:              Math.max(lanzamiento.paso_actual, 6),
          output_unidades_total:    Math.round(kpis.unidades_total),
          output_margen_proyectado: Math.round(kpis.margen_pct * 10) / 10,
          output_breakeven_semanas: kpis.breakeven_semanas,
        }),
      })
    }
    router.push(`/lanzamiento/${lanzamiento.id}/paso/6`)
  }

  return (
    <WizardLayout
      step={5}
      tipo={lanzamiento.tipo}
      lanzamientoId={lanzamiento.id}
      title="Curva de demanda proyectada"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-5"
        concepto="En joyería el consumo es más pausado que en retail de alimentación o moda rápida. Un producto nuevo tarda entre 3 y 4 semanas en despegar — el equipo de tienda necesita aprender el producto y el cliente necesita descubrirlo. La plata rota mucho más rápido que el oro: el oro se compra para ocasiones especiales y el cliente tarda más en decidirse."
        ejemplo="Lo que más acelera o ralentiza el despegue no es el producto en sí, sino el escaparate y las RRSS. Un producto en escaparate desde la semana 1 puede reducir la rampa a 2 semanas. Si entra al expositor sin comunicación, la rampa puede alargarse a 5-6 semanas sin que sea problema del producto."
        consecuencia="Una rampa demasiado corta genera expectativas irreales y la proyección se aleja de la realidad. Una rampa demasiado larga puede hacer que el producto muera antes de que el equipo lo haya dado a conocer."
      />

      {!canCompute && (
        <AvisoDatosIncompletos
          lanzamientoId={lanzamiento.id}
          campo="PVP, coste y distribución"
        />
      )}

      {canCompute && (
        <>
          {/* Base del pedido — resumen paso 3 */}
          <div
            className="flex items-center gap-4 rounded-xl px-4 py-3 mb-6 text-[12px]"
            style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)' }}
          >
            <span style={{ color: '#8fa8b8' }}>Base (Paso 3):</span>
            <span className="font-semibold" style={{ color: '#00264d' }}>
              {lanzamiento.n_tiendas} tiendas × {lanzamiento.unidades_por_tienda} uds
              {' '}= <strong>{(lanzamiento.n_tiendas! * lanzamiento.unidades_por_tienda!).toLocaleString('es-ES')} uds</strong> totales
            </span>
            {lanzamiento.referencia_analoga && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-auto"
                style={{ background: 'rgba(0,153,242,0.1)', color: '#006da3' }}
              >
                Con referencia análoga
              </span>
            )}
          </div>

          {/* ── Parámetros ──────────────────────────────────────── */}
          <div className="space-y-6 mb-6">

            {/* Factor de ajuste */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                  Factor de ajuste sobre el plan base
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${fCfg.color}15`, color: fCfg.color }}
                  >
                    {fCfg.text}
                  </span>
                  <span className="text-[14px] font-black" style={{ color: fCfg.color }}>
                    {factorAjustePct}%
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={50}
                max={150}
                step={5}
                value={factorAjustePct}
                onChange={e => handleFactor(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: fCfg.color }}
              />
              <div className="flex justify-between text-[9px] mt-1 font-medium" style={{ color: '#c0cfd8' }}>
                <span>50% — muy conservador</span>
                <span style={{ color: '#8fa8b8', fontWeight: 700 }}>100% plan base</span>
                <span>150% — muy agresivo</span>
              </div>
              {factorAjustePct !== 100 && (
                <p className="text-[11px] mt-1.5" style={{ color: fCfg.color }}>
                  {factorAjustePct > 100
                    ? `+${factorAjustePct - 100}% más unidades que el plan base`
                    : `${factorAjustePct - 100}% menos unidades que el plan base`}
                </p>
              )}
            </div>

            {/* Semanas de rampa */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                  Semanas de rampa
                </label>
                <span className="text-[14px] font-black" style={{ color: '#00557f' }}>
                  {semanasRampa} sem.
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={semanasRampa}
                onChange={e => handleRampa(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#00557f' }}
              />
              <div className="flex justify-between text-[9px] mt-1 font-medium" style={{ color: '#c0cfd8' }}>
                <span>1 sem.</span>
                <span>4 sem.</span>
                <span>8 sem.</span>
                <span>12 sem.</span>
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: '#8fa8b8' }}>
                {rampLabel(semanasRampa)}
              </p>
            </div>

            {/* Crecimiento semanal */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
                Crecimiento semanal post-rampa
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,85,127,0.15)' }}>
                  <button
                    onClick={() => handleCrecimiento(crecimientoSemanalPct - 1)}
                    className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                    style={{ color: '#00557f' }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={crecimientoSemanalPct}
                    onChange={e => handleCrecimiento(parseInt(e.target.value) || 0)}
                    className="w-14 h-9 text-center text-[15px] font-bold border-x border-[rgba(0,85,127,0.12)] bg-white focus:outline-none"
                    style={{ color: '#00264d' }}
                  />
                  <button
                    onClick={() => handleCrecimiento(crecimientoSemanalPct + 1)}
                    className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                    style={{ color: '#00557f' }}
                  >
                    +
                  </button>
                </div>
                <span className="text-[12px]" style={{ color: '#8fa8b8' }}>% / semana</span>
                {crecimientoSemanalPct === 0 && (
                  <span className="text-[11px]" style={{ color: '#c0cfd8' }}>Sin crecimiento — meseta plana</span>
                )}
                {crecimientoSemanalPct > 15 && (
                  <span className="text-[11px]" style={{ color: '#C8842A' }}>Crecimiento muy optimista</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Gráfico 16 semanas ──────────────────────────────── */}
          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{ border: '1px solid rgba(0,85,127,0.08)' }}
          >
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.06)' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                Curva proyectada — 16 semanas
              </span>
              <span className="text-[10px]" style={{ color: '#b2b2b2' }}>
                Sin promo — ver Paso 6 para impacto campaña
              </span>
            </div>
            <div className="p-4 bg-white">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="curvaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00557f" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#00557f" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
                  <XAxis
                    dataKey="semana"
                    tickFormatter={(v: number) => `S${v}`}
                    tick={{ fontSize: 9, fill: '#b2b2b2' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#b2b2b2' }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {semanasRampa > 1 && (
                    <ReferenceLine
                      x={semanasRampa}
                      stroke="#C8842A"
                      strokeDasharray="4 2"
                      label={{ value: 'Fin rampa', position: 'top', fontSize: 8, fill: '#C8842A' }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="unidades"
                    stroke="#00557f"
                    strokeWidth={2}
                    fill="url(#curvaGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#00557f', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── KPIs ────────────────────────────────────────────── */}
          {kpis && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              <KpiBlock
                label="Uds. 16 semanas"
                value={kpis.unidades_total.toLocaleString('es-ES')}
                sub="unidades totales"
              />
              <KpiBlock
                label="Ingresos proy."
                value={fmtEur(kpis.ingresos)}
                color="#00557f"
              />
              <KpiBlock
                label="Margen bruto"
                value={fmtPct(kpis.margen_pct, 0)}
                sub={fmtEur(kpis.margen_bruto)}
                color={kpis.margen_pct >= 40 ? '#3A9E6A' : kpis.margen_pct >= 30 ? '#C8842A' : '#C0392B'}
              />
              <KpiBlock
                label="Break-even"
                value={kpis.breakeven_semanas ? `Sem. ${kpis.breakeven_semanas}` : 'No alc.'}
                color={kpis.breakeven_semanas && kpis.breakeven_semanas <= 8 ? '#3A9E6A' : '#C8842A'}
                sub={kpis.breakeven_semanas ? '✓ dentro de 16 sem.' : 'amplía la ventana'}
              />
            </div>
          )}
        </>
      )}
    </WizardLayout>
  )
}
