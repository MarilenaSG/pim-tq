'use client'

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
} from 'recharts'

const MESES_CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface VentaRow {
  slug: string
  anyo: number
  mes: number
  unidades_vendidas: number | null
  ingresos_netos: number | null
  coste_total: number | null
}

export interface ReservaRow {
  slug: string
  fecha_snapshot: string | null
  reservas_count: number | null
  unidades_reservadas: number | null
}

export interface CampaignRef {
  id: string
  nombre: string
  color: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  tipo?: string | null
  estado?: string
}

interface Props {
  ventas: VentaRow[]
  reservas: ReservaRow[]
  variantSlugMap: Record<string, string>
  campaigns?: CampaignRef[]
}

function fmtEuro(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

// Keep only the last N months of data
function lastNMonths(
  data: { anyo: number; mes: number; unidades: number; ingresos: number; margen: number }[],
  n: number
) {
  return data.slice(-n)
}

export function VentasTab({ ventas, reservas, variantSlugMap, campaigns = [] }: Props) {
  // Aggregate by (anyo, mes) across all variants of this model
  const byMonthMap = new Map<string, { anyo: number; mes: number; unidades: number; ingresos: number; margen: number }>()
  for (const row of ventas) {
    const key = `${row.anyo}-${String(row.mes).padStart(2, '0')}`
    const existing = byMonthMap.get(key) ?? { anyo: row.anyo, mes: row.mes, unidades: 0, ingresos: 0, margen: 0 }
    const ing = Number(row.ingresos_netos ?? 0)
    const cst = Number(row.coste_total ?? 0)
    existing.unidades += row.unidades_vendidas ?? 0
    existing.ingresos += ing
    existing.margen   += ing - cst
    byMonthMap.set(key, existing)
  }

  const allMonths = Array.from(byMonthMap.values())
    .sort((a, b) => a.anyo !== b.anyo ? a.anyo - b.anyo : a.mes - b.mes)

  // chartData keeps month key for campaign overlap detection
  const chartData = lastNMonths(allMonths, 18).map(d => ({
    key:      `${d.anyo}-${String(d.mes).padStart(2, '0')}`,
    label:    `${MESES_CORTO[d.mes]} ${String(d.anyo).slice(2)}`,
    unidades: d.unidades,
    ingresos: Math.round(d.ingresos),
  }))

  // Find chart label range for each campaign
  const campaignRanges = campaigns.flatMap(c => {
    const start = c.fecha_inicio ? c.fecha_inicio.slice(0, 7) : '0000-00'
    const end   = c.fecha_fin   ? c.fecha_fin.slice(0, 7)   : '9999-99'
    const inRange = chartData.filter(d => d.key >= start && d.key <= end)
    if (inRange.length === 0) return []
    return [{ x1: inRange[0].label, x2: inRange[inRange.length - 1].label, nombre: c.nombre, color: c.color ?? '#C8842A' }]
  })

  // KPIs
  const totalUnidades = allMonths.reduce((s, d) => s + d.unidades, 0)
  const totalIngresos = allMonths.reduce((s, d) => s + d.ingresos, 0)
  const totalReservas = reservas.reduce((s, r) => s + (r.reservas_count ?? 0), 0)
  const mediaUnidades = allMonths.length > 0 ? Math.round(totalUnidades / allMonths.length) : 0

  const hasVentas   = chartData.length > 0
  const hasReservas = reservas.length > 0

  const axisStyle  = { fontSize: 10, fill: '#b2b2b2' }
  const tooltipStyle = { fontSize: 12, border: '1px solid rgba(0,85,127,0.12)', borderRadius: 8 }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unidades vendidas',  value: totalUnidades.toLocaleString('es-ES') },
          { label: 'Ingresos netos',     value: fmtEuro(totalIngresos) },
          { label: 'Media mensual',      value: `${mediaUnidades} ud` },
          { label: 'Reservas activas',   value: totalReservas.toLocaleString('es-ES'), highlight: totalReservas > 0 },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#b2b2b2' }}>{kpi.label}</div>
            <div className="text-base font-bold" style={{ color: kpi.highlight ? '#C8842A' : '#00324b' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Demand line chart — last 18 months */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
            Demanda — últimos 18 meses
          </p>
          {hasVentas && (
            <span className="text-[10px]" style={{ color: '#b2b2b2' }}>
              {chartData.length} meses con datos
            </span>
          )}
        </div>
        {hasVentas ? (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={axisStyle} axisLine={false} tickLine={false} width={28}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={axisStyle} axisLine={false} tickLine={false} width={52}
                  tickFormatter={v => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    const n = Number(value)
                    return name === 'Ingresos' ? [fmtEuro(n), name as string] : [n, name as string]
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: '#b2b2b2', paddingTop: 8 }} />

                {/* Campaign shading */}
                {campaignRanges.map((r, i) => (
                  <ReferenceArea
                    key={i}
                    yAxisId="left"
                    x1={r.x1}
                    x2={r.x2}
                    fill={r.color}
                    fillOpacity={0.12}
                    stroke={r.color}
                    strokeOpacity={0.4}
                    strokeWidth={1}
                  />
                ))}

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="unidades"
                  name="Unidades"
                  stroke="#0099f2"
                  strokeWidth={2.5}
                  dot={{ fill: '#0099f2', r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ingresos"
                  name="Ingresos"
                  stroke="#C8842A"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Campaign legend */}
            {campaignRanges.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(0,85,127,0.06)' }}>
                {campaignRanges.map((r, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: '#777' }}>
                    <span className="w-3 h-3 rounded-sm" style={{ background: r.color, opacity: 0.5 }} />
                    {r.nombre}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#b2b2b2' }}>
            Sin datos de ventas. Ejecuta el sync de Ventas mensuales en /settings/sync.
          </div>
        )}
      </div>

      {/* Reservas activas */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
            Reservas activas por variante
            {hasReservas && reservas[0]?.fecha_snapshot && (
              <span className="ml-2 normal-case font-normal">
                · snapshot {new Date(reservas[0].fecha_snapshot).toLocaleDateString('es-ES')}
              </span>
            )}
          </p>
        </div>
        {hasReservas ? (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
                {['Slug', 'Reservas', 'Uds. reservadas'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservas.map((r, i) => (
                <tr key={r.slug} style={{ borderBottom: i < reservas.length - 1 ? '1px solid rgba(0,85,127,0.04)' : 'none' }}>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-tq-sky">
                    {variantSlugMap[r.slug] ?? r.slug}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-bold" style={{ color: (r.reservas_count ?? 0) > 0 ? '#C8842A' : '#b2b2b2' }}>
                    {r.reservas_count ?? 0}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-tq-snorkel">{r.unidades_reservadas ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-10 text-center text-sm" style={{ color: '#b2b2b2' }}>
            Sin reservas activas.
          </div>
        )}
      </div>

      {/* Monthly detail table */}
      {hasVentas && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Detalle por variante y mes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
                  {['Slug', 'Año', 'Mes', 'Uds.', 'Ingresos', 'Margen'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ventas.map((r, i) => {
                  const ing = Number(r.ingresos_netos ?? 0)
                  const mrg = ing - Number(r.coste_total ?? 0)
                  return (
                    <tr key={`${r.slug}-${r.anyo}-${r.mes}`}
                      style={{ borderBottom: i < ventas.length - 1 ? '1px solid rgba(0,85,127,0.04)' : 'none' }}>
                      <td className="px-4 py-2 font-mono text-xs font-bold text-tq-sky">{r.slug}</td>
                      <td className="px-4 py-2 text-xs text-tq-snorkel">{r.anyo}</td>
                      <td className="px-4 py-2 text-xs text-tq-snorkel">{MESES_CORTO[r.mes]}</td>
                      <td className="px-4 py-2 text-xs font-bold text-tq-snorkel">{r.unidades_vendidas ?? 0}</td>
                      <td className="px-4 py-2 font-mono text-xs text-tq-snorkel">{fmtEuro(ing)}</td>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: mrg >= 0 ? '#3A9E6A' : '#C0392B' }}>{fmtEuro(mrg)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
