'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ComposedChart, Line, Cell, PieChart, Pie, Legend,
  type PieLabelRenderProps,
} from 'recharts'
import { ChartCard } from '@/components/analytics/ChartCard'

interface AmplitudRow { familia: string; modelos: number; avgVariantes: number }
interface ParetoRow   { rank: number; codigo: string; ingresos: number; pct: number }
interface AbcRow      { name: string; value: number; color: string }

interface Props {
  amplitudData: AmplitudRow[]
  paretoData:   ParetoRow[]
  abcData:      AbcRow[]
}

const fmtEur = (v: unknown) => {
  const n = Number(v)
  return n >= 1000 ? `${Math.round(n / 1000)}k€` : `${Math.round(n)}€`
}

export function SurtidoCharts({ amplitudData, paretoData, abcData }: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: Amplitud + Profundidad */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="Amplitud por familia"
          subtitle="Número de modelos por familia"
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
              <Bar dataKey="modelos" fill="#00557f" radius={[0, 3, 3, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Profundidad por familia"
          subtitle="Promedio de variantes por modelo"
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
              <Bar dataKey="avgVariantes" fill="#C8842A" radius={[0, 3, 3, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Pareto + ABC */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard
            title="Pareto de ingresos"
            subtitle="Top 30 modelos · barras = ingresos · línea = % acumulado"
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
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: '#00557f' }}
                  tickFormatter={fmtEur}
                />
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
                    const i = Number(rank)
                    const row = paretoData[i - 1]
                    return row ? row.codigo : `#${i}`
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="ingresos"
                  fill="#00557f"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pct"
                  stroke="#C8842A"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard
          title="Distribución ABC"
          subtitle="Modelos por clasificación de ventas"
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
                label={(p: PieLabelRenderProps) =>
                  `${String(p.name)} ${Math.round(Number(p.percent) * 100)}%`
                }
                labelLine={false}
              >
                {abcData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown, name: unknown) => [`${Number(v)} modelos`, `ABC ${String(name)}`]}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
