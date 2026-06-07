'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ResponsiveContainer,
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

// ── Inicializar escenarios desde lanzamiento ──────────────────────

function initEscenarios(lanz: Lanzamiento): LanzamientoEscenario[] {
  if (Array.isArray(lanz.escenarios) && lanz.escenarios.length === 3) {
    return lanz.escenarios
  }

  const base: CalcularCurvaParams = {
    unidadesPorTienda:     lanz.unidades_por_tienda ?? 2,
    nTiendas:              lanz.n_tiendas ?? 17,
    semanasRampa:          lanz.semanas_rampa ?? 3,
    crecimientoSemanalPct: lanz.crecimiento_semanal_pct ?? 5,
    factorAjustePct:       lanz.factor_ajuste_pct ?? 100,
    precioVenta:           lanz.precio_venta ?? 0,
    coste:                 lanz.coste ?? 0,
    descuentoPct:          lanz.descuento_promo_pct ?? 0,
    semanasPromo:          lanz.semanas_promo ?? 0,
  }

  return [
    crearEscenario('Pesimista', {
      ...base,
      factorAjustePct:       Math.max(50,  (base.factorAjustePct ?? 100) - 30),
      semanasRampa:          Math.min(12,  (base.semanasRampa ?? 3) + 3),
      crecimientoSemanalPct: Math.max(0,   (base.crecimientoSemanalPct ?? 5) - 3),
    }),
    crearEscenario('Base', base, true),
    crearEscenario('Optimista', {
      ...base,
      factorAjustePct:       Math.min(150, (base.factorAjustePct ?? 100) + 30),
      semanasRampa:          Math.max(1,   (base.semanasRampa ?? 3) - 1),
      crecimientoSemanalPct: Math.min(30,  (base.crecimientoSemanalPct ?? 5) + 5),
    }),
  ]
}

// ── Helpers ───────────────────────────────────────────────────────

function paramsOf(e: LanzamientoEscenario): CalcularCurvaParams {
  return e.params as unknown as CalcularCurvaParams
}

// ── Mini KPI ──────────────────────────────────────────────────────

function KpiMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#c0cfd8' }}>{label}</p>
      <p className="text-[13px] font-black leading-tight" style={{ color: color ?? '#00264d' }}>{value}</p>
    </div>
  )
}

// ── Card de escenario ─────────────────────────────────────────────

function EscenarioCard({
  esc, cfg, expanded, onToggle, onUpdate,
}: {
  esc:      LanzamientoEscenario
  cfg:      typeof ESC_CFG[number]
  expanded: boolean
  onToggle: () => void
  onUpdate: (field: keyof CalcularCurvaParams, value: number) => void
}) {
  const p = paramsOf(esc)
  const k = esc.kpis

  return (
    <div
      className="rounded-xl overflow-hidden flex-1"
      style={{ border: `2px solid ${expanded ? cfg.color : cfg.border}`, background: cfg.bg, boxShadow: expanded ? `0 0 0 3px ${cfg.color}18` : 'var(--tq-shadow-xs)' }}
    >
      {/* Header card */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={onToggle}
        style={{ borderBottom: `1px solid ${cfg.border}`, background: expanded ? `${cfg.color}10` : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <span className="text-[10px] font-medium" style={{ color: cfg.color }}>
          {expanded ? '▲ Cerrar' : '▼ Editar'}
        </span>
      </div>

      {/* KPIs principales */}
      <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-3">
        <KpiMini
          label="Uds. 16 sem."
          value={k.unidades_total.toLocaleString('es-ES')}
          color={cfg.color}
        />
        <KpiMini
          label="Ingresos"
          value={fmtEur(k.ingresos)}
        />
        <KpiMini
          label="MB %"
          value={fmtPct(k.margen_pct, 0)}
          color={mbColor(k.margen_pct)}
        />
        <KpiMini
          label="Break-even"
          value={k.breakeven_semanas < 99 ? `Sem. ${k.breakeven_semanas}` : 'No alc.'}
          color={k.breakeven_semanas <= 8 ? '#3A9E6A' : '#C8842A'}
        />
      </div>

      {/* Params badge strip */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {[
          { label: `Factor ${p.factorAjustePct ?? 100}%` },
          { label: `Rampa ${p.semanasRampa ?? 3} sem.` },
          { label: `+${p.crecimientoSemanalPct ?? 5}%/sem.` },
        ].map(b => (
          <span
            key={b.label}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${cfg.color}18`, color: cfg.color }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Panel de edición expandible */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: `1px solid ${cfg.border}`, paddingTop: 16 }}
        >
          {/* Factor */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>Factor</span>
              <span className="text-[12px] font-black" style={{ color: cfg.color }}>{p.factorAjustePct ?? 100}%</span>
            </div>
            <input
              type="range" min={50} max={150} step={5}
              value={p.factorAjustePct ?? 100}
              onChange={e => onUpdate('factorAjustePct', parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: cfg.color }}
            />
            <div className="flex justify-between text-[8px] mt-0.5" style={{ color: '#c0cfd8' }}>
              <span>50%</span><span>100%</span><span>150%</span>
            </div>
          </div>

          {/* Rampa */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>Rampa</span>
              <span className="text-[12px] font-black" style={{ color: cfg.color }}>{p.semanasRampa ?? 3} sem.</span>
            </div>
            <input
              type="range" min={1} max={12} step={1}
              value={p.semanasRampa ?? 3}
              onChange={e => onUpdate('semanasRampa', parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: cfg.color }}
            />
            <div className="flex justify-between text-[8px] mt-0.5" style={{ color: '#c0cfd8' }}>
              <span>1 sem.</span><span>6 sem.</span><span>12 sem.</span>
            </div>
          </div>

          {/* Crecimiento */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8fa8b8' }}>Crecimiento/semana</span>
              <span className="text-[12px] font-black" style={{ color: cfg.color }}>{p.crecimientoSemanalPct ?? 5}%</span>
            </div>
            <input
              type="range" min={0} max={30} step={1}
              value={p.crecimientoSemanalPct ?? 5}
              onChange={e => onUpdate('crecimientoSemanalPct', parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: cfg.color }}
            />
            <div className="flex justify-between text-[8px] mt-0.5" style={{ color: '#c0cfd8' }}>
              <span>0%</span><span>15%</span><span>30%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────

export function PasoSimulador({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [escenarios, setEscenarios] = useState<LanzamientoEscenario[]>(
    () => initEscenarios(lanzamiento),
  )
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [exporting,   setExporting]   = useState(false)
  const [confirming,  setConfirming]  = useState(false)

  const canCompute = !!(
    lanzamiento.precio_venta &&
    lanzamiento.coste &&
    lanzamiento.n_tiendas &&
    lanzamiento.unidades_por_tienda
  )

  // ── Curvas ─────────────────────────────────────────────────────
  const curves = useMemo(
    () => escenarios.map(e => canCompute ? calcularCurva(paramsOf(e)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(escenarios), canCompute],
  )

  const chartData = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      semana:    i + 1,
      pesimista: curves[0]?.[i]?.unidades ?? 0,
      base:      curves[1]?.[i]?.unidades ?? 0,
      optimista: curves[2]?.[i]?.unidades ?? 0,
    })),
    [curves],
  )

  // ── Handlers ───────────────────────────────────────────────────

  function handleUpdateEscenario(
    idx: number,
    field: keyof CalcularCurvaParams,
    value: number,
  ) {
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

  async function handleExport() {
    setExporting(true)
    try {
      const res  = await fetch(`/api/lanzamiento/${lanzamiento.id}/export-excel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ escenarios }),
      })
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const nombre  = (lanzamiento.nombre ?? lanzamiento.id).slice(0, 40)
      a.download = `briefing-${nombre}-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleNext() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    await flush()
    const escBase = escenarios[1]
    await fetch(`/api/lanzamiento/${lanzamiento.id}/confirmar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        escenarios,
        output_unidades_total:     escBase?.kpis.unidades_total ?? null,
        output_margen_proyectado:  escBase?.kpis.margen_pct ?? null,
        output_breakeven_semanas:  escBase?.kpis.breakeven_semanas ?? null,
        output_presupuesto_compra: (lanzamiento.coste && escBase)
          ? Math.round(escBase.kpis.unidades_total * lanzamiento.coste)
          : null,
      }),
    })
    router.push('/lanzamiento')
  }

  return (
    <WizardLayout
      step={7}
      lanzamientoId={lanzamiento.id}
      title="Simulador de escenarios"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-7"
        concepto="El simulador te permite comparar tres escenarios (pesimista, base, optimista) con parámetros independientes. El escenario Base usa los valores que definiste en pasos anteriores. Al confirmar, los KPIs del escenario Base se guardan como outputs del lanzamiento y aparecen en el listado de confirmados."
        ejemplo="En el lanzamiento de la colección de turmalinas, el pesimista proyectaba 280 uds y el optimista 650. El equipo se comprometió con el escenario Base (420 uds), que se alcanzó en la semana 14. El optimista habría requerido un stock adicional que no teníamos."
        consecuencia="Confirmar es irreversible en cuanto al estado — el lanzamiento pasa al historial. Puedes seguir leyendo su ficha, pero no editarlo como borrador."
      />

      {!canCompute && (
        <div
          className="rounded-xl p-6 text-center mb-6"
          style={{ background: 'rgba(200,132,42,0.05)', border: '1px solid rgba(200,132,42,0.15)' }}
        >
          <p className="text-[13px] font-medium" style={{ color: '#a06818' }}>
            Necesitas completar PVP, coste y distribución (Pasos 2 y 3) para ver el simulador.
          </p>
        </div>
      )}

      {canCompute && (
        <>
          {/* ── Escenarios en columnas ──────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
                Tres escenarios — ajusta los parámetros de cada uno
              </label>
              <span className="text-[10px]" style={{ color: '#c0cfd8' }}>
                Haz clic en una card para editar sus parámetros
              </span>
            </div>
            <div className="flex gap-3">
              {ESC_CFG.map((cfg, i) => (
                <EscenarioCard
                  key={cfg.key}
                  esc={escenarios[i]}
                  cfg={cfg}
                  expanded={expandedIdx === i}
                  onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  onUpdate={(field, value) => handleUpdateEscenario(i, field, value)}
                />
              ))}
            </div>
          </div>

          {/* ── Gráfico multi-curva ─────────────────────────── */}
          <div
            className="rounded-xl overflow-hidden mb-6"
            style={{ border: '1px solid rgba(0,85,127,0.08)' }}
          >
            <div
              className="px-4 py-2.5 flex items-center gap-4"
              style={{ background: 'rgba(0,85,127,0.04)', borderBottom: '1px solid rgba(0,85,127,0.06)' }}
            >
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
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,32,60,0.12)', border: 'none' }}
                    labelFormatter={(v) => `Semana ${v}`}
                    formatter={(v) => `${Math.round(Number(v ?? 0))} uds`}
                  />
                  {ESC_CFG.map((cfg, i) => (
                    <Line
                      key={cfg.key}
                      type="monotone"
                      dataKey={cfg.key}
                      stroke={cfg.color}
                      strokeWidth={i === 1 ? 2.5 : 1.5}
                      strokeDasharray={i === 1 ? undefined : undefined}
                      dot={false}
                      activeDot={{ r: 4, fill: cfg.color, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tabla comparativa resumida ──────────────────── */}
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
                    vals: escenarios.map(e => e.kpis.unidades_total.toLocaleString('es-ES') + ' uds'),
                    colors: escenarios.map(e => e.kpis.unidades_total),
                    colorFn: (v: number) => v > 0 ? '#00264d' : '#8fa8b8',
                  },
                  {
                    label: 'Ingresos proy.',
                    vals: escenarios.map(e => fmtEur(e.kpis.ingresos)),
                    colors: escenarios.map(e => e.kpis.ingresos),
                    colorFn: () => '#00557f',
                  },
                  {
                    label: 'Margen bruto %',
                    vals: escenarios.map(e => fmtPct(e.kpis.margen_pct, 0)),
                    colors: escenarios.map(e => e.kpis.margen_pct),
                    colorFn: (v: number) => mbColor(v),
                  },
                  {
                    label: 'Break-even',
                    vals: escenarios.map(e => e.kpis.breakeven_semanas < 99 ? `Sem. ${e.kpis.breakeven_semanas}` : 'No alc.'),
                    colors: escenarios.map(e => e.kpis.breakeven_semanas),
                    colorFn: (v: number) => v <= 8 ? '#3A9E6A' : v <= 16 ? '#C8842A' : '#C0392B',
                  },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="font-medium text-[12px]" style={{ color: '#8fa8b8' }}>{row.label}</td>
                    {row.vals.map((v, i) => (
                      <td key={i} className="right font-bold font-mono text-[12px]"
                        style={{ color: row.colorFn(row.colors[i]) }}>
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
                      Descarga el briefing Excel antes de confirmar. Al confirmar el lanzamiento pasará al historial de confirmados.
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
                      <>
                        <span>↓</span>
                        Descargar briefing Excel
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: '#b2b2b2' }}>
                  El botón «Confirmar lanzamiento ✓» en la barra inferior pedirá una confirmación final.
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-bold mb-1.5" style={{ color: '#C0392B' }}>
                  ⚠ Confirmación final — acción irreversible
                </p>
                <p className="text-[12px] mb-4 leading-relaxed" style={{ color: '#5c4019' }}>
                  Al confirmar, el lanzamiento <strong>{lanzamiento.nombre ?? 'este lanzamiento'}</strong> pasará
                  al historial de confirmados. Los KPIs del escenario Base quedarán como outputs.
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
        </>
      )}
    </WizardLayout>
  )
}
