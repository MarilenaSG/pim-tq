'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import {
  calcularCurva, calcularKpis, crearEscenario,
  fmtEur, fmtPct, mbColor,
} from '@/lib/lanzamiento'
import type { CalcularCurvaParams } from '@/lib/lanzamiento'
import type { Lanzamiento, LanzamientoEscenario } from '@/types'

// ── Config de escenarios ──────────────────────────────────────────

const ESC_CFG = [
  { idx: 0, key: 'pesimista', label: 'Pesimista', color: '#C0392B', bg: 'rgba(192,57,43,0.05)', border: 'rgba(192,57,43,0.25)' },
  { idx: 1, key: 'base',      label: 'Base',      color: '#00557f', bg: 'rgba(0,85,127,0.05)',  border: 'rgba(0,85,127,0.25)'  },
  { idx: 2, key: 'optimista', label: 'Optimista', color: '#3A9E6A', bg: 'rgba(58,158,106,0.05)', border: 'rgba(58,158,106,0.25)' },
] as const

// ── Payback ───────────────────────────────────────────────────────

interface PaybackResult {
  ebitdaPct:     number
  margenMensual: number | null  // €MB generados por mes (base para el payback)
  paybackMeses:  number | null  // inversión / margenMensual
}

function calcPayback(
  kpis:            LanzamientoEscenario['kpis'],
  opexPersonalPct: number,
  opexGastosPct:   number,
  inversionTotal:  number,
): PaybackResult {
  const ebitdaPct = kpis.margen_pct - opexPersonalPct - opexGastosPct

  if (inversionTotal < 100 || kpis.ingresos <= 0 || kpis.margen_pct <= 0) {
    return { ebitdaPct, margenMensual: null, paybackMeses: null }
  }

  // Payback basado en margen bruto:
  // la inversión (stock + marketing) se recupera con los €MB generados cada mes,
  // no con el EBITDA (que ya descuenta OPEX estructural que existe con o sin el lanzamiento).
  // 16 semanas ≈ 4 meses de ventas
  const ingresosMensuales = kpis.ingresos / 4
  const margenMensual     = ingresosMensuales * (kpis.margen_pct / 100)

  if (margenMensual <= 0) return { ebitdaPct, margenMensual: null, paybackMeses: null }

  return {
    ebitdaPct,
    margenMensual: Math.round(margenMensual),
    paybackMeses:  Math.round((inversionTotal / margenMensual) * 10) / 10,
  }
}

function fmtPayback(m: number | null): string {
  if (m == null) return '—'
  if (m < 1)     return '< 1 mes'
  if (m >= 99)   return '> 99 meses'
  return `${m.toFixed(1).replace('.', ',')} meses`
}

function paybackColor(m: number | null): string {
  if (m == null)  return '#8fa8b8'
  if (m > 12)     return '#C0392B'
  if (m > 6)      return '#C8842A'
  return '#3A9E6A'
}

function ebitdaColor(pct: number): string {
  if (pct >= 15) return '#3A9E6A'
  if (pct >= 5)  return '#C8842A'
  return '#C0392B'
}

// ── Derivar PVP y coste según el tipo de lanzamiento ─────────────
// SKU:   precio_venta y coste directamente de la BD
// Drop:  promedio de familias_drop
// Marca: precio medio de arquitectura_precios + coste estimado por MB objetivo

function derivePvp(lanz: Lanzamiento): number | null {
  if (lanz.precio_venta) return lanz.precio_venta
  if (lanz.tipo === 'marca' && lanz.arquitectura_precios) {
    const medios = Object.values(lanz.arquitectura_precios)
      .map(f => f.medio)
      .filter((v): v is number => v != null)
    if (medios.length > 0) return Math.round(medios.reduce((a, b) => a + b, 0) / medios.length)
  }
  if (lanz.tipo === 'drop' && Array.isArray(lanz.familias_drop) && lanz.familias_drop.length > 0) {
    const precios = lanz.familias_drop.map(f => f.precio_medio).filter((v): v is number => v != null)
    if (precios.length > 0) return Math.round(precios.reduce((a, b) => a + b, 0) / precios.length)
  }
  return null
}

function deriveCoste(lanz: Lanzamiento, pvp: number | null): number | null {
  if (lanz.coste) return lanz.coste
  if (lanz.tipo === 'drop' && Array.isArray(lanz.familias_drop) && lanz.familias_drop.length > 0) {
    const costes = lanz.familias_drop.map(f => f.coste_medio).filter((v): v is number => v != null)
    if (costes.length > 0) return Math.round(costes.reduce((a, b) => a + b, 0) / costes.length)
  }
  if (lanz.tipo === 'marca' && pvp) {
    // Estimación de coste por posicionamiento si no hay coste explícito
    const mbPct = { premium: 0.52, media: 0.56, accesible: 0.48 }[lanz.posicionamiento_marca ?? ''] ?? 0.55
    return Math.round(pvp * (1 - mbPct))
  }
  return null
}

function deriveUnidades(lanz: Lanzamiento): number {
  if (lanz.unidades_compra_total) return lanz.unidades_compra_total
  if (lanz.unidades_por_tienda && lanz.n_tiendas) return lanz.unidades_por_tienda * lanz.n_tiendas
  return 0
}

// ── Inicializar escenarios ────────────────────────────────────────

function initEscenarios(lanz: Lanzamiento): LanzamientoEscenario[] {
  if (Array.isArray(lanz.escenarios) && lanz.escenarios.length === 3) {
    return lanz.escenarios
  }

  const pvp   = derivePvp(lanz) ?? 0
  const coste = deriveCoste(lanz, pvp || null) ?? 0

  const base: CalcularCurvaParams = {
    unidadesTotalCompra:   deriveUnidades(lanz),
    semanasRampa:          lanz.semanas_rampa ?? 3,
    crecimientoSemanalPct: lanz.crecimiento_semanal_pct ?? 5,
    factorAjustePct:       lanz.factor_ajuste_pct ?? 100,
    precioVenta:           pvp,
    coste:                 coste,
    descuentoPct:          lanz.descuento_promo_pct ?? 0,
    semanasPromo:          lanz.semanas_promo ?? 0,
  }

  const rampa = base.semanasRampa          ?? 3
  const crec  = base.crecimientoSemanalPct ?? 5

  // ── Drop: ventana fija sin reposición ────────────────────────
  // Pesimista: sell-through 50% · Base: 75% · Optimista: 100% (una semana antes)
  if (lanz.tipo === 'drop') {
    return [
      crearEscenario('Pesimista', {
        ...base,
        factorAjustePct:       50,
        semanasRampa:          Math.min(8, rampa + 2),
        crecimientoSemanalPct: Math.max(0, crec - 2),
      }),
      crearEscenario('Base', { ...base, factorAjustePct: 75 }, true),
      crearEscenario('Optimista', {
        ...base,
        factorAjustePct:       100,
        semanasRampa:          Math.max(1, rampa - 1),
        crecimientoSemanalPct: Math.min(25, crec + 4),
      }),
    ]
  }

  // ── Marca: hay reposición, ventana más amplia ─────────────────
  // Pesimista: sell-through 50% · Base: 60% · Optimista: 75%
  if (lanz.tipo === 'marca') {
    return [
      crearEscenario('Pesimista', { ...base, factorAjustePct: 50 }),
      crearEscenario('Base',      { ...base, factorAjustePct: 60 }, true),
      crearEscenario('Optimista', { ...base, factorAjustePct: 75 }),
    ]
  }

  // ── SKU: relativo al factor configurado (default 80%) ─────────
  const stBase = base.factorAjustePct ?? 80
  return [
    crearEscenario('Pesimista', {
      ...base,
      factorAjustePct:       Math.max(30, stBase - 25),
      semanasRampa:          Math.min(12, rampa + 3),
      crecimientoSemanalPct: Math.max(0,  crec - 3),
    }),
    crearEscenario('Base', { ...base, factorAjustePct: stBase }, true),
    crearEscenario('Optimista', {
      ...base,
      factorAjustePct:       Math.min(110, stBase + 20),
      semanasRampa:          Math.max(1,   rampa - 1),
      crecimientoSemanalPct: Math.min(30,  crec + 5),
    }),
  ]
}

function paramsOf(e: LanzamientoEscenario): CalcularCurvaParams {
  return e.params as unknown as CalcularCurvaParams
}

// ── Mini KPI ──────────────────────────────────────────────────────

function KpiMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>{label}</p>
      <p className="text-[13px] font-black leading-tight" style={{ color: color ?? '#00264d' }}>{value}</p>
    </div>
  )
}

// ── Stepper compacto ──────────────────────────────────────────────

function Stepper({
  label, value, unit, min, max, step = 1, onChange,
}: {
  label: string; value: number; unit: string
  min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8fa8b8' }}>{label}</p>
      <div className="flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,85,127,0.15)' }}>
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 flex items-center justify-center text-[16px] hover:bg-[rgba(0,85,127,0.05)]"
          style={{ color: '#00557f' }}
        >
          −
        </button>
        <div className="px-2 h-8 flex items-center justify-center min-w-[52px] bg-white border-x border-[rgba(0,85,127,0.12)]">
          <span className="text-[13px] font-black" style={{ color: '#00264d' }}>{value}{unit}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 flex items-center justify-center text-[16px] hover:bg-[rgba(0,85,127,0.05)]"
          style={{ color: '#00557f' }}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Tooltip informativo ───────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="relative inline-flex items-center group flex-shrink-0">
      <div
        className="w-[15px] h-[15px] rounded-full flex items-center justify-center cursor-default"
        style={{ background: 'rgba(0,85,127,0.1)', color: '#8fa8b8' }}
      >
        <span className="text-[9px] font-bold leading-none select-none">?</span>
      </div>
      {/* Bubble */}
      <div
        className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-xl text-[11px] leading-snug
                   opacity-0 group-hover:opacity-100 transition-opacity duration-150
                   pointer-events-none z-30 shadow-lg"
        style={{ background: '#00264d', color: 'rgba(255,255,255,0.88)' }}
      >
        {text}
        {/* Arrow */}
        <span
          className="absolute top-full left-3"
          style={{
            display: 'block', width: 0, height: 0,
            borderLeft:  '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop:   '5px solid #00264d',
          }}
        />
      </div>
    </div>
  )
}

// ── Fila de slider con tooltip ────────────────────────────────────

function SliderRow({
  label, value, unit, min, max, step = 1,
  marks, tooltip, color, onChange,
}: {
  label:   string
  value:   number
  unit:    string
  min:     number
  max:     number
  step?:   number
  marks:   string[]
  tooltip: string
  color:   string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Label + tooltip */}
      <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: 148 }}>
        <span className="text-[11px]" style={{ color: '#8fa8b8' }}>{label}</span>
        <InfoTooltip text={tooltip} />
      </div>
      {/* Slider */}
      <div className="flex-1">
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="tq-slider w-full"
          style={{ '--thumb-color': color } as React.CSSProperties}
        />
        <div className="flex justify-between text-[9px] mt-1" style={{ color: '#8fa8b8' }}>
          {marks.map(m => <span key={m}>{m}</span>)}
        </div>
      </div>
      {/* Valor */}
      <span
        className="text-[13px] font-bold flex-shrink-0 text-right"
        style={{ color, width: 48 }}
      >
        {value}{unit}
      </span>
    </div>
  )
}

// ── Card de escenario (ancho completo, controles siempre visibles) ─

function EscenarioCard({
  esc, cfg, onUpdate,
  ebitdaPct, margenMensual, paybackMeses,
}: {
  esc:           LanzamientoEscenario
  cfg:           typeof ESC_CFG[number]
  onUpdate:      (field: keyof CalcularCurvaParams, value: number) => void
  ebitdaPct:     number
  margenMensual: number | null
  paybackMeses:  number | null
}) {
  const p    = paramsOf(esc)
  const k    = esc.kpis
  const beOk = k.breakeven_semanas <= 8

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border:     `1.5px solid ${cfg.border}`,
        background: 'white',
        boxShadow:  'var(--tq-shadow-xs)',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{ background: `${cfg.color}0d`, borderBottom: `1px solid ${cfg.border}` }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${cfg.color}18`, color: cfg.color }}
        >
          ST {p.factorAjustePct ?? 100}%
        </span>
      </div>

      {/* ── KPIs: fila de 6 métricas ─────────────────── */}
      <div
        className="px-5 py-4 grid"
        style={{
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 0,
          borderBottom: `1px solid ${cfg.border}`,
        }}
      >
        {/* Uds vendidas */}
        <div className="pr-4">
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
            Uds vendidas
          </p>
          <p className="text-[24px] font-bold leading-none" style={{ color: cfg.color }}>
            {k.unidades_total.toLocaleString('es-ES')}
          </p>
          <p className="text-[9px] mt-1" style={{ color: '#8fa8b8' }}>en 16 semanas</p>
        </div>

        {/* Ingresos */}
        <div className="px-4" style={{ borderLeft: `1px solid ${cfg.border}` }}>
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>Ingresos</p>
          <p className="text-[18px] font-bold leading-none" style={{ color: '#00264d' }}>
            {fmtEur(k.ingresos)}
          </p>
        </div>

        {/* MB */}
        <div className="px-4" style={{ borderLeft: `1px solid ${cfg.border}` }}>
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>Margen bruto</p>
          <p className="text-[18px] font-bold leading-none" style={{ color: mbColor(k.margen_pct) }}>
            {fmtPct(k.margen_pct, 0)}
          </p>
        </div>

        {/* Break-even */}
        <div className="px-4" style={{ borderLeft: `1px solid ${cfg.border}` }}>
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>Break-even</p>
          <p className="text-[18px] font-bold leading-none" style={{ color: beOk ? '#3A9E6A' : '#C8842A' }}>
            {k.breakeven_semanas < 99 ? `Sem. ${k.breakeven_semanas}` : 'No alc.'}
          </p>
        </div>

        {/* EBITDA */}
        <div className="px-4" style={{ borderLeft: `1px solid ${cfg.border}` }}>
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>EBITDA</p>
          <p className="text-[18px] font-bold leading-none" style={{ color: ebitdaColor(ebitdaPct) }}>
            {fmtPct(ebitdaPct, 0)}
          </p>
          <p className="text-[9px] mt-1" style={{ color: '#8fa8b8' }}>MB − OPEX</p>
        </div>

        {/* Payback */}
        <div className="pl-4" style={{ borderLeft: `1px solid ${cfg.border}` }}>
          <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>Payback</p>
          <p className="text-[18px] font-bold leading-none" style={{ color: paybackColor(paybackMeses) }}>
            {fmtPayback(paybackMeses)}
          </p>
          {margenMensual != null && (
            <p className="text-[9px] mt-1" style={{ color: '#8fa8b8' }}>
              {fmtEur(margenMensual)}/mes MB
            </p>
          )}
        </div>
      </div>

      {/* ── Sliders siempre visibles ──────────────────── */}
      <div
        className="px-5 py-4 space-y-4"
        style={{ background: 'rgba(0,85,127,0.012)' }}
      >
        <SliderRow
          label="Sell-through"
          value={p.factorAjustePct ?? 100}
          unit="%"
          min={20} max={110} step={5}
          marks={['20%', '50%', '75%', '100%']}
          tooltip="Porcentaje del stock comprado que se venderá en la ventana de 16 semanas. ST 75% = de 100 uds compradas se venden 75. El resto queda como stock remanente al final de la ventana."
          color={cfg.color}
          onChange={v => onUpdate('factorAjustePct', v)}
        />
        <SliderRow
          label="Rampa de despegue"
          value={p.semanasRampa ?? 3}
          unit=" sem."
          min={1} max={12} step={1}
          marks={['1 (rápida)', '4 sem.', '8 sem.', '12 (lenta)']}
          tooltip="Semanas que tarda el producto en alcanzar su velocidad normal de ventas. En joyería suele ser 3-4 semanas: el equipo aprende el producto y el cliente lo descubre. Escaparate y RRSS desde el día 1 pueden acortarla a 1-2 semanas."
          color={cfg.color}
          onChange={v => onUpdate('semanasRampa', v)}
        />
        <SliderRow
          label="Crec. post-rampa"
          value={p.crecimientoSemanalPct ?? 5}
          unit="%"
          min={0} max={30} step={1}
          marks={['0% (plano)', '10%', '20%', '30%']}
          tooltip="Ritmo de aceleración de ventas tras la rampa. Un 5%/sem significa que cada semana se vende un 5% más que la anterior. La plata puede crecer más rápido que el oro. Combinado con ST 100% produce una curva muy agresiva que vende todo antes de la semana 15."
          color={cfg.color}
          onChange={v => onUpdate('crecimientoSemanalPct', v)}
        />
      </div>
    </div>
  )
}

// ── Render de la respuesta IA ─────────────────────────────────────
// Convierte **negrita** y líneas con - en elementos con estilo

function AiInsightsPanel({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim() !== '')
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const isBullet  = line.trim().startsWith('-')
        const content   = isBullet ? line.trim().slice(1).trim() : line.trim()
        // Bold: **texto**
        const parts = content.split(/\*\*(.+?)\*\*/g)
        const rendered = parts.map((part, j) =>
          j % 2 === 1
            ? <strong key={j} style={{ color: '#00264d', fontWeight: 700 }}>{part}</strong>
            : <span key={j}>{part}</span>
        )

        if (isBullet) {
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#00557f', marginTop: 7 }} />
              <p className="text-[13px] leading-relaxed" style={{ color: '#3a5a72' }}>{rendered}</p>
            </div>
          )
        }
        // ¿Es un titular (línea corta con negrita al inicio)?
        const isTitle = /^\*\*/.test(line.trim())
        return (
          <p
            key={i}
            className={`text-[13px] leading-relaxed ${isTitle ? 'mt-4 first:mt-0' : ''}`}
            style={{ color: isTitle ? '#00264d' : '#3a5a72' }}
          >
            {rendered}
          </p>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────

export function PasoSimulador({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [escenarios,   setEscenarios]   = useState<LanzamientoEscenario[]>(() => {
    const esc = initEscenarios(lanzamiento)
    // Re-seed si los escenarios guardados tienen PVP=0 pero ahora tenemos valores derivados
    const pvp   = derivePvp(lanzamiento)
    const coste = deriveCoste(lanzamiento, pvp)
    const uds   = deriveUnidades(lanzamiento)
    const firstPvp = (esc[0]?.params as { precioVenta?: number })?.precioVenta ?? 0
    if (pvp && coste && uds > 0 && firstPvp === 0) {
      return initEscenarios({
        ...lanzamiento,
        precio_venta:         pvp,
        coste:                coste,
        unidades_compra_total: uds,
      })
    }
    return esc
  })
  const [exporting,       setExporting]       = useState(false)
  const [confirming,      setConfirming]      = useState(false)
  const [aiInsights,      setAiInsights]      = useState<string | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)

  // ── OPEX ───────────────────────────────────────────────────────
  const [opexPersonalPct, setOpexPersonalPct] = useState(lanzamiento.opex_personal_pct ?? 12)
  const [opexGastosPct,   setOpexGastosPct]   = useState(lanzamiento.opex_gastos_pct   ?? 9)

  function handleOpexPersonal(v: number) {
    const safe = Math.max(0, Math.min(40, v))
    setOpexPersonalPct(safe)
    save({ opex_personal_pct: safe })
  }
  function handleOpexGastos(v: number) {
    const safe = Math.max(0, Math.min(30, v))
    setOpexGastosPct(safe)
    save({ opex_gastos_pct: safe })
  }

  // ── Valores efectivos (derivados según tipo) ───────────────────
  const efectivoPvp    = derivePvp(lanzamiento)
  const efectivoCoste  = deriveCoste(lanzamiento, efectivoPvp)
  const efectivoUds    = deriveUnidades(lanzamiento)

  // ── Inversión total ────────────────────────────────────────────
  const presupuestoCompra = lanzamiento.output_presupuesto_compra
    ?? (efectivoCoste && efectivoUds
        ? Math.round(efectivoCoste * efectivoUds)
        : 0)
  const presupuestoMarketing = lanzamiento.presupuesto_marketing ?? 0
  const inversionTotal       = presupuestoCompra + presupuestoMarketing

  // ── Payback por escenario ──────────────────────────────────────
  const paybacks = useMemo(
    () => escenarios.map(e => calcPayback(e.kpis, opexPersonalPct, opexGastosPct, inversionTotal)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(escenarios), opexPersonalPct, opexGastosPct, inversionTotal],
  )

  // ── Gate: ¿hay suficientes datos para simular? ─────────────────
  const canCompute = !!(efectivoPvp && efectivoCoste && efectivoUds > 0)

  // Mensaje de qué falta según el tipo
  const missingMsg = !canCompute ? (() => {
    if (lanzamiento.tipo === 'marca') {
      if (!lanzamiento.arquitectura_precios || Object.keys(lanzamiento.arquitectura_precios).length === 0)
        return 'Completa la arquitectura de precios (Paso 4) para ver el simulador.'
      if (!efectivoUds)
        return 'Completa la distribución (Paso 5) para ver el simulador.'
    }
    if (lanzamiento.tipo === 'drop') {
      if (!Array.isArray(lanzamiento.familias_drop) || lanzamiento.familias_drop.length === 0)
        return 'Añade las familias del drop (Paso 3) para ver el simulador.'
      if (!efectivoUds)
        return 'Completa la distribución (Paso 4) para ver el simulador.'
    }
    return 'Completa PVP, coste y distribución para ver el simulador.'
  })() : null

  // ── Curvas ─────────────────────────────────────────────────────
  const curves = useMemo(
    () => escenarios.map(e => canCompute ? calcularCurva(paramsOf(e)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(escenarios), canCompute],
  )

  const chartData = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      semana:    i + 1,
      pesimista: curves[0]?.[i]?.unidades ?? 0,
      base:      curves[1]?.[i]?.unidades ?? 0,
      optimista: curves[2]?.[i]?.unidades ?? 0,
    })),
    [curves],
  )

  // ── Handlers ───────────────────────────────────────────────────

  function handleUpdateEscenario(idx: number, field: keyof CalcularCurvaParams, value: number) {
    const updated = escenarios.map((e, i) => {
      if (i !== idx) return e
      const params = { ...paramsOf(e), [field]: value }
      const curva  = calcularCurva(params)
      const kpis   = calcularKpis(curva, params)
      return {
        ...e,
        params,
        kpis: {
          unidades_total:    Math.round(kpis.unidades_total),
          ingresos:          Math.round(kpis.ingresos),
          margen_bruto:      Math.round(kpis.margen_bruto),
          margen_pct:        Math.round(kpis.margen_pct * 10) / 10,
          breakeven_semanas: kpis.breakeven_semanas ?? 99,
        },
      }
    })
    setEscenarios(updated)
    save({ escenarios: updated })
  }

  async function handleAiInsights() {
    setLoadingInsights(true)
    setAiInsights(null)
    try {
      const res = await fetch(`/api/lanzamiento/${lanzamiento.id}/insights`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre:          lanzamiento.nombre,
          tipo:            lanzamiento.tipo,
          inversionTotal,
          opexPersonalPct,
          opexGastosPct,
          escenarios,
          paybacks,
        }),
      })
      const data = await res.json() as { insights: string }
      setAiInsights(data.insights ?? null)
    } catch {
      setAiInsights('Error generando conclusiones. Inténtalo de nuevo.')
    } finally {
      setLoadingInsights(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res  = await fetch(`/api/lanzamiento/${lanzamiento.id}/export-excel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ escenarios, opexPersonalPct, opexGastosPct }),
      })
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `briefing-${(lanzamiento.nombre ?? lanzamiento.id).slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleNext() {
    if (!confirming) { setConfirming(true); return }
    await flush()
    const escBase      = escenarios[1]
    const paybackBase  = paybacks[1]
    await fetch(`/api/lanzamiento/${lanzamiento.id}/confirmar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        escenarios,
        output_unidades_total:     escBase?.kpis.unidades_total    ?? null,
        output_margen_proyectado:  escBase?.kpis.margen_pct        ?? null,
        output_breakeven_semanas:  escBase?.kpis.breakeven_semanas ?? null,
        output_presupuesto_compra: presupuestoCompra || null,
        output_ebitda_pct:         paybackBase?.ebitdaPct          ?? null,
        output_payback_meses:      paybackBase?.paybackMeses        ?? null,
      }),
    })
    router.push('/lanzamiento')
  }

  return (
    <WizardLayout
      step={7}
      tipo={lanzamiento.tipo}
      lanzamientoId={lanzamiento.id}
      title="Simulador de escenarios"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-7"
        concepto="Los escenarios están definidos por sell-through (% del stock vendido en la ventana). Drop — Pesimista: 50% ST · Base: 75% ST · Optimista: 100% ST (todo vendido una semana antes). Marca — Base: 60% ST · Optimista: 75% ST (hay reposición, ventana más amplia). El payback usa el margen bruto mensual —no el EBITDA— porque el OPEX es estructura que existe con o sin el lanzamiento. Objetivo del equipo: payback entre 4 y 6 meses."
        ejemplo="Drop de San Valentín: 65 uds compradas, ST base 75% → 49 uds vendidas en 16 semanas. 3.800€ inversión, MB 63%, margen mensual ~1.500€ → payback 2,5 meses ✓. Si el payback supera 6 meses, reducir el stock inicial o revisar el mix."
        consecuencia="Confirmar es irreversible — el lanzamiento pasa al historial. Descarga el briefing antes si lo necesitas."
      />

      {!canCompute && missingMsg && (
        <div className="rounded-xl p-6 text-center mb-6" style={{ background: 'rgba(200,132,42,0.05)', border: '1px solid rgba(200,132,42,0.15)' }}>
          <p className="text-[13px] font-medium" style={{ color: '#a06818' }}>{missingMsg}</p>
        </div>
      )}

      {canCompute && (
        <>
          {/* ── Rentabilidad operativa ──────────────────────── */}
          <div
            className="rounded-xl p-4 mb-6"
            style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.1)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: '#8fa8b8' }}>
              Estructura de costes operativos
            </p>

            {/* Steppers OPEX */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Stepper label="% Personal" value={opexPersonalPct} unit="%" min={0} max={40} onChange={handleOpexPersonal} />
              <Stepper label="% Gastos operativos" value={opexGastosPct} unit="%" min={0} max={30} onChange={handleOpexGastos} />
            </div>

            {/* Resumen de inversión */}
            <div
              className="rounded-lg px-3 py-2 mb-3 text-[11px]"
              style={{ background: 'rgba(0,85,127,0.05)', border: '1px solid rgba(0,85,127,0.08)' }}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <span style={{ color: '#8fa8b8' }}>
                  Compra stock: <strong style={{ color: '#00264d' }}>{fmtEur(presupuestoCompra)}</strong>
                </span>
                <span style={{ color: '#8fa8b8' }}>+</span>
                <span style={{ color: '#8fa8b8' }}>
                  Marketing: <strong style={{ color: '#00264d' }}>{fmtEur(presupuestoMarketing)}</strong>
                  {presupuestoMarketing === 0 && (
                    <span className="ml-1 text-[9px]" style={{ color: '#8fa8b8' }}>
                      (añade en Paso 6)
                    </span>
                  )}
                </span>
                <span style={{ color: '#8fa8b8' }}>→</span>
                <span>
                  <span style={{ color: '#8fa8b8' }}>Inversión total: </span>
                  <strong style={{ color: '#00557f', fontSize: 13 }}>{fmtEur(inversionTotal)}</strong>
                </span>
              </div>
            </div>

            {/* KPIs del escenario Base */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center rounded-lg py-2" style={{ background: 'white', border: '1px solid rgba(0,85,127,0.08)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>OPEX Total</p>
                <p className="text-[16px] font-black" style={{ color: '#00264d' }}>
                  {opexPersonalPct + opexGastosPct}%
                </p>
                <p className="text-[9px]" style={{ color: '#6b8a9a' }}>personal + gastos</p>
              </div>
              <div className="text-center rounded-lg py-2" style={{ background: 'white', border: '1px solid rgba(0,85,127,0.08)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>EBITDA Base</p>
                <p className="text-[16px] font-black" style={{ color: ebitdaColor(paybacks[1]?.ebitdaPct ?? 0) }}>
                  {fmtPct(paybacks[1]?.ebitdaPct ?? 0, 0)}
                </p>
                <p className="text-[9px]" style={{ color: '#6b8a9a' }}>MB − OPEX</p>
              </div>
              <div className="text-center rounded-lg py-2" style={{ background: 'white', border: '1px solid rgba(0,85,127,0.08)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>Payback Base</p>
                <p className="text-[16px] font-black" style={{ color: paybackColor(paybacks[1]?.paybackMeses ?? null) }}>
                  {paybacks[1]?.paybackMeses != null ? `${paybacks[1].paybackMeses} m.` : 'n/a'}
                </p>
                <p className="text-[9px]" style={{ color: '#6b8a9a' }}>
                  {paybacks[1]?.margenMensual != null
                    ? `${fmtEur(paybacks[1].margenMensual)}/mes MB`
                    : 'sobre margen bruto'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Escenarios apilados, ancho completo ────────── */}
          <div className="mb-6">
            <label className="block text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#8fa8b8' }}>
              Tres escenarios — ajusta sell-through, rampa y crecimiento
            </label>
            <div className="space-y-4">
              {ESC_CFG.map((cfg, i) => (
                <EscenarioCard
                  key={cfg.key}
                  esc={escenarios[i]}
                  cfg={cfg}
                  onUpdate={(field, value) => handleUpdateEscenario(i, field, value)}
                  ebitdaPct={paybacks[i]?.ebitdaPct ?? 0}
                  margenMensual={paybacks[i]?.margenMensual ?? null}
                  paybackMeses={paybacks[i]?.paybackMeses ?? null}
                />
              ))}
            </div>
          </div>

          {/* ── Gráfico multi-curva ─────────────────────────── */}
          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(0,85,127,0.08)' }}>
            <div className="px-4 py-2.5 flex items-center gap-4" style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                Curvas comparadas — 16 semanas
              </span>
              <div className="flex items-center gap-4 ml-auto">
                {ESC_CFG.map(cfg => (
                  <div key={cfg.key} className="flex items-center gap-1.5">
                    <div className="w-5 h-0.5 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-[9px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-white">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
                  <XAxis dataKey="semana" tickFormatter={(v: number) => `S${v}`} tick={{ fontSize: 9, fill: '#b2b2b2' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#b2b2b2' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,32,60,0.12)', border: 'none' }}
                    labelFormatter={(v) => `Semana ${v}`}
                    formatter={(v) => `${Math.round(Number(v ?? 0))} uds`}
                  />
                  {ESC_CFG.map((cfg, i) => (
                    <Line key={cfg.key} type="monotone" dataKey={cfg.key} stroke={cfg.color} strokeWidth={i === 1 ? 2.5 : 1.5} dot={false} activeDot={{ r: 4, fill: cfg.color, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tabla comparativa ───────────────────────────── */}
          <div className="tq-table-wrap mb-6">
            <table className="tq-table">
              <thead>
                <tr>
                  <th>KPI</th>
                  {ESC_CFG.map(c => (
                    <th key={c.key} className="right" style={{ color: c.color }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: 'Uds. totales 16 sem.',
                    vals:    escenarios.map(e => e.kpis.unidades_total.toLocaleString('es-ES') + ' uds'),
                    colorFn: () => '#00264d',
                  },
                  {
                    label: 'Ingresos proy.',
                    vals:    escenarios.map(e => fmtEur(e.kpis.ingresos)),
                    colorFn: () => '#00557f',
                  },
                  {
                    label: 'Margen bruto %',
                    vals:    escenarios.map(e => fmtPct(e.kpis.margen_pct, 0)),
                    colorFn: (_: string, i: number) => mbColor(escenarios[i].kpis.margen_pct),
                  },
                  {
                    label: 'EBITDA %',
                    vals:    paybacks.map(p => fmtPct(p.ebitdaPct, 0)),
                    colorFn: (_: string, i: number) => ebitdaColor(paybacks[i].ebitdaPct),
                  },
                  {
                    label: 'Break-even (stock)',
                    vals:    escenarios.map(e => e.kpis.breakeven_semanas < 99 ? `Sem. ${e.kpis.breakeven_semanas}` : 'No alc.'),
                    colorFn: (_: string, i: number) => escenarios[i].kpis.breakeven_semanas <= 8 ? '#3A9E6A' : '#C8842A',
                  },
                  {
                    label: 'Payback inversión',
                    vals:    paybacks.map(p => p.paybackMeses != null ? `${p.paybackMeses} meses` : 'n/a'),
                    colorFn: (_: string, i: number) => paybackColor(paybacks[i].paybackMeses),
                  },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="font-medium text-[12px]" style={{ color: '#8fa8b8' }}>{row.label}</td>
                    {row.vals.map((v, i) => (
                      <td key={i} className="right font-bold font-mono text-[12px]"
                        style={{ color: row.colorFn(v, i) }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Export + Confirmar ──────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{ background: confirming ? 'rgba(192,57,43,0.04)' : 'rgba(0,85,127,0.03)', border: `1px solid ${confirming ? 'rgba(192,57,43,0.2)' : 'rgba(0,85,127,0.1)'}` }}
          >
            {!confirming ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: '#00264d' }}>
                      ¿Listo para confirmar este lanzamiento?
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#8fa8b8' }}>
                      Descarga el briefing Excel antes de confirmar. Al confirmar el lanzamiento pasará al historial.
                    </p>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 shrink-0"
                    style={{ background: 'rgba(58,158,106,0.1)', color: '#2d7a54', border: '1.5px solid rgba(58,158,106,0.25)' }}
                  >
                    {exporting ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-[rgba(45,122,84,0.3)] border-t-[#2d7a54] rounded-full animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <><span>↓</span> Descargar briefing Excel</>
                    )}
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: '#6b8a9a' }}>
                  El botón «Confirmar lanzamiento ✓» en la barra inferior pedirá una confirmación final.
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-bold mb-1.5" style={{ color: '#C0392B' }}>
                  ⚠ Confirmación final — acción irreversible
                </p>
                <p className="text-[12px] mb-4 leading-relaxed" style={{ color: '#5c4019' }}>
                  Al confirmar, <strong>{lanzamiento.nombre ?? 'este lanzamiento'}</strong> pasará al historial de confirmados.
                  Los KPIs del escenario Base (incluido payback de{' '}
                  <strong>{paybacks[1]?.paybackMeses != null ? `${paybacks[1].paybackMeses} meses` : 'n/a'}</strong>) quedarán como outputs.
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfirming(false)}
                    className="px-4 py-2 rounded-lg text-[12px] font-medium border transition-colors hover:bg-[rgba(0,85,127,0.05)]"
                    style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#8fa8b8' }}
                  >
                    Cancelar
                  </button>
                  <p className="text-[11px]" style={{ color: '#8fa8b8' }}>
                    ↑ Pulsa «Confirmar lanzamiento ✓» en la barra inferior para completar
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Conclusiones IA ─────────────────────────── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1.5px solid rgba(0,85,127,0.12)' }}
          >
            {/* Header */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.08)' }}
            >
              <div>
                <p className="text-[12px] font-bold" style={{ color: '#00264d' }}>
                  Conclusiones del simulador
                </p>
                <p className="text-[11px]" style={{ color: '#8fa8b8' }}>
                  Análisis de viabilidad generado por IA sobre los tres escenarios
                </p>
              </div>
              <button
                onClick={handleAiInsights}
                disabled={loadingInsights}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-60"
                style={{
                  background: loadingInsights ? 'rgba(0,85,127,0.08)' : '#00557f',
                  color:      loadingInsights ? '#8fa8b8' : 'white',
                  border:     '1.5px solid rgba(0,85,127,0.2)',
                }}
              >
                {loadingInsights ? (
                  <>
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#8fa8b8', borderTopColor: 'transparent' }}
                    />
                    Analizando…
                  </>
                ) : (
                  <><span>✦</span> {aiInsights ? 'Regenerar' : 'Generar con IA'}</>
                )}
              </button>
            </div>

            {/* Resultado */}
            {aiInsights ? (
              <div className="px-5 py-5">
                <AiInsightsPanel text={aiInsights} />
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px]" style={{ color: '#8fa8b8' }}>
                  Pulsa «Generar con IA» para obtener una valoración de los tres escenarios, identificar el más probable y recibir recomendaciones antes de confirmar.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </WizardLayout>
  )
}
