'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { VentasSummary, Periodo } from '@/app/api/ventas/summary/route'
import type { VentasPorModelo } from '@/app/api/ventas/por-modelo/route'

const TQ_BLUE  = '#00557f'
const TQ_GOLD  = '#C8842A'
const TQ_GREEN = '#3A9E6A'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K €`
  return `${n.toLocaleString('es-ES')} €`
}

function fmtPrecio(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function pctChange(curr: number, prev: number) {
  if (!prev) return null
  return Math.round(((curr - prev) / prev) * 100)
}

// ── Periodo config ────────────────────────────────────────────────────────────

const PERIODOS: { key: Periodo; label: string; short: string }[] = [
  { key: '12m', label: 'Últimos 12M', short: 'últ. 12m' },
  { key: 'ytd', label: 'YTD',         short: 'YTD'      },
  { key: 'mtd', label: 'MTD',         short: 'MTD'      },
]

function filterEvolucion(evolucion: VentasSummary['evolucion'], periodo: Periodo) {
  const now    = new Date()
  const curAnyo = now.getFullYear()
  const curMes  = now.getMonth() + 1
  switch (periodo) {
    case 'ytd': return evolucion.filter(p => p.anyo === curAnyo)
    case 'mtd': return evolucion.slice(-6)  // últimos 6 meses de contexto
    default:    return evolucion.slice(-12) // 12m
  }
}

function periodoTotals(evolucion: VentasSummary['evolucion'], periodo: Periodo) {
  const now     = new Date()
  const curAnyo = now.getFullYear()
  const curMes  = now.getMonth() + 1
  let rows: typeof evolucion
  switch (periodo) {
    case 'ytd': rows = evolucion.filter(p => p.anyo === curAnyo); break
    case 'mtd': rows = evolucion.filter(p => p.anyo === curAnyo && p.mes === curMes); break
    default:    rows = evolucion.slice(-12)
  }
  const ing = rows.reduce((s, r) => s + r.ingresos, 0)
  const uds = rows.reduce((s, r) => s + r.unidades, 0)
  return { ingresos: ing, unidades: uds, ticket: uds > 0 ? ing / uds : 0 }
}

type CumulMetric = 'ingresos' | 'margen' | 'ticket' | 'unidades'

const CUMUL_CONFIG: Record<CumulMetric, { label: string; color: string; fmt: (v: number) => string }> = {
  ingresos: { label: '€ Ingresos',   color: TQ_BLUE,    fmt: fmtEur     },
  margen:   { label: 'MB%',          color: '#7B5EA7',  fmt: v => `${v.toFixed(1)}%` },
  ticket:   { label: 'Ticket medio', color: TQ_GREEN,   fmt: fmtPrecio  },
  unidades: { label: 'Unidades',     color: TQ_GOLD,    fmt: v => v.toLocaleString('es-ES') },
}

// Calcula series acumuladas + % crecimiento vs año anterior
function buildCumulativeData(
  evolucion: VentasSummary['evolucion'],
  periodo:   Periodo,
  metric:    CumulMetric,
) {
  const now     = new Date()
  const curAnyo = now.getFullYear()
  const curMes  = now.getMonth() + 1

  let currentRows: typeof evolucion
  switch (periodo) {
    case 'ytd': currentRows = evolucion.filter(p => p.anyo === curAnyo); break
    case 'mtd': currentRows = evolucion.filter(p => p.anyo === curAnyo && p.mes === curMes); break
    default:    currentRows = evolucion.slice(-12)
  }

  const prevRows = currentRows.map(r =>
    evolucion.find(e => e.anyo === r.anyo - 1 && e.mes === r.mes) ?? null
  )

  let cumActIng = 0, cumActUds = 0, cumActCost = 0
  let cumAntIng = 0, cumAntUds = 0, cumAntCost = 0

  return currentRows.map((r, i) => {
    cumActIng  += r.ingresos
    cumActUds  += r.unidades
    cumActCost += r.coste
    const prev  = prevRows[i]
    cumAntIng  += prev?.ingresos ?? 0
    cumAntUds  += prev?.unidades ?? 0
    cumAntCost += prev?.coste    ?? 0

    let actual: number
    let anterior: number
    switch (metric) {
      case 'margen':
        actual   = cumActIng > 0 ? Math.round((cumActIng - cumActCost) / cumActIng * 1000) / 10 : 0
        anterior = cumAntIng > 0 ? Math.round((cumAntIng - cumAntCost) / cumAntIng * 1000) / 10 : 0
        break
      case 'ticket':
        actual   = cumActUds > 0 ? Math.round(cumActIng / cumActUds * 100) / 100 : 0
        anterior = cumAntUds > 0 ? Math.round(cumAntIng / cumAntUds * 100) / 100 : 0
        break
      case 'unidades':
        actual   = cumActUds
        anterior = cumAntUds
        break
      default: // ingresos
        actual   = cumActIng
        anterior = cumAntIng
    }

    // Crecimiento %: variación relativa vs año anterior
    const crecimiento = anterior > 0
      ? Math.round((actual - anterior) / Math.abs(anterior) * 1000) / 10
      : null

    return { label: r.label, actual, anterior, crecimiento }
  })
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, change, color = TQ_BLUE }: {
  label: string; value: string; sub?: string; change?: number | null; color?: string
}) {
  return (
    <div className="tq-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#b2b2b2] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub    && <p className="text-xs text-[#b2b2b2] mt-0.5">{sub}</p>}
      {change != null && (
        <p className={`text-xs font-semibold mt-1 ${change >= 0 ? 'text-[#3A9E6A]' : 'text-[#C0392B]'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs año anterior
        </p>
      )}
    </div>
  )
}

function VarBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-[#b2b2b2]">Sin ref.</span>
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-[#3A9E6A]' : 'text-[#C0392B]'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function Sparkline({ data }: { data: { label: string; ingresos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={34}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Bar dataKey="ingresos" fill={TQ_BLUE} opacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, border: '1px solid #e8e3df', borderRadius: 6, padding: '3px 7px' }}
          formatter={(v) => [fmtEur(Number(v ?? 0)), '']}
          labelFormatter={(_, payload) => {
            const d = payload?.[0]?.payload as { label: string; ingresos: number } | undefined
            return d ? <span style={{ color: '#b2b2b2', fontSize: 10 }}>{d.label}</span> : null
          }}
          labelStyle={{ marginBottom: 1 }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl p-8 text-center mt-4" style={{ background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
      <p className="text-sm font-semibold text-red-700">{msg}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl p-12 text-center mt-4" style={{ background: 'rgba(200,132,42,0.04)', border: '1px solid rgba(200,132,42,0.12)' }}>
      <p className="text-3xl mb-2">▨</p>
      <p className="text-sm font-semibold text-[#a06818]">{text}</p>
      <p className="text-xs text-[#b2b2b2] mt-1">Ejecuta el sync de Ventas en Configuración → Sincronización.</p>
    </div>
  )
}

// ── Cumulative line chart ─────────────────────────────────────────────────────

const GROWTH_COLOR = '#C0392B'  // rojo si negativo, verde si positivo — se aplica en tooltip
const GROWTH_LINE  = '#8fa8b8'  // línea neutra para el crecimiento %

function CumulativeChart({
  evolucion, periodo, curAnyo,
}: {
  evolucion: VentasSummary['evolucion']
  periodo:   Periodo
  curAnyo:   number
}) {
  const [metric, setMetric] = useState<CumulMetric>('ingresos')

  const data = useMemo(
    () => buildCumulativeData(evolucion, periodo, metric),
    [evolucion, periodo, metric],
  )

  const hasData = data.some(d => d.actual > 0 || d.anterior > 0)
  if (!hasData) return null

  const cc           = CUMUL_CONFIG[metric]
  const periodoShort = PERIODOS.find(p => p.key === periodo)?.short ?? periodo

  const leftFmt = (v: number) => {
    if (metric === 'ingresos') return v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)
    if (metric === 'margen' || metric === 'ticket') return `${v.toFixed(0)}`
    return v.toLocaleString('es-ES')
  }

  return (
    <div className="tq-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: TQ_BLUE }}>
            Acumulado — {periodoShort}
            <span className="ml-2 normal-case font-normal text-[#b2b2b2]">vs año anterior</span>
          </h2>
          {/* Leyenda inline */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-[2.5px] rounded" style={{ background: cc.color }} />
              <span style={{ color: '#5a7a8a' }}>{curAnyo}</span>
            </span>
            <span className="flex items-center gap-1">
              <svg width="16" height="3" viewBox="0 0 16 3">
                <line x1="0" y1="1.5" x2="3" y2="1.5" stroke="#b2b2b2" strokeWidth="1.5"/>
                <line x1="5" y1="1.5" x2="8" y2="1.5" stroke="#b2b2b2" strokeWidth="1.5"/>
                <line x1="10" y1="1.5" x2="13" y2="1.5" stroke="#b2b2b2" strokeWidth="1.5"/>
              </svg>
              <span style={{ color: '#b2b2b2' }}>{curAnyo - 1}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-[1.5px]" style={{ background: GROWTH_LINE }} />
              <span style={{ color: '#8fa8b8' }}>var.%</span>
            </span>
          </div>
        </div>

        {/* Metric toggle */}
        <div className="flex border border-[#e8e3df] rounded-lg overflow-hidden text-xs">
          {(Object.keys(CUMUL_CONFIG) as CumulMetric[]).map(m => {
            const cfg    = CUMUL_CONFIG[m]
            const active = metric === m
            return (
              <button key={m} onClick={() => setMetric(m)}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: active ? `${cfg.color}14` : 'white',
                  color:      active ? cfg.color : '#b2b2b2',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#b2b2b2' }}
            axisLine={false}
            tickLine={false}
          />
          {/* Eje izquierdo: valores acumulados */}
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: '#b2b2b2' }}
            axisLine={false}
            tickLine={false}
            width={metric === 'unidades' ? 36 : 48}
            tickFormatter={leftFmt}
          />
          {/* Eje derecho: crecimiento % */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: '#8fa8b8' }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
            formatter={(v: unknown, name?: string | number) => {
              const n    = Number(v ?? 0)
              const sKey = String(name ?? '')
              if (sKey === 'crecimiento') {
                const color = n >= 0 ? '#3A9E6A' : '#C0392B'
                return [
                  <span key="g" style={{ color }}>{n > 0 ? '+' : ''}{n.toFixed(1)}%</span>,
                  'Crecimiento',
                ]
              }
              return [cc.fmt(n), sKey === 'actual' ? String(curAnyo) : String(curAnyo - 1)]
            }}
          />
          {/* Línea año actual */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="actual"
            stroke={cc.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: cc.color }}
            isAnimationActive={false}
          />
          {/* Línea año anterior */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="anterior"
            stroke="#c8c0b8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, fill: '#c8c0b8' }}
            isAnimationActive={false}
          />
          {/* Línea crecimiento % (eje derecho) */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="crecimiento"
            stroke={GROWTH_LINE}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: GROWTH_LINE }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Periodo selector ──────────────────────────────────────────────────────────

function PeriodoSelector({ value, onChange, loading }: {
  value: Periodo; onChange: (p: Periodo) => void; loading: boolean
}) {
  return (
    <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'rgba(0,85,127,0.06)' }}>
      {PERIODOS.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          disabled={loading}
          className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={{
            background: value === p.key ? 'white' : 'transparent',
            color:      value === p.key ? TQ_BLUE : '#8fa8b8',
            boxShadow:  value === p.key ? '0 1px 3px rgba(0,85,127,0.12)' : 'none',
            opacity:    loading ? 0.6 : 1,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────────────────────

type Metric = 'ingresos' | 'unidades' | 'ticket'

const METRIC_CONFIG: Record<Metric, { label: string; color: string; gradId: string; fmt: (v: number) => string }> = {
  ingresos: { label: '€ Ingresos',    color: TQ_BLUE,  gradId: 'vg-ing', fmt: fmtEur   },
  unidades: { label: 'Unidades',      color: TQ_GOLD,  gradId: 'vg-uds', fmt: v => v.toLocaleString('es-ES') },
  ticket:   { label: 'Ticket medio',  color: TQ_GREEN, gradId: 'vg-tkt', fmt: fmtPrecio },
}

function TabResumen({
  data, periodo, onPeriodo, loading,
}: {
  data: VentasSummary
  periodo: Periodo
  onPeriodo: (p: Periodo) => void
  loading: boolean
}) {
  const [metric, setMetric] = useState<Metric>('ingresos')

  const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  const ytdChange   = pctChange(data.ytd_ingresos, data.prev_ingresos / 12 * data.ytd_meses)
  const lastMChange = pctChange(data.last_ingresos, data.lm_prev_ingresos)

  const now     = new Date()
  const curAnyo = now.getFullYear()

  const chartData = useMemo(() => filterEvolucion(data.evolucion, periodo), [data.evolucion, periodo])
  const totals    = useMemo(() => periodoTotals(data.evolucion, periodo),   [data.evolucion, periodo])

  const periodoShort = PERIODOS.find(p => p.key === periodo)?.short ?? periodo
  const mc = METRIC_CONFIG[metric]

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={`YTD ${data.last_anyo}`}
          value={fmtEur(data.ytd_ingresos)}
          sub={`${data.ytd_unidades.toLocaleString('es-ES')} uds · ${data.ytd_meses} meses`}
          change={ytdChange}
          color={TQ_BLUE}
        />
        <KpiCard
          label={`${MESES[data.last_mes]} ${data.last_anyo}`}
          value={fmtEur(data.last_ingresos)}
          sub={`${data.last_unidades.toLocaleString('es-ES')} unidades`}
          change={lastMChange}
          color={TQ_GOLD}
        />
        <KpiCard
          label={`Año anterior ${data.last_anyo - 1}`}
          value={fmtEur(data.prev_ingresos)}
          sub={`${data.prev_unidades.toLocaleString('es-ES')} uds · 12 meses`}
          color="#666"
        />
        <KpiCard
          label="Ticket medio (último mes)"
          value={data.last_unidades > 0 ? fmtPrecio(data.last_ingresos / data.last_unidades) : '—'}
          sub="Ingresos ÷ unidades"
          color={TQ_GREEN}
        />
      </div>

      {/* ── Selector de periodo + totals del periodo ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PeriodoSelector value={periodo} onChange={onPeriodo} loading={loading} />
        <div className="flex items-center gap-4 text-xs">
          <span style={{ color: '#8fa8b8' }}>
            <span className="font-semibold" style={{ color: TQ_BLUE }}>{fmtEur(totals.ingresos)}</span>
            {' '}ingresos
          </span>
          <span style={{ color: '#8fa8b8' }}>
            <span className="font-semibold" style={{ color: TQ_GOLD }}>{totals.unidades.toLocaleString('es-ES')}</span>
            {' '}uds
          </span>
          <span style={{ color: '#8fa8b8' }}>
            ticket{' '}
            <span className="font-semibold" style={{ color: TQ_GREEN }}>
              {totals.ticket > 0 ? fmtPrecio(totals.ticket) : '—'}
            </span>
          </span>
        </div>
      </div>

      {/* Evolución */}
      <div className="tq-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: TQ_BLUE }}>
            Evolución — {periodoShort}
            {periodo === 'mtd' && (
              <span className="ml-2 normal-case font-normal text-[#b2b2b2]">
                (datos mensuales · últimos 6 meses)
              </span>
            )}
          </h2>
          {/* Metric selector */}
          <div className="flex border border-[#e8e3df] rounded-lg overflow-hidden text-xs">
            {(Object.keys(METRIC_CONFIG) as Metric[]).map(m => {
              const cfg = METRIC_CONFIG[m]
              const active = metric === m
              return (
                <button key={m} onClick={() => setMetric(m)}
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    background: active ? `${cfg.color}14` : 'white',
                    color:      active ? cfg.color : '#b2b2b2',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="vg-ing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_BLUE}  stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_BLUE}  stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="vg-uds" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_GOLD}  stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_GOLD}  stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="vg-tkt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_GREEN} stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_GREEN} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#b2b2b2' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#b2b2b2' }}
              axisLine={false}
              tickLine={false}
              width={metric === 'unidades' ? 36 : 48}
              tickFormatter={v => {
                if (metric === 'ingresos') return `${(v / 1000).toFixed(0)}K`
                if (metric === 'ticket')   return `${v.toFixed(0)}€`
                return String(v)
              }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
              formatter={(v) => [mc.fmt(Number(v ?? 0)), mc.label]}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={mc.color}
              strokeWidth={2}
              fill={`url(#${mc.gradId})`}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Acumulado con comparativa año anterior */}
      <CumulativeChart
        evolucion={data.evolucion}
        periodo={periodo}
        curAnyo={curAnyo}
      />

      {/* Top modelos + Familias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="tq-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: TQ_BLUE }}>
            Top 10 referencias · {periodoShort}
          </h2>
          <div className="space-y-2">
            {data.top_modelos.map((m, i) => {
              const maxIng = data.top_modelos[0]?.ingresos_12m ?? 1
              return (
                <div key={m.codigo_modelo} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-4 text-right text-[#b2b2b2]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-[#1d1d1b] truncate">{m.description ?? m.codigo_modelo}</p>
                      <p className="text-xs font-bold flex-shrink-0" style={{ color: TQ_BLUE }}>{fmtEur(m.ingresos_12m)}</p>
                    </div>
                    <div className="h-1 rounded-full mt-1 bg-[#f0ece8]">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width:      `${Math.round((m.ingresos_12m / maxIng) * 100)}%`,
                          background: TQ_BLUE,
                          opacity:    0.55 - i * 0.03,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="tq-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: TQ_BLUE }}>
            Ingresos por familia · {periodoShort}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.por_familia} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#b2b2b2' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="familia" tick={{ fontSize: 11, fill: '#555' }}
                axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
                formatter={(v) => [Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), 'Ingresos']}
              />
              <Bar dataKey="ingresos" fill={TQ_BLUE} radius={[0, 4, 4, 0]} barSize={14}
                label={{
                  position: 'right',
                  formatter: (v: unknown) => `${data.por_familia.find(f => f.ingresos === Number(v))?.pct_ingresos ?? 0}%`,
                  fontSize: 10, fill: '#b2b2b2',
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Por modelo ───────────────────────────────────────────────────────────

function TabPorModelo() {
  const [rows, setRows]         = useState<VentasPorModelo[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [familia, setFamilia]   = useState('all')
  const [metal, setMetal]       = useState('all')
  const [order, setOrder]       = useState<'ingresos' | 'unidades' | 'variacion'>('ingresos')
  const [search, setSearch]     = useState('')
  const [familias, setFamilias] = useState<string[]>([])
  const [metales,  setMetales]  = useState<string[]>([])
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ order, limit: '200' })
    if (familia !== 'all') params.set('familia', familia)
    if (metal   !== 'all') params.set('metal',   metal)
    try {
      const res = await fetch(`/api/ventas/por-modelo?${params}`)
      if (!res.ok) throw new Error((await res.json()).error)
      const data: VentasPorModelo[] = await res.json()
      setRows(data)
      if (firstLoad.current) {
        firstLoad.current = false
        const fams = Array.from(new Set(data.map(r => r.familia).filter(Boolean))).sort() as string[]
        const mets = Array.from(new Set(data.map(r => r.metal).filter(Boolean))).sort() as string[]
        setFamilias(fams)
        setMetales(mets)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [familia, metal, order])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? rows.filter(r =>
        r.codigo_modelo.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : rows

  const totalIngresos = filtered.reduce((s, r) => s + r.ingresos_12m, 0)
  const totalUnidades = filtered.reduce((s, r) => s + r.unidades_12m, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Buscar modelo…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white w-48" />
        <select value={familia} onChange={e => setFamilia(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={metal} onChange={e => setMetal(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">Todos los metales</option>
          {metales.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={order} onChange={e => setOrder(e.target.value as typeof order)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ingresos">Mayor ingreso</option>
          <option value="unidades">Más unidades</option>
          <option value="variacion">Mayor crecimiento</option>
        </select>
        {!loading && !error && (
          <span className="ml-auto text-xs text-[#b2b2b2]">
            <b style={{ color: TQ_BLUE }}>{fmtEur(totalIngresos)}</b>
            {' · '}
            <b style={{ color: TQ_GOLD }}>{totalUnidades.toLocaleString('es-ES')} uds</b>
            {' · '}
            {filtered.length} referencias
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#b2b2b2] text-sm">Cargando…</div>
      ) : error ? (
        <ErrorBox msg={error} />
      ) : filtered.length === 0 ? (
        <Empty text="Sin datos de ventas disponibles" />
      ) : (
        <div className="tq-card overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[22%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#f4f1ee]">
                {['Modelo (agrupado)', 'Ing. 12m', 'Uds.', 'Var.', 'Últimos 12 meses', 'Activo'].map((h, i) => (
                  <th key={h} className={`px-3 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2] ${i === 0 ? 'text-left' : 'text-right'} ${i === 4 ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f1ee]">
              {filtered.map(r => (
                <tr key={r.codigo_modelo} className="hover:bg-[#fafaf9] transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.imagen ? (
                        <img src={r.imagen} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#f4f1ee] flex items-center justify-center flex-shrink-0">
                          <span className="text-[#c6c6c6] text-xs">◻</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}>{r.codigo_modelo}</span>
                          <span className="text-[10px] text-[#b2b2b2]">{r.familia ?? '—'} · {r.metal ?? '—'}</span>
                        </div>
                        <p className="font-semibold text-[#1d1d1b] text-xs truncate">{r.description ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-xs" style={{ color: TQ_BLUE }}>
                    {fmtEur(r.ingresos_12m)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-[#555]">
                    {r.unidades_12m.toLocaleString('es-ES')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <VarBadge pct={r.variacion_pct} />
                  </td>
                  <td className="px-3 py-2">
                    <Sparkline data={r.sparkline} />
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-[#b2b2b2]">
                    {r.meses_con_ventas}/12
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'modelos'

export default function VentasDashboardClient() {
  const [tab,     setTab]     = useState<Tab>('resumen')
  const [periodo, setPeriodo] = useState<Periodo>('12m')
  const [summary, setSummary] = useState<VentasSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/ventas/summary?periodo=${periodo}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then(setSummary)
      .catch(e => setError(typeof e === 'string' ? e : 'Error cargando datos'))
      .finally(() => setLoading(false))
  }, [periodo])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resumen', label: 'Resumen'    },
    { key: 'modelos', label: 'Por modelo' },
  ]

  return (
    <div className="space-y-0 mt-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#e8e3df] mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={{
              borderColor: tab === t.key ? TQ_BLUE : 'transparent',
              color:       tab === t.key ? TQ_BLUE : '#b2b2b2',
              fontWeight:  tab === t.key ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        loading && !summary ? (
          <div className="flex items-center justify-center py-24 text-[#b2b2b2] text-sm">Cargando…</div>
        ) : error ? (
          <ErrorBox msg={error} />
        ) : summary ? (
          <TabResumen
            data={summary}
            periodo={periodo}
            onPeriodo={setPeriodo}
            loading={loading}
          />
        ) : null
      )}

      {tab === 'modelos' && <TabPorModelo />}
    </div>
  )
}
