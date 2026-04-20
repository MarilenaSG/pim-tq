'use client'

import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts'
import { ChartCard } from '@/components/analytics/ChartCard'
import type { CicloEtapa } from './page'

interface ScatterRow { meses: number; ingresos: number; etapa: CicloEtapa; codigo: string; description: string }
interface EtapaRow   { etapa: CicloEtapa; count: number; color: string }
interface AnomaliaRow { codigo_modelo: string; description: string | null; familia: string | null; abc: string | null; ingresos: number; meses: number | null; etapa: string; pctIngresos: number }
interface EdadRow    { rango: string; count: number }

interface Props {
  scatterData:   ScatterRow[]
  etapaData:     EtapaRow[]
  anomalias:     AnomaliaRow[]
  edadData:      EdadRow[]
  etapaColors:   Record<CicloEtapa, string>
}

const ETAPA_ORDER: CicloEtapa[] = ['Nuevo', 'Crecimiento', 'Maduro', 'Declive', 'Sin datos']

const fmtEur = (v: unknown) => {
  const n = Number(v)
  return n >= 1000 ? `${Math.round(n / 1000)}k€` : `${Math.round(n)}€`
}

export function CicloVidaCharts({ scatterData, etapaData, anomalias, edadData, etapaColors }: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: scatter + distribución */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard
            title="Mapa de ciclo de vida"
            subtitle="Edad del producto (meses) vs ingresos 12m · color por etapa"
            height={360}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
                <XAxis
                  type="number"
                  dataKey="meses"
                  name="Edad"
                  tick={{ fontSize: 10, fill: '#b2b2b2' }}
                  label={{ value: 'Meses en catálogo', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#b2b2b2' }}
                />
                <YAxis
                  type="number"
                  dataKey="ingresos"
                  name="Ingresos"
                  tick={{ fontSize: 10, fill: '#b2b2b2' }}
                  tickFormatter={fmtEur}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as ScatterRow
                    return (
                      <div className="bg-white border border-[#e2ddd9] rounded-lg p-3 shadow text-xs space-y-1">
                        <p className="font-bold text-[#00557f] truncate max-w-[200px]">{d.description}</p>
                        <p className="text-[#b2b2b2]">{d.codigo}</p>
                        <p>Edad: <span className="font-semibold">{d.meses} meses</span></p>
                        <p>Ingresos: <span className="font-semibold">{fmtEur(d.ingresos)}</span></p>
                        <span
                          className="inline-block px-2 py-0.5 rounded text-white text-[10px]"
                          style={{ background: etapaColors[d.etapa] }}
                        >
                          {d.etapa}
                        </span>
                      </div>
                    )
                  }}
                />
                {ETAPA_ORDER.map(etapa => {
                  const points = scatterData.filter(d => d.etapa === etapa)
                  if (!points.length) return null
                  return (
                    <Scatter
                      key={etapa}
                      name={etapa}
                      data={points}
                      fill={etapaColors[etapa]}
                      opacity={0.7}
                      r={4}
                    />
                  )
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="space-y-4">
          <ChartCard title="Por etapa" subtitle="Distribución de modelos" height={160}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={etapaData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="etapa" tick={{ fontSize: 9, fill: '#b2b2b2' }} />
                <YAxis tick={{ fontSize: 10, fill: '#b2b2b2' }} />
                <Tooltip
                  formatter={(v: unknown) => [`${Number(v)} modelos`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {etapaData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Antigüedad" subtitle="Nº de modelos por edad" height={160}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={edadData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="rango" tick={{ fontSize: 8, fill: '#b2b2b2' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#b2b2b2' }} />
                <Tooltip
                  formatter={(v: unknown) => [`${Number(v)} modelos`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
                />
                <Bar dataKey="count" fill="#C8842A" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Anomalías */}
      {anomalias.length > 0 && (
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#C0392B] uppercase tracking-wider">
              Anomalías: Declive con ingresos relevantes
            </h3>
            <p className="text-xs text-[#b2b2b2] mt-0.5">
              Productos clasificados en declive que aún generan ingresos destacados — candidatos a revisión o renovación
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2ddd9]">
                  {['Código', 'Descripción', 'Familia', 'ABC', 'Edad', 'Ingresos 12m', '% del total'].map(h => (
                    <th key={h} className="text-left pb-2 text-xs font-bold text-[#00557f] uppercase tracking-wider pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anomalias.map((r, i) => (
                  <tr key={i} className="border-b border-[#f0ece8] hover:bg-[#fdf3e4]/40 transition-colors">
                    <td className="py-2 pr-4 font-mono text-xs text-[#b2b2b2]">{r.codigo_modelo}</td>
                    <td className="py-2 pr-4 text-[#1d1d1b] max-w-[220px] truncate">{r.description ?? '—'}</td>
                    <td className="py-2 pr-4 text-[#b2b2b2]">{r.familia ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        r.abc === 'A' ? 'bg-green-100 text-green-700' :
                        r.abc === 'B' ? 'bg-blue-100 text-blue-700' :
                        r.abc === 'C' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>{r.abc ?? 'S/D'}</span>
                    </td>
                    <td className="py-2 pr-4 text-[#b2b2b2]">{r.meses != null ? `${r.meses}m` : '—'}</td>
                    <td className="py-2 pr-4 font-semibold text-[#00557f]">
                      {r.ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 text-[#C8842A] font-semibold">{r.pctIngresos.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
