'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ComposedChart, Line, Cell, PieChart, Pie, Legend,
  type PieLabelRenderProps,
} from 'recharts'
import { ChartCard } from '@/components/analytics/ChartCard'
import { ProductActionList } from '@/components/products/ProductActionList'
import type { HeatmapData } from './page'

interface AmplitudRow { familia: string; modelos: number; avgVariantes: number }
interface ParetoRow   { rank: number; codigo: string; ingresos: number; pct: number }
interface AbcRow      { name: string; value: number; color: string }

interface Props {
  amplitudData: AmplitudRow[]
  paretoData:   ParetoRow[]
  abcData:      AbcRow[]
  heatmapData:  HeatmapData
}

const fmtEur = (v: unknown) => {
  const n = Number(v)
  return n >= 1000 ? `${Math.round(n / 1000)}k€` : `${Math.round(n)}€`
}

async function fetchFilter(params: Record<string, string>): Promise<string[]> {
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`/api/products/filter?${qs}`)
  return res.ok ? res.json() : []
}

type HeatMode = 'modelos' | 'ingresos'

export function SurtidoCharts({ amplitudData, paretoData, abcData, heatmapData }: Props) {
  const [actionCodes, setActionCodes] = useState<string[]>([])
  const [actionTitle, setActionTitle] = useState('')
  const [heatMode, setHeatMode]       = useState<HeatMode>('modelos')

  async function selectByFamilia(familia: string) {
    const codes = await fetchFilter({ familia })
    setActionCodes(codes)
    setActionTitle(`Familia: ${familia}`)
  }

  async function selectByAbc(abc: string) {
    const codes = await fetchFilter({ abc })
    setActionCodes(codes)
    setActionTitle(`ABC ${abc}`)
  }

  function selectByCodigo(codigo: string) {
    setActionCodes([codigo])
    setActionTitle(`Producto ${codigo}`)
  }

  async function selectByFamiliaAndMetal(familia: string, metal: string) {
    const codes = await fetchFilter({ familia, metal })
    setActionCodes(codes)
    setActionTitle(`${familia} · ${metal}`)
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Amplitud + Profundidad */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="Amplitud por familia"
          subtitle="Número de modelos · clic para ver productos"
          height={380}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={amplitudData}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#b2b2b2' }} />
              <YAxis
                type="category"
                dataKey="familia"
                width={90}
                tick={{ fontSize: 10, fill: '#00557f' }}
              />
              <Tooltip
                formatter={(v: unknown) => [`${Number(v)} modelos`, 'Modelos']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Bar
                dataKey="modelos"
                fill="#00557f"
                radius={[0, 3, 3, 0]}
                maxBarSize={18}
                cursor="pointer"
                onClick={(d: any) => selectByFamilia(d.familia)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Profundidad por familia"
          subtitle="Promedio de variantes · clic para ver productos"
          height={380}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={amplitudData}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#b2b2b2' }} />
              <YAxis
                type="category"
                dataKey="familia"
                width={90}
                tick={{ fontSize: 10, fill: '#00557f' }}
              />
              <Tooltip
                formatter={(v: unknown) => [`${Number(v)} var/modelo`, 'Profundidad']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Bar
                dataKey="avgVariantes"
                fill="#C8842A"
                radius={[0, 3, 3, 0]}
                maxBarSize={18}
                cursor="pointer"
                onClick={(d: any) => selectByFamilia(d.familia)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Pareto + ABC */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard
            title="Pareto de ingresos"
            subtitle="Top 30 modelos · clic en barra para ver el producto"
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={paretoData}
                margin={{ top: 4, right: 48, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
                <XAxis
                  dataKey="rank"
                  tick={{ fontSize: 10, fill: '#b2b2b2' }}
                  label={{ value: 'Ranking', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#b2b2b2' }}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#00557f' }} tickFormatter={fmtEur} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#C8842A' }}
                  tickFormatter={(v: unknown) => `${Number(v)}%`}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) =>
                    name === 'ingresos'
                      ? [fmtEur(v), 'Ingresos 12m']
                      : [`${Number(v)}%`, 'Acumulado']
                  }
                  labelFormatter={(rank: unknown) => {
                    const row = paretoData[Number(rank) - 1]
                    return row ? row.codigo : `#${rank}`
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="ingresos"
                  fill="#00557f"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                  cursor="pointer"
                  onClick={(d: any) => selectByCodigo(d.codigo)}
                />
                <Line yAxisId="right" type="monotone" dataKey="pct" stroke="#C8842A" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard
          title="Distribución ABC"
          subtitle="Modelos por clasificación · clic para ver"
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={abcData}
                cx="50%"
                cy="45%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                cursor="pointer"
                label={(p: PieLabelRenderProps) =>
                  `${String(p.name)} ${Math.round(Number(p.percent) * 100)}%`
                }
                labelLine={false}
                onClick={(d: any) => selectByAbc(d.name)}
              >
                {abcData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown, name: unknown) => [`${Number(v)} modelos`, `ABC ${String(name)}`]}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Heat map familia × metal */}
      {heatmapData.familias.length > 0 && heatmapData.metales.length > 0 && (
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#00557f] uppercase tracking-wider">Surtido familia × metal</h3>
              <p className="text-xs text-[#b2b2b2] mt-0.5">
                Clic en celda para ver productos · colores por intensidad
              </p>
            </div>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(0,85,127,0.15)' }}>
              {(['modelos', 'ingresos'] as HeatMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setHeatMode(m)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: heatMode === m ? '#00557f' : 'white',
                    color: heatMode === m ? 'white' : '#b2b2b2',
                  }}
                >
                  {m === 'modelos' ? 'Modelos' : 'Ingresos'}
                </button>
              ))}
            </div>
          </div>

          <HeatGrid
            heatmapData={heatmapData}
            mode={heatMode}
            onCellClick={selectByFamiliaAndMetal}
            onFamiliaClick={selectByFamilia}
          />
        </div>
      )}

      {/* Product action list */}
      {actionCodes.length > 0 && (
        <ProductActionList
          codigosModelo={actionCodes}
          titulo={actionTitle}
          onClose={() => setActionCodes([])}
          context="analytics"
        />
      )}
    </div>
  )
}

// ── Heat grid sub-component ──────────────────────────────────────

function HeatGrid({
  heatmapData,
  mode,
  onCellClick,
  onFamiliaClick,
}: {
  heatmapData: HeatmapData
  mode: HeatMode
  onCellClick: (familia: string, metal: string) => void
  onFamiliaClick: (familia: string) => void
}) {
  const { familias, metales, cells } = heatmapData

  const maxVal = useMemo(() => {
    let m = 0
    for (const f of familias) {
      for (const metal of metales) {
        const cell = cells[f]?.[metal]
        if (!cell) continue
        const v = mode === 'modelos' ? cell.count : cell.ingresos
        if (v > m) m = v
      }
    }
    return m
  }, [familias, metales, cells, mode])

  const fmtCell = (cell: { count: number; ingresos: number } | undefined) => {
    if (!cell || cell.count === 0) return ''
    if (mode === 'modelos') return String(cell.count)
    const n = cell.ingresos
    return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
  }

  const rowTotal = (familia: string) => {
    let total = 0
    for (const m of metales) {
      const cell = cells[familia]?.[m]
      if (!cell) continue
      total += mode === 'modelos' ? cell.count : cell.ingresos
    }
    return total
  }

  const colTotal = (metal: string) => {
    let total = 0
    for (const f of familias) {
      const cell = cells[f]?.[metal]
      if (!cell) continue
      total += mode === 'modelos' ? cell.count : cell.ingresos
    }
    return total
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 font-bold text-[#00557f] uppercase tracking-wider whitespace-nowrap" style={{ minWidth: 120 }}>
              Familia
            </th>
            {metales.map(m => (
              <th key={m} className="py-2 px-2 font-bold text-[#b2b2b2] uppercase tracking-wider text-center whitespace-nowrap">
                {m}
              </th>
            ))}
            <th className="py-2 px-2 font-bold text-[#00557f] uppercase tracking-wider text-right whitespace-nowrap">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {familias.map(familia => (
            <tr key={familia} className="border-t" style={{ borderColor: 'rgba(0,85,127,0.06)' }}>
              <td className="py-1.5 pr-4 whitespace-nowrap">
                <button
                  onClick={() => onFamiliaClick(familia)}
                  className="font-medium text-[#00557f] hover:underline text-left"
                >
                  {familia}
                </button>
              </td>
              {metales.map(metal => {
                const cell  = cells[familia]?.[metal]
                const val   = cell ? (mode === 'modelos' ? cell.count : cell.ingresos) : 0
                const ratio = maxVal > 0 && val > 0 ? val / maxVal : 0
                const alpha = Math.round((0.08 + ratio * 0.72) * 100) / 100
                const light = ratio > 0.55

                return (
                  <td
                    key={metal}
                    onClick={() => val > 0 && onCellClick(familia, metal)}
                    title={val > 0 ? `${familia} · ${metal}: ${fmtCell(cell)}` : undefined}
                    className="py-1.5 px-2 text-center font-semibold rounded transition-all"
                    style={{
                      background: val > 0 ? `rgba(0,85,127,${alpha})` : '#f9f8f7',
                      color: light ? 'white' : val > 0 ? '#00557f' : '#e8e3df',
                      cursor: val > 0 ? 'pointer' : 'default',
                      minWidth: 56,
                    }}
                  >
                    {fmtCell(cell)}
                  </td>
                )
              })}
              <td className="py-1.5 px-2 text-right font-bold" style={{ color: '#00557f' }}>
                {(() => {
                  const t = rowTotal(familia)
                  return mode === 'ingresos'
                    ? (t >= 1000 ? `${Math.round(t / 1000)}k` : String(Math.round(t)))
                    : String(t)
                })()}
              </td>
            </tr>
          ))}
          {/* Total row */}
          <tr className="border-t-2" style={{ borderColor: 'rgba(0,85,127,0.15)' }}>
            <td className="py-2 pr-4 font-bold text-[#00557f] uppercase tracking-wider text-xs">Total</td>
            {metales.map(metal => {
              const t = colTotal(metal)
              return (
                <td key={metal} className="py-2 px-2 text-center font-bold text-[#00557f] text-xs">
                  {mode === 'ingresos' ? (t >= 1000 ? `${Math.round(t / 1000)}k` : String(Math.round(t))) : String(t)}
                </td>
              )
            })}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
