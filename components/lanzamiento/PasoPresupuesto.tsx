'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { fmtEur, fmtPct } from '@/lib/lanzamiento'
import type { Lanzamiento } from '@/types'

// ── Stepper ───────────────────────────────────────────────────

function Stepper({
  label, sub, value, unit, min, max, step = 1, onChange,
}: {
  label: string; sub?: string; value: number; unit: string
  min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>{label}</p>
          {sub && <p className="text-[10px]" style={{ color: '#6b8a9a' }}>{sub}</p>}
        </div>
        <span className="text-[15px] font-black" style={{ color: '#00264d' }}>
          {unit === '€' ? fmtEur(value) : `${value}${unit}`}
        </span>
      </div>
      <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,85,127,0.15)' }}>
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-9 h-9 flex items-center justify-center text-[16px] hover:bg-[rgba(0,85,127,0.05)]"
          style={{ color: '#00557f' }}
        >−</button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || min)))}
          className="flex-1 h-9 text-center text-[13px] font-bold border-x border-[rgba(0,85,127,0.12)] bg-white focus:outline-none"
          style={{ color: '#00264d' }}
        />
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-9 h-9 flex items-center justify-center text-[16px] hover:bg-[rgba(0,85,127,0.05)]"
          style={{ color: '#00557f' }}
        >+</button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────

export function PasoPresupuesto({ lanzamiento, step = 6 }: { lanzamiento: Lanzamiento; step?: number }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [presupuestoMarketing, setPresupuestoMarketing] = useState<number>(
    lanzamiento.presupuesto_marketing ?? 0,
  )
  const [opexPersonalPct, setOpexPersonalPct] = useState<number>(
    lanzamiento.opex_personal_pct ?? 12,
  )
  const [opexGastosPct, setOpexGastosPct] = useState<number>(
    lanzamiento.opex_gastos_pct ?? 9,
  )
  const [costeUnitario, setCosteUnitario] = useState<string>(
    lanzamiento.coste?.toString() ?? '',
  )
  const costeNum = parseFloat(costeUnitario) || null

  function handleCoste(v: string) {
    setCosteUnitario(v)
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) save({ coste: n })
  }

  // Métricas derivadas del simulador base
  const costeEfectivo   = costeNum ?? lanzamiento.coste ?? null
  const totalUds        = lanzamiento.unidades_compra_total ?? null
  const inversionCompra = costeEfectivo && totalUds
    ? Math.round(totalUds * costeEfectivo)
    : (lanzamiento.output_presupuesto_compra ?? null)
  const inversionTotal  = (inversionCompra ?? 0) + presupuestoMarketing
  function handleMarketing(v: number) {
    const safe = Math.max(0, Math.round(v))
    setPresupuestoMarketing(safe)
    save({ presupuesto_marketing: safe || null })
  }

  function handlePersonal(v: number) {
    setOpexPersonalPct(v)
    save({ opex_personal_pct: v })
  }

  function handleGastos(v: number) {
    setOpexGastosPct(v)
    save({ opex_gastos_pct: v })
  }

  async function handleNext() {
    await flush()
    router.push(`/lanzamiento/${lanzamiento.id}/paso/7`)
  }

  const tipoLabel = lanzamiento.tipo === 'drop' ? 'drop' : 'lanzamiento de marca'

  return (
    <WizardLayout
      step={step}
      tipo={lanzamiento.tipo}
      lanzamientoId={lanzamiento.id}
      title="Presupuesto e inversión"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey={`wizard-coaching-presupuesto-${lanzamiento.tipo}`}
        concepto={`El presupuesto total tiene dos partes: la inversión en producto (coste de compra del stock) y la activación (marketing y materiales). En lanzamiento, Te Quiero apuesta por visibilidad sin descuento: regalo con compra, packaging especial, escaparate y RRSS. El descuento directo se reserva para Black Friday o salida de stock.`}
        ejemplo="Para un drop de San Valentín: compra de stock 3.200€ + materiales de packaging y regalo 600€ = 3.800€ inversión total. El EBITDA (MB − OPEX) muestra si el mix global es sostenible. El payback objetivo del equipo está entre 4 y 6 meses."
        consecuencia="Si el payback supera los 6 meses con el volumen proyectado, revisa el stock inicial o el mix de familias antes de confirmar."
      />

      {/* ── Inversión en producto ─────────────────────── */}
      <div
        className="rounded-xl p-4 mb-5 space-y-3"
        style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
          Inversión en producto (stock)
        </p>

        {/* Coste unitario — visible si no viene del paso de datos */}
        {lanzamiento.tipo !== 'sku' && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8fa8b8' }}>
              Coste unitario medio <span style={{ color: '#C0392B' }}>*</span>
            </label>
            <div className="relative max-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: '#8fa8b8' }}>€</span>
              <input
                type="number"
                value={costeUnitario}
                onChange={e => handleCoste(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full rounded-lg pl-7 pr-3 py-2 text-[13px] font-bold focus:outline-none"
                style={{
                  border:     `1.5px solid ${costeNum ? '#00557f' : 'rgba(0,85,127,0.2)'}`,
                  background: 'white',
                  color:      '#00264d',
                }}
                onFocus={e  => (e.target.style.borderColor = '#00557f')}
                onBlur={e   => (e.target.style.borderColor = costeNum ? '#00557f' : 'rgba(0,85,127,0.2)')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>Coste</span>
            </div>
            {!costeNum && (
              <p className="text-[10px] mt-1" style={{ color: '#C8842A' }}>
                Necesario para calcular la inversión total en stock
              </p>
            )}
          </div>
        )}

        {/* Resumen inversión */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px]" style={{ color: '#5a7a8a' }}>
            {totalUds?.toLocaleString('es-ES') ?? '—'} uds ×{' '}
            {costeEfectivo ? fmtEur(costeEfectivo) : '—'} coste
          </p>
          <p className="text-[20px] font-black" style={{ color: inversionCompra ? '#00264d' : '#8fa8b8' }}>
            {inversionCompra ? fmtEur(inversionCompra) : '—'}
          </p>
        </div>
        {!inversionCompra && !costeNum && lanzamiento.tipo === 'sku' && (
          <p className="text-[11px]" style={{ color: '#C8842A' }}>
            Completa los pasos anteriores para ver el presupuesto de compra
          </p>
        )}
      </div>

      {/* ── Marketing ────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          Activación y marketing
        </p>
        <Stepper
          label="Presupuesto de marketing"
          sub="redes, escaparatismo, materiales de tienda…"
          value={presupuestoMarketing}
          unit="€"
          min={0}
          max={20000}
          step={100}
          onChange={handleMarketing}
        />
      </div>

      {/* ── Inversión total ───────────────────────────── */}
      {inversionCompra != null && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between"
          style={{ background: 'rgba(0,38,77,0.04)', border: '1px solid rgba(0,38,77,0.08)' }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>Inversión total</p>
            <p className="text-[10px]" style={{ color: '#5a7a8a' }}>
              {fmtEur(inversionCompra)} producto + {fmtEur(presupuestoMarketing)} marketing
            </p>
          </div>
          <p className="text-[22px] font-black" style={{ color: '#00264d' }}>
            {fmtEur(inversionTotal)}
          </p>
        </div>
      )}

      {/* ── OPEX ──────────────────────────────────────── */}
      <div
        className="rounded-xl p-4 mb-5 space-y-4"
        style={{ background: 'rgba(0,85,127,0.025)', border: '1px solid rgba(0,85,127,0.08)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
          OPEX (% sobre ventas netas)
        </p>
        <Stepper
          label="Personal"
          sub="comisiones + coste laboral asignado"
          value={opexPersonalPct}
          unit="%"
          min={0}
          max={50}
          step={1}
          onChange={handlePersonal}
        />
        <Stepper
          label="Gastos operativos"
          sub="alquiler proporcional, logística, merma"
          value={opexGastosPct}
          unit="%"
          min={0}
          max={30}
          step={1}
          onChange={handleGastos}
        />

        {/* EBITDA estimado */}
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px dashed rgba(0,85,127,0.12)' }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
              OPEX total
            </p>
          </div>
          <p className="text-[15px] font-black" style={{ color: '#00264d' }}>
            {opexPersonalPct + opexGastosPct}%
          </p>
        </div>
      </div>

      {/* ── Nota ─────────────────────────────────────── */}
      <p className="text-[11px]" style={{ color: '#6b8a9a' }}>
        El EBITDA y el payback exactos se calculan en el simulador del paso siguiente, una vez fijados los escenarios de venta.
      </p>
    </WizardLayout>
  )
}
