'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { VentasSummary } from '@/app/api/ventas/summary/route'

const TQ_BLUE  = '#00557f'
const TQ_GOLD  = '#C8842A'
const TQ_GREEN = '#3A9E6A'

function fmtEur(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K €`
  return `${n.toLocaleString('es-ES')} €`
}

function pctChange(curr: number, prev: number) {
  if (!prev) return null
  return Math.round(((curr - prev) / prev) * 100)
}

function KpiCard({
  label, value, sub, change, color = TQ_BLUE,
}: {
  label: string
  value: string
  sub?: string
  change?: number | null
  color?: string
}) {
  return (
    <div className="tq-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#b2b2b2] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[#b2b2b2] mt-0.5">{sub}</p>}
      {change != null && (
        <p className={`text-xs font-semibold mt-1 ${change >= 0 ? 'text-[#3A9E6A]' : 'text-[#C0392B]'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs mismo período año anterior
        </p>
      )}
    </div>
  )
}

export default function VentasDashboardClient() {
  const [data, setData]     = useState<VentasSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [metric, setMetric] = useState<'ingresos' | 'unidades'>('ingresos')

  useEffect(() => {
    fetch('/api/ventas/summary')
      .then(r => r.ok ? r.json() : r.json().then((e: {error:string}) => Promise.reject(e.error)))
      .then(setData)
      .catch(e => setError(typeof e === 'string' ? e : 'Error cargando datos'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#b2b2b2] text-sm">Cargando datos de ventas…</div>
  )
  if (error) return (
    <div className="rounded-xl p-8 text-center mt-6" style={{ background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
      <p className="text-sm font-semibold text-red-700">{error}</p>
    </div>
  )
  if (!data) return null

  const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const ytdChange = pctChange(
    data.ytd_ingresos,
    // Normalizar el año anterior a los mismos meses que el YTD actual
    data.prev_ingresos / 12 * data.ytd_meses
  )
  const lastMChange = pctChange(data.last_ingresos, data.lm_prev_ingresos)

  return (
    <div className="space-y-6 mt-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={`YTD ${data.last_anyo}`}
          value={fmtEur(data.ytd_ingresos)}
          sub={`${data.ytd_unidades.toLocaleString('es-ES')} unidades · ${data.ytd_meses} meses`}
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
          sub={`${data.prev_unidades.toLocaleString('es-ES')} unidades · 12 meses`}
          color="#666"
        />
        <KpiCard
          label="Ticket medio (último mes)"
          value={data.last_unidades > 0
            ? (data.last_ingresos / data.last_unidades).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
            : '—'
          }
          sub="Ingresos ÷ unidades"
          color={TQ_GREEN}
        />
      </div>

      {/* Evolución mensual */}
      <div className="tq-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00557f]">
            Evolución mensual — últimos 18 meses
          </h2>
          <div className="flex border border-[#e8e3df] rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setMetric('ingresos')}
              className="px-3 py-1.5 transition-colors"
              style={{
                background: metric === 'ingresos' ? '#e8f4fb' : 'white',
                color:      metric === 'ingresos' ? TQ_BLUE : '#b2b2b2',
                fontWeight: metric === 'ingresos' ? 700 : 400,
              }}
            >€ Ingresos</button>
            <button
              onClick={() => setMetric('unidades')}
              className="px-3 py-1.5 transition-colors"
              style={{
                background: metric === 'unidades' ? '#fdf3e4' : 'white',
                color:      metric === 'unidades' ? TQ_GOLD : '#b2b2b2',
                fontWeight: metric === 'unidades' ? 700 : 400,
              }}
            >Uds.</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.evolucion} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-ingresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_BLUE} stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_BLUE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-unidades" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_GOLD} stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#b2b2b2' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#b2b2b2' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => metric === 'ingresos' ? `${(v / 1000).toFixed(0)}K` : String(v)}
              width={42}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
              formatter={(v) => {
                const n = Number(v ?? 0)
                return metric === 'ingresos'
                  ? [n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), 'Ingresos']
                  : [n.toLocaleString('es-ES'), 'Unidades']
              }}
            />
            {metric === 'ingresos' ? (
              <Area
                type="monotone"
                dataKey="ingresos"
                stroke={TQ_BLUE}
                strokeWidth={2}
                fill="url(#grad-ingresos)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="unidades"
                stroke={TQ_GOLD}
                strokeWidth={2}
                fill="url(#grad-unidades)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: Top productos + Familias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 modelos */}
        <div className="tq-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00557f] mb-3">
            Top 10 referencias (últimos 12 meses)
          </h2>
          <div className="space-y-2">
            {data.top_modelos.map((m, i) => {
              const maxIngresos = data.top_modelos[0]?.ingresos_12m ?? 1
              const pct = Math.round((m.ingresos_12m / maxIngresos) * 100)
              return (
                <div key={m.codigo_modelo} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-4 text-right text-[#b2b2b2]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-[#1d1d1b] truncate">{m.description ?? m.codigo_modelo}</p>
                      <p className="text-xs font-bold text-[#00557f] flex-shrink-0">
                        {fmtEur(m.ingresos_12m)}
                      </p>
                    </div>
                    <div className="h-1 rounded-full mt-1" style={{ background: '#f0ece8' }}>
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `${pct}%`, background: TQ_BLUE, opacity: 0.6 + i * -0.05 }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Familias */}
        <div className="tq-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00557f] mb-3">
            Ventas por familia (últimos 12 meses)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.por_familia}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#b2b2b2' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                type="category"
                dataKey="familia"
                tick={{ fontSize: 11, fill: '#555' }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
                formatter={(v, name) => {
                  const n = Number(v ?? 0)
                  return name === 'ingresos'
                    ? [n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), 'Ingresos']
                    : [n.toLocaleString('es-ES'), 'Unidades']
                }}
              />
              <Bar dataKey="ingresos" fill={TQ_BLUE} radius={[0, 4, 4, 0]} barSize={14}
                label={{
                  position: 'right',
                  formatter: (v: unknown) => {
                    const n = Number(v ?? 0)
                    return `${data.por_familia.find(f => f.ingresos === n)?.pct_ingresos ?? 0}%`
                  },
                  fontSize: 10,
                  fill: '#b2b2b2',
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
