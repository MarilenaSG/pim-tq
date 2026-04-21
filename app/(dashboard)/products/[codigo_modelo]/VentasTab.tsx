'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const MESES_CORTO = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface VentaRow {
  codigo_interno: string
  anyo: number
  mes: number
  unidades_vendidas: number | null
  ingresos_netos: number | null
  coste_total: number | null
}

export interface ReservaRow {
  codigo_interno: string
  fecha_snapshot: string | null
  reservas_count: number | null
  unidades_reservadas: number | null
}

interface Props {
  ventas: VentaRow[]
  reservas: ReservaRow[]
  variantSlugMap: Record<string, string> // codigo_interno → slug/variante label
}

function fmtEuro(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

export function VentasTab({ ventas, reservas, variantSlugMap }: Props) {
  // Aggregate by (anyo, mes) across all variants
  const byMonthMap = new Map<string, { anyo: number; mes: number; unidades: number; ingresos: number; coste: number }>()
  for (const row of ventas) {
    const key = `${row.anyo}-${String(row.mes).padStart(2, '0')}`
    const existing = byMonthMap.get(key) ?? { anyo: row.anyo, mes: row.mes, unidades: 0, ingresos: 0, coste: 0 }
    existing.unidades += row.unidades_vendidas ?? 0
    existing.ingresos += Number(row.ingresos_netos ?? 0)
    existing.coste    += Number(row.coste_total ?? 0)
    byMonthMap.set(key, existing)
  }
  const chartData = Array.from(byMonthMap.values())
    .sort((a, b) => a.anyo !== b.anyo ? a.anyo - b.anyo : a.mes - b.mes)
    .map(d => ({
      label:    `${MESES_CORTO[d.mes]} ${String(d.anyo).slice(2)}`,
      unidades: d.unidades,
      ingresos: Math.round(d.ingresos),
      margen:   Math.round(d.ingresos - d.coste),
    }))

  // KPIs
  const totalUnidades = chartData.reduce((s, d) => s + d.unidades, 0)
  const totalIngresos = chartData.reduce((s, d) => s + d.ingresos, 0)
  const totalReservas = reservas.reduce((s, r) => s + (r.reservas_count ?? 0), 0)
  const mediaUnidades = chartData.length > 0 ? Math.round(totalUnidades / chartData.length) : 0

  const hasVentas   = chartData.length > 0
  const hasReservas = reservas.length > 0

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unidades vendidas',  value: totalUnidades.toLocaleString('es-ES') },
          { label: 'Ingresos netos',      value: fmtEuro(totalIngresos) },
          { label: 'Media mensual',       value: `${mediaUnidades} ud` },
          { label: 'Reservas activas',    value: totalReservas.toLocaleString('es-ES'), highlight: totalReservas > 0 },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl px-4 py-3"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#b2b2b2' }}>
              {kpi.label}
            </div>
            <div
              className="text-base font-bold"
              style={{ color: kpi.highlight ? '#C8842A' : '#00324b' }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: '#b2b2b2' }}>
          Evolución mensual
        </p>
        {hasVentas ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#b2b2b2' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#b2b2b2' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#b2b2b2' }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={v => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid rgba(0,85,127,0.12)', borderRadius: 8 }}
                formatter={(value, name) => {
                  const n = Number(value)
                  if (name === 'Ingresos' || name === 'Margen') return [fmtEuro(n), name as string]
                  return [n, name as string]
                }}
              />
              <Legend
                iconSize={10}
                wrapperStyle={{ fontSize: 11, color: '#b2b2b2', paddingTop: 8 }}
              />
              <Bar yAxisId="left" dataKey="unidades" name="Unidades" fill="rgba(0,153,242,0.7)" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="ingresos" name="Ingresos" stroke="#C8842A" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="margen" name="Margen" stroke="#3A9E6A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#b2b2b2' }}>
            Sin datos de ventas. Ejecuta el sync de Ventas mensuales.
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
                {['Variante', 'Código interno', 'Reservas', 'Uds. reservadas'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservas.map((r, i) => (
                <tr key={r.codigo_interno} style={{ borderBottom: i < reservas.length - 1 ? '1px solid rgba(0,85,127,0.04)' : 'none' }}>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-tq-sky">
                    {variantSlugMap[r.codigo_interno] ?? r.codigo_interno}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-tq-snorkel">{r.codigo_interno}</td>
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
            Sin reservas activas. Ejecuta el sync de Reservas.
          </div>
        )}
      </div>

      {/* Detalle mensual por variante */}
      {hasVentas && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
              Detalle por variante y mes
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
                  {['Variante', 'Año', 'Mes', 'Uds.', 'Ingresos netos', 'Coste total', 'Margen'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ventas.map((r, i) => {
                  const ing = Number(r.ingresos_netos ?? 0)
                  const cst = Number(r.coste_total ?? 0)
                  const mrg = ing - cst
                  return (
                    <tr key={`${r.codigo_interno}-${r.anyo}-${r.mes}`}
                      style={{ borderBottom: i < ventas.length - 1 ? '1px solid rgba(0,85,127,0.04)' : 'none' }}>
                      <td className="px-4 py-2 font-mono text-xs font-bold text-tq-sky">
                        {variantSlugMap[r.codigo_interno] ?? r.codigo_interno}
                      </td>
                      <td className="px-4 py-2 text-xs text-tq-snorkel">{r.anyo}</td>
                      <td className="px-4 py-2 text-xs text-tq-snorkel">{MESES_CORTO[r.mes]}</td>
                      <td className="px-4 py-2 text-xs font-bold text-tq-snorkel">{r.unidades_vendidas ?? 0}</td>
                      <td className="px-4 py-2 font-mono text-xs text-tq-snorkel">{fmtEuro(ing)}</td>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: '#b2b2b2' }}>{fmtEuro(cst)}</td>
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
