'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceArea, ResponsiveContainer,
} from 'recharts'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { calcularCurva, fmtEur, fmtPct } from '@/lib/lanzamiento'
import type { Lanzamiento } from '@/types'

// ── Chips de tipo de campaña ──────────────────────────────────────

const TIPOS_CAMPANA = [
  { id: 'rrss',      label: 'RRSS',           desc: 'Instagram · Facebook · TikTok' },
  { id: 'email',     label: 'Email marketing', desc: 'Envío a base de datos TQ' },
  { id: 'display',   label: 'Display digital', desc: 'Banners y formatos paid media' },
  { id: 'visual',    label: 'Visual / escaparate', desc: 'Punto de venta y decoración' },
  { id: 'evento',    label: 'Evento en tienda', desc: 'Presentación o acción presencial' },
]

// ── Tooltip del gráfico ───────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-left"
      style={{ background: 'white', boxShadow: '0 4px 12px rgba(0,32,60,0.12)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#8fa8b8' }}>
        Semana {label}
      </p>
      {payload.map(p => (
        <p key={p.name} className="text-[11px] font-semibold" style={{ color: p.color }}>
          {p.name === 'conPromo' ? 'Con campaña' : 'Sin campaña'}: {Math.round(p.value)} uds
        </p>
      ))}
    </div>
  )
}

// ── Diferencia de impacto ─────────────────────────────────────────

function ImpactoChip({ sinPromo, conPromo }: { sinPromo: number; conPromo: number }) {
  const diff    = conPromo - sinPromo
  const pctDiff = sinPromo > 0 ? (diff / sinPromo) * 100 : 0
  if (Math.abs(diff) < 1) return null

  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{
        background: diff > 0 ? 'rgba(58,158,106,0.12)' : 'rgba(200,132,42,0.1)',
        color:      diff > 0 ? '#2d7a54' : '#a06818',
      }}
    >
      {diff > 0 ? '+' : ''}{Math.round(diff)} uds ({diff > 0 ? '+' : ''}{pctDiff.toFixed(0)}%) vs sin campaña
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────

export function PasoCampana({ lanzamiento, step = 6 }: { lanzamiento: Lanzamiento; step?: number }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [hayCampana,          setHayCampana]          = useState(
    (lanzamiento.semanas_promo ?? 0) > 0,
  )
  const [tipoCampana,         setTipoCampana]         = useState(lanzamiento.tipo_campana ?? '')
  const [descuentoPromoPct,   setDescuentoPromoPct]   = useState(lanzamiento.descuento_promo_pct ?? 15)
  const [semanasPromo,        setSemanasPromo]        = useState(lanzamiento.semanas_promo ?? 2)
  const [notasCampana,        setNotasCampana]        = useState(lanzamiento.notas_campana ?? '')
  const [presupuestoMarketing, setPresupuestoMarketing] = useState<number>(
    lanzamiento.presupuesto_marketing ?? 0,
  )

  // ── Curvas ─────────────────────────────────────────────────────
  const canCompute = !!(
    lanzamiento.precio_venta &&
    lanzamiento.coste &&
    (lanzamiento.unidades_compra_total != null || lanzamiento.unidades_por_tienda != null)
  )

  const unidadesTotalCompra = lanzamiento.unidades_compra_total
    ?? ((lanzamiento.unidades_por_tienda ?? 2) * (lanzamiento.n_tiendas ?? 19))

  const baseParams = canCompute ? {
    unidadesTotalCompra,
    semanasRampa:          lanzamiento.semanas_rampa ?? 3,
    crecimientoSemanalPct: lanzamiento.crecimiento_semanal_pct ?? 5,
    factorAjustePct:       lanzamiento.factor_ajuste_pct ?? 100,
    precioVenta:           lanzamiento.precio_venta!,
    coste:                 lanzamiento.coste!,
    descuentoPct:          0,
    semanasPromo:          0,
  } : null

  const curvaSin = useMemo(() => {
    if (!baseParams) return []
    return calcularCurva(baseParams)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanzamiento.id])

  const curvaCon = useMemo(() => {
    if (!baseParams || !hayCampana) return curvaSin
    return calcularCurva({
      ...baseParams,
      descuentoPct:  descuentoPromoPct,
      semanasPromo,
    })
  }, [baseParams, hayCampana, descuentoPromoPct, semanasPromo, curvaSin])

  const chartData = curvaSin.map((r, i) => ({
    semana:   r.semana,
    sinPromo: r.unidades,
    conPromo: curvaCon[i]?.unidades ?? r.unidades,
  }))

  const totalSin = curvaSin.reduce((s, r) => s + r.unidades, 0)
  const totalCon = curvaCon.reduce((s, r) => s + r.unidades, 0)

  // ── Handlers ───────────────────────────────────────────────────

  function handleHayCampana(on: boolean) {
    setHayCampana(on)
    if (!on) {
      // Reset promo fields
      save({ semanas_promo: 0, descuento_promo_pct: 0, tipo_campana: null })
    }
  }

  function handleTipo(id: string) {
    const next = tipoCampana === id ? '' : id
    setTipoCampana(next)
    save({ tipo_campana: next || null })
  }

  function handleDescuento(v: number) {
    const safe = Math.max(0, Math.min(50, v))
    setDescuentoPromoPct(safe)
    save({ descuento_promo_pct: safe })
  }

  function handleSemanas(v: number) {
    const safe = Math.max(1, Math.min(8, v))
    setSemanasPromo(safe)
    save({ semanas_promo: safe })
  }

  function handleNotas(v: string) {
    setNotasCampana(v)
    save({ notas_campana: v || null })
  }

  function handlePresupuestoMarketing(v: number) {
    const safe = Math.max(0, Math.round(v))
    setPresupuestoMarketing(safe)
    save({ presupuesto_marketing: safe || null })
  }

  async function handleNext() {
    await flush()
    await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paso_actual: Math.max(lanzamiento.paso_actual, 7) }),
    })
    router.push(`/lanzamiento/${lanzamiento.id}/paso/7`)
  }

  return (
    <WizardLayout
      step={step}
      tipo={lanzamiento.tipo}
      lanzamientoId={lanzamiento.id}
      title="Esfuerzo de campaña"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-6"
        concepto="En lanzamiento, la estrategia de Te Quiero es visibilidad sin descuento: regalo con compra, packaging especial y comunicación en escaparate y RRSS. El descuento directo se reserva para campañas de salida de stock o Black Friday — usarlo en lanzamiento puede dañar la percepción de valor del producto desde el primer día."
        ejemplo="Black Friday funciona muy bien precisamente porque el cliente espera y acepta el descuento en ese contexto. En un lanzamiento, un packaging especial o un regalo con compra comunica valor sin reducir el margen. El objetivo es generar descubrimiento y deseo, no urgencia por precio."
        consecuencia="Si activas descuento en lanzamiento, asegúrate de que el MB resultante en esas semanas sigue siendo positivo. Si no, estás pagando para que el cliente te compre — y esa expectativa de precio se quedará."
      />

      {/* ── Toggle campaña sí/no ────────────────────────────── */}
      <div className="mb-6">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          ¿Habrá campaña de lanzamiento?
        </label>
        <div className="flex gap-2">
          {[
            { v: false, label: 'No — lanzamiento orgánico', icon: '○' },
            { v: true,  label: 'Sí — con campaña y descuento', icon: '◉' },
          ].map(opt => (
            <button
              key={String(opt.v)}
              onClick={() => handleHayCampana(opt.v)}
              className="flex-1 flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-medium transition-all"
              style={{
                background: hayCampana === opt.v ? (opt.v ? 'rgba(0,85,127,0.06)' : 'rgba(58,158,106,0.06)') : 'white',
                border: `2px solid ${hayCampana === opt.v ? (opt.v ? '#00557f' : '#3A9E6A') : 'rgba(0,85,127,0.1)'}`,
                color: hayCampana === opt.v ? (opt.v ? '#00557f' : '#3A9E6A') : '#8fa8b8',
              }}
            >
              <span style={{ fontSize: 14 }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Configuración de campaña ────────────────────────── */}
      {hayCampana && (
        <>
          {/* Tipo de campaña chips */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8fa8b8' }}>
              Tipo de campaña
            </label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_CAMPANA.map(t => {
                const active = tipoCampana === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTipo(t.id)}
                    title={t.desc}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all"
                    style={{
                      background: active ? '#00557f' : 'rgba(0,85,127,0.06)',
                      color:      active ? 'white'   : '#00557f',
                      border:     `1.5px solid ${active ? '#00557f' : 'rgba(0,85,127,0.15)'}`,
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            {tipoCampana && (
              <p className="text-[11px] mt-1.5" style={{ color: '#8fa8b8' }}>
                {TIPOS_CAMPANA.find(t => t.id === tipoCampana)?.desc}
              </p>
            )}
          </div>

          {/* Descuento y duración en grid */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Descuento */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
                % de descuento promo
              </label>
              <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,85,127,0.15)' }}>
                <button
                  onClick={() => handleDescuento(descuentoPromoPct - 5)}
                  className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                  style={{ color: '#00557f' }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={descuentoPromoPct}
                  onChange={e => handleDescuento(parseInt(e.target.value) || 0)}
                  className="flex-1 h-9 text-center text-[15px] font-bold border-x border-[rgba(0,85,127,0.12)] bg-white focus:outline-none"
                  style={{ color: '#00264d' }}
                />
                <button
                  onClick={() => handleDescuento(descuentoPromoPct + 5)}
                  className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                  style={{ color: '#00557f' }}
                >
                  +
                </button>
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#b2b2b2' }}>
                PVP promo: {lanzamiento.precio_venta
                  ? fmtEur(lanzamiento.precio_venta * (1 - descuentoPromoPct / 100))
                  : '—'}
              </p>
            </div>

            {/* Semanas */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
                Duración (semanas)
              </label>
              <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,85,127,0.15)' }}>
                <button
                  onClick={() => handleSemanas(semanasPromo - 1)}
                  className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                  style={{ color: '#00557f' }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={semanasPromo}
                  onChange={e => handleSemanas(parseInt(e.target.value) || 1)}
                  className="flex-1 h-9 text-center text-[15px] font-bold border-x border-[rgba(0,85,127,0.12)] bg-white focus:outline-none"
                  style={{ color: '#00264d' }}
                />
                <button
                  onClick={() => handleSemanas(semanasPromo + 1)}
                  className="w-9 h-9 flex items-center justify-center text-[18px] transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                  style={{ color: '#00557f' }}
                >
                  +
                </button>
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#b2b2b2' }}>
                Semanas 1 a {semanasPromo} con precio reducido
              </p>
            </div>
          </div>

          {/* ── Gráfico comparativo ──────────────────────────── */}
          {canCompute && (
            <div
              className="rounded-xl overflow-hidden mb-5"
              style={{ border: '1px solid rgba(0,85,127,0.08)' }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.06)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                  Impacto de la campaña — 16 semanas
                </span>
                <ImpactoChip sinPromo={totalSin} conPromo={totalCon} />
              </div>
              <div className="p-4 bg-white">
                {/* Leyenda */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 bg-[#00557f]" />
                    <span className="text-[9px] font-medium" style={{ color: '#8fa8b8' }}>Con campaña</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 border-t-2 border-dashed border-[#c0cfd8]" />
                    <span className="text-[9px] font-medium" style={{ color: '#b2b2b2' }}>Sin campaña</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(200,132,42,0.2)' }} />
                    <span className="text-[9px] font-medium" style={{ color: '#b2b2b2' }}>Período promo</span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="campanaGrad" x1="0" y1="0" x2="0" y2="1">
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

                    {/* Franja de período promo */}
                    <ReferenceArea
                      x1={1}
                      x2={semanasPromo}
                      fill="rgba(200,132,42,0.12)"
                      stroke="rgba(200,132,42,0.25)"
                      strokeWidth={1}
                    />

                    {/* Curva sin promo (dashed) */}
                    <Line
                      type="monotone"
                      dataKey="sinPromo"
                      stroke="#c0cfd8"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                    />

                    {/* Curva con promo (filled) */}
                    <Area
                      type="monotone"
                      dataKey="conPromo"
                      stroke="#00557f"
                      strokeWidth={2}
                      fill="url(#campanaGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#00557f', strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* KPIs de la campaña */}
                {descuentoPromoPct > 0 && lanzamiento.coste && lanzamiento.precio_venta && (
                  <div
                    className="mt-3 flex items-center gap-4 px-3 py-2 rounded-lg text-[10px]"
                    style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.06)' }}
                  >
                    <div>
                      <span style={{ color: '#8fa8b8' }}>MB promo: </span>
                      <span className="font-bold" style={{ color: (() => {
                        const pvpPromo = lanzamiento.precio_venta! * (1 - descuentoPromoPct / 100)
                        const mb = ((pvpPromo - lanzamiento.coste!) / pvpPromo) * 100
                        return mb >= 30 ? '#3A9E6A' : mb >= 15 ? '#C8842A' : '#C0392B'
                      })() }}>
                        {(() => {
                          const pvpPromo = lanzamiento.precio_venta! * (1 - descuentoPromoPct / 100)
                          const mb = ((pvpPromo - lanzamiento.coste!) / pvpPromo) * 100
                          return fmtPct(mb, 0)
                        })()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#8fa8b8' }}>MB sin promo: </span>
                      <span className="font-bold" style={{ color: '#3A9E6A' }}>
                        {fmtPct(((lanzamiento.precio_venta! - lanzamiento.coste!) / lanzamiento.precio_venta!) * 100, 0)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#8fa8b8' }}>Impacto en uds.: </span>
                      <ImpactoChip sinPromo={totalSin} conPromo={totalCon} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Presupuesto de marketing ─────────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Inversión en marketing <span className="font-normal" style={{ color: '#c0cfd8' }}>(€ total de campaña)</span>
        </label>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 h-9"
            style={{ border: '1.5px solid rgba(0,85,127,0.15)', background: 'white' }}
          >
            <span className="text-[12px] font-semibold" style={{ color: '#8fa8b8' }}>€</span>
            <input
              type="number"
              min={0}
              step={100}
              value={presupuestoMarketing}
              onChange={e => handlePresupuestoMarketing(parseFloat(e.target.value) || 0)}
              className="w-28 h-full text-[14px] font-bold bg-transparent focus:outline-none"
              style={{ color: '#00264d' }}
              placeholder="0"
            />
          </div>
          {presupuestoMarketing > 0 && lanzamiento.output_presupuesto_compra && (
            <span className="text-[11px]" style={{ color: '#8fa8b8' }}>
              Inversión total: <strong style={{ color: '#00557f' }}>
                {fmtEur((lanzamiento.output_presupuesto_compra ?? 0) + presupuestoMarketing)}
              </strong>
              {' '}(compra + marketing)
            </span>
          )}
        </div>
        <p className="text-[10px] mt-1" style={{ color: '#c0cfd8' }}>
          Se usará en el Paso 7 para calcular el payback real de la inversión.
        </p>
      </div>

      {/* ── Notas de campaña ────────────────────────────────── */}
      <div className="mb-2">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Notas de campaña <span className="font-normal" style={{ color: '#c0cfd8' }}>(opcional)</span>
        </label>
        <textarea
          value={notasCampana}
          onChange={e => handleNotas(e.target.value)}
          rows={3}
          placeholder="Apunta aquí el mensaje clave, canales concretos, fechas previstas, responsable de ejecución…"
          className="w-full rounded-lg px-3 py-2.5 text-[12px] leading-relaxed resize-none transition-colors focus:outline-none"
          style={{
            border:     '1.5px solid rgba(0,85,127,0.15)',
            background: 'white',
            color:      '#00264d',
          }}
          onFocus={e => (e.target.style.borderColor = '#00557f')}
          onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
        />
      </div>

      {/* Hint para el último paso */}
      <p className="text-[11px] mt-4" style={{ color: '#b2b2b2' }}>
        En el <strong style={{ color: '#00557f' }}>Paso 7</strong> verás el simulador completo con el análisis de payback real, podrás crear escenarios y descargar el briefing.
      </p>
    </WizardLayout>
  )
}
