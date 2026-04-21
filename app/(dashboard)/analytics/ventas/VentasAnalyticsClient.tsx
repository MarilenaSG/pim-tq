'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Cell,
} from 'recharts'

export interface MonthlyPoint {
  label: string
  unidades: number
  ingresos: number
  margen: number
}

export interface ModelPoint {
  codigo_modelo: string
  description: string | null
  ingresos: number
  unidades: number
}

export interface GroupPoint {
  name: string
  ingresos: number
  unidades: number
}

export interface VentasKpis {
  totalUnidades: number
  totalIngresos: number
  totalMargen: number
  numModelos: number
  periodoLabel: string
}

interface Props {
  kpis: VentasKpis
  monthly: MonthlyPoint[]
  topModels: ModelPoint[]
  byFamilia: GroupPoint[]
  byMetal: GroupPoint[]
}

function fmtEuro(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

const COLORS = ['#0099f2', '#C8842A', '#3A9E6A', '#2A5F9E', '#C0392B', '#8e44ad', '#16a085', '#f39c12', '#2980b9', '#27ae60']

export function VentasAnalyticsClient({ kpis, monthly, topModels, byFamilia, byMetal }: Props) {
  const tooltipStyle = { fontSize: 12, border: '1px solid rgba(0,85,127,0.12)', borderRadius: 8 }
  const axisStyle = { fontSize: 10, fill: '#b2b2b2' }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Unidades vendidas',  value: kpis.totalUnidades.toLocaleString('es-ES'),  sub: kpis.periodoLabel },
          { label: 'Ingresos netos',      value: fmtEuro(kpis.totalIngresos),                  sub: kpis.periodoLabel },
          { label: 'Margen bruto',        value: fmtEuro(kpis.totalMargen),                    sub: kpis.totalIngresos > 0 ? `${Math.round(kpis.totalMargen / kpis.totalIngresos * 100)}%` : '—' },
          { label: 'Modelos con ventas',  value: kpis.numModelos.toLocaleString('es-ES'),      sub: 'modelos únicos' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl px-4 py-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#b2b2b2' }}>{kpi.label}</div>
            <div className="text-xl font-bold text-tq-snorkel">{kpi.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: '#b2b2b2' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Evolución mensual */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: '#b2b2b2' }}>Evolución mensual</p>
        {monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthly} margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} width={30} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} width={55}
                tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  const n = Number(value)
                  if (name === 'Ingresos' || name === 'Margen') return [fmtEuro(n), name as string]
                  return [n, name as string]
                }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#b2b2b2', paddingTop: 8 }} />
              <Bar yAxisId="left" dataKey="unidades" name="Unidades" fill="rgba(0,153,242,0.65)" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="ingresos" name="Ingresos" stroke="#C8842A" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="margen" name="Margen" stroke="#3A9E6A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>

      {/* Top modelos + por familia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top 10 modelos */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: '#b2b2b2' }}>Top 10 modelos por ingresos</p>
          {topModels.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topModels} layout="vertical" margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false}
                  tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="codigo_modelo" tick={{ ...axisStyle, fontSize: 9 }}
                  axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(value, name) => [fmtEuro(Number(value)), name as string]} />
                <Bar dataKey="ingresos" name="Ingresos" radius={[0, 3, 3, 0]}>
                  {topModels.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>

        {/* Por familia */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: '#b2b2b2' }}>Ingresos por familia</p>
          {byFamilia.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byFamilia} layout="vertical" margin={{ top: 0, right: 60, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false}
                  tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 9 }}
                  axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    const n = Number(value)
                    return name === 'Ingresos' ? [fmtEuro(n), name as string] : [n, name as string]
                  }} />
                <Bar dataKey="ingresos" name="Ingresos" radius={[0, 3, 3, 0]}>
                  {byFamilia.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* Por metal */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: '#b2b2b2' }}>Ingresos y unidades por metal</p>
        {byMetal.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={byMetal} margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} width={30} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} width={55}
                tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  const n = Number(value)
                  return name === 'Ingresos' ? [fmtEuro(n), name as string] : [n, name as string]
                }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#b2b2b2', paddingTop: 8 }} />
              <Bar yAxisId="left" dataKey="unidades" name="Unidades" fill="rgba(0,153,242,0.65)" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="ingresos" name="Ingresos" stroke="#C8842A" strokeWidth={2} dot={{ fill: '#C8842A', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>

    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#b2b2b2' }}>
      Sin datos. Ejecuta el sync de Ventas mensuales en /settings/sync.
    </div>
  )
}
