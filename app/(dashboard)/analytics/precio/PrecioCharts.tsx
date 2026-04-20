'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts'
import { ChartCard } from '@/components/analytics/ChartCard'

interface FamiliaStats {
  familia:         string
  precioMedio:     number
  precioMin:       number
  precioMax:       number
  descuentoMedio:  number
  margenMedio:     number
  count:           number
}
interface BucketRow { rango: string; count: number }

interface Props {
  familiaStats:     FamiliaStats[]
  distribucionData: BucketRow[]
}

const fmtEur = (v: unknown) => `${Number(v).toLocaleString('es-ES')}€`

export function PrecioCharts({ familiaStats, distribucionData }: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: precio medio por familia + distribución */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard
            title="Precio medio por familia"
            subtitle="Variante líder de cada modelo · ordenado de mayor a menor"
            height={360}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={familiaStats}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#b2b2b2' }}
                  tickFormatter={(v: unknown) => `${Number(v)}€`}
                />
                <YAxis
                  type="category"
                  dataKey="familia"
                  width={90}
                  tick={{ fontSize: 10, fill: '#00557f' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as FamiliaStats
                    return (
                      <div className="bg-white border border-[#e2ddd9] rounded-lg p-3 shadow text-xs space-y-1">
                        <p className="font-bold text-[#00557f]">{d.familia}</p>
                        <p>Precio medio: <span className="font-semibold">{fmtEur(d.precioMedio)}</span></p>
                        <p>Rango: {fmtEur(d.precioMin)} – {fmtEur(d.precioMax)}</p>
                        <p>Modelos: {d.count}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="precioMedio" fill="#00557f" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard
          title="Distribución de precios"
          subtitle="Nº de modelos por rango de PVP"
          height={360}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={distribucionData}
              margin={{ top: 0, right: 8, bottom: 40, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
              <XAxis
                dataKey="rango"
                tick={{ fontSize: 9, fill: '#b2b2b2' }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#b2b2b2' }} />
              <Tooltip
                formatter={(v: unknown) => [`${Number(v)} modelos`, 'Modelos']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Bar dataKey="count" fill="#C8842A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: márgenes + descuentos */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard
          title="Margen bruto por familia"
          subtitle="Promedio % sobre variantes líderes"
          height={340}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...familiaStats].sort((a, b) => b.margenMedio - a.margenMedio)}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#b2b2b2' }}
                tickFormatter={(v: unknown) => `${Number(v)}%`}
                domain={[0, 'auto']}
              />
              <YAxis
                type="category"
                dataKey="familia"
                width={90}
                tick={{ fontSize: 10, fill: '#00557f' }}
              />
              <Tooltip
                formatter={(v: unknown) => [`${Number(v)}%`, 'Margen bruto medio']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <ReferenceLine x={50} stroke="#C0392B" strokeDasharray="4 2" strokeWidth={1.5} />
              <Bar
                dataKey="margenMedio"
                radius={[0, 3, 3, 0]}
                maxBarSize={18}
                fill="#3A9E6A"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Descuento medio por familia"
          subtitle="Promedio €descuento en modelos con precio tachado"
          height={340}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...familiaStats]
                .filter(d => d.descuentoMedio > 0)
                .sort((a, b) => b.descuentoMedio - a.descuentoMedio)}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#b2b2b2' }}
                tickFormatter={fmtEur}
              />
              <YAxis
                type="category"
                dataKey="familia"
                width={90}
                tick={{ fontSize: 10, fill: '#00557f' }}
              />
              <Tooltip
                formatter={(v: unknown) => [fmtEur(v), 'Descuento medio']}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
              />
              <Bar dataKey="descuentoMedio" fill="#C0392B" radius={[0, 3, 3, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
