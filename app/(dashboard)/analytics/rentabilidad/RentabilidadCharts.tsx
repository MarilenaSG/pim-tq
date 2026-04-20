'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ScatterChart, Scatter,
  ReferenceLine,
} from 'recharts'
import { ChartCard } from '@/components/analytics/ChartCard'

interface FamiliaRow  { familia: string; ingresos: number; margenMedio: number; count: number }
interface MetalRow    { metal: string; ingresos: number }
interface Top10Row    { codigo: string; desc: string | null; familia: string | null; abc: string | null; ingresos: number; margen: number | null; pctTotal: number }
interface ScatterRow  { ingresos: number; margen: number; familia: string; codigo: string; desc: string; abc: string }

interface Props {
  familiaData: FamiliaRow[]
  metalData:   MetalRow[]
  top10:       Top10Row[]
  scatterData: ScatterRow[]
}

const fmtEur = (v: unknown) => {
  const n = Number(v)
  return n >= 1000 ? `${Math.round(n / 1000)}k€` : `${Math.round(n)}€`
}

// Palette for scatter by familia
const COLORS = ['#00557f','#C8842A','#3A9E6A','#C0392B','#7B68EE','#20B2AA','#FF8C00','#9932CC','#008080','#DC143C']

export function RentabilidadCharts({ familiaData, metalData, top10, scatterData }: Props) {
  const familias = Array.from(new Set(scatterData.map(d => d.familia)))
  const colorByFamilia = Object.fromEntries(familias.map((f, i) => [f, COLORS[i % COLORS.length]]))

  return (
    <div className="space-y-6">
      {/* Row 1: ingresos x familia + metal */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard
            title="Ingresos 12m por familia"
            subtitle="Contribución absoluta por categoría de producto"
            height={340}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={familiaData}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#b2b2b2' }} tickFormatter={fmtEur} />
                <YAxis type="category" dataKey="familia" width={90} tick={{ fontSize: 10, fill: '#00557f' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as FamiliaRow
                    return (
                      <div className="bg-white border border-[#e2ddd9] rounded-lg p-3 shadow text-xs space-y-1">
                        <p className="font-bold text-[#00557f]">{d.familia}</p>
                        <p>Ingresos: <span className="font-semibold">{fmtEur(d.ingresos)}</span></p>
                        <p>Margen medio: <span className="font-semibold">{d.margenMedio}%</span></p>
                        <p>Modelos: {d.count}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="ingresos" fill="#00557f" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Por metal" subtitle="Ingresos 12m por tipo de metal" height={340}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metalData} margin={{ top: 0, right: 8, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
              <XAxis dataKey="metal" tick={{ fontSize: 10, fill: '#b2b2b2' }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#b2b2b2' }} tickFormatter={fmtEur} />
              <Tooltip
                formatter={(v: unknown) => [fmtEur(v), 'Ingresos']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Bar dataKey="ingresos" fill="#C8842A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: scatter ingresos vs margen + top10 */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="Ingresos vs Margen"
          subtitle="Cada punto es un modelo · cuadrante ideal: arriba-derecha"
          height={340}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
              <XAxis
                type="number"
                dataKey="ingresos"
                name="Ingresos"
                tick={{ fontSize: 10, fill: '#b2b2b2' }}
                tickFormatter={fmtEur}
                label={{ value: 'Ingresos 12m', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#b2b2b2' }}
              />
              <YAxis
                type="number"
                dataKey="margen"
                name="Margen"
                tick={{ fontSize: 10, fill: '#b2b2b2' }}
                tickFormatter={(v: unknown) => `${Number(v)}%`}
              />
              <ReferenceLine x={0} stroke="#e2ddd9" />
              <ReferenceLine y={50} stroke="#C0392B" strokeDasharray="4 2" strokeWidth={1} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as ScatterRow
                  return (
                    <div className="bg-white border border-[#e2ddd9] rounded-lg p-3 shadow text-xs space-y-1">
                      <p className="font-bold text-[#00557f] truncate max-w-[180px]">{d.desc}</p>
                      <p>Ingresos: <span className="font-semibold">{fmtEur(d.ingresos)}</span></p>
                      <p>Margen: <span className="font-semibold">{d.margen}%</span></p>
                      <p className="text-[#b2b2b2]">{d.familia} · ABC {d.abc}</p>
                    </div>
                  )
                }}
              />
              {familias.map(f => (
                <Scatter
                  key={f}
                  name={f}
                  data={scatterData.filter(d => d.familia === f)}
                  fill={colorByFamilia[f]}
                  opacity={0.65}
                  r={4}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top 10 tabla */}
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <h3 className="text-sm font-bold text-[#00557f] uppercase tracking-wider mb-1">Top 10 modelos</h3>
          <p className="text-xs text-[#b2b2b2] mb-4">Por ingresos 12m</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2ddd9]">
                {['#', 'Código', 'Ingresos', 'Margen', 'ABC'].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-bold text-[#00557f] uppercase tracking-wider pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top10.map((r, i) => (
                <tr key={i} className="border-b border-[#f0ece8] hover:bg-[#f0ece8]/40 transition-colors">
                  <td className="py-2 pr-3 text-xs text-[#b2b2b2] font-mono">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <div className="font-mono text-xs text-[#b2b2b2]">{r.codigo}</div>
                    <div className="text-xs text-[#1d1d1b] truncate max-w-[140px]">{r.desc ?? '—'}</div>
                  </td>
                  <td className="py-2 pr-3 font-semibold text-[#00557f] text-xs whitespace-nowrap">
                    {r.ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    <span className="ml-1 text-[#C8842A] font-normal">({r.pctTotal}%)</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-[#b2b2b2]">
                    {r.margen != null ? `${Math.round(r.margen)}%` : '—'}
                  </td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      r.abc === 'A' ? 'bg-green-100 text-green-700' :
                      r.abc === 'B' ? 'bg-blue-100 text-blue-700' :
                      r.abc === 'C' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>{r.abc ?? 'S/D'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
