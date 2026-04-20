'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { ChartCard } from '@/components/analytics/ChartCard'

interface FamiliaRow  { familia: string; stock: number; sinStock: number; coberturaMedia: number }
interface CobRow      { rango: string; count: number }
interface AlertaRow   { codigo: string; desc: string; familia: string; abc: string | null; stock: number; cobertura: number | null; precio: number | null }

interface Props {
  familiaData:       FamiliaRow[]
  coberturaData:     CobRow[]
  alertasSinStock:   AlertaRow[]
  alertasExceso:     AlertaRow[]
}

export function StockCharts({ familiaData, coberturaData, alertasSinStock, alertasExceso }: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: stock x familia + cobertura distribución */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard
            title="Stock por familia"
            subtitle="Unidades totales en existencia"
            height={340}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={familiaData}
                layout="vertical"
                margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#b2b2b2' }} />
                <YAxis type="category" dataKey="familia" width={90} tick={{ fontSize: 10, fill: '#00557f' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as FamiliaRow
                    return (
                      <div className="bg-white border border-[#e2ddd9] rounded-lg p-3 shadow text-xs space-y-1">
                        <p className="font-bold text-[#00557f]">{d.familia}</p>
                        <p>Stock: <span className="font-semibold">{d.stock.toLocaleString('es-ES')} uds</span></p>
                        <p>Sin stock: <span className="font-semibold">{d.sinStock} modelos</span></p>
                        <p>Cobertura media: <span className="font-semibold">{d.coberturaMedia}m</span></p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="stock" fill="#00557f" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Distribución de cobertura" subtitle="Meses de stock a ritmo actual" height={340}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={coberturaData} margin={{ top: 0, right: 8, bottom: 36, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
              <XAxis dataKey="rango" tick={{ fontSize: 8.5, fill: '#b2b2b2' }} angle={-35} textAnchor="end" interval={0} />
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

      {/* Row 2: cobertura media por familia */}
      <ChartCard
        title="Cobertura media por familia"
        subtitle="Meses de stock estimados · línea roja = 12 meses (exceso)"
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...familiaData].sort((a, b) => b.coberturaMedia - a.coberturaMedia)}
            layout="vertical"
            margin={{ top: 0, right: 60, bottom: 0, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece8" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#b2b2b2' }}
              tickFormatter={(v: unknown) => `${Number(v)}m`}
            />
            <YAxis type="category" dataKey="familia" width={90} tick={{ fontSize: 10, fill: '#00557f' }} />
            <Tooltip
              formatter={(v: unknown) => [`${Number(v)} meses`, 'Cobertura media']}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2ddd9' }}
            />
            <ReferenceLine x={12} stroke="#C0392B" strokeDasharray="4 2" strokeWidth={1.5} />
            <Bar dataKey="coberturaMedia" fill="#3A9E6A" radius={[0, 3, 3, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Alertas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Sin stock ABC-A */}
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <h3 className="text-sm font-bold text-[#C0392B] uppercase tracking-wider mb-1">
            Rotura de stock · ABC A
          </h3>
          <p className="text-xs text-[#b2b2b2] mb-4">Productos sin stock que más venden — priorizar reposición</p>
          {alertasSinStock.length === 0 ? (
            <p className="text-sm text-[#3A9E6A]">Sin alertas — todos los modelos ABC-A tienen stock</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e2ddd9]">
                  {['Código', 'Descripción', 'Familia', 'PVP'].map(h => (
                    <th key={h} className="text-left pb-2 font-bold text-[#00557f] uppercase tracking-wider pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertasSinStock.map((r, i) => (
                  <tr key={i} className="border-b border-[#f0ece8]">
                    <td className="py-1.5 pr-3 font-mono text-[#b2b2b2]">{r.codigo}</td>
                    <td className="py-1.5 pr-3 text-[#1d1d1b] truncate max-w-[120px]">{r.desc}</td>
                    <td className="py-1.5 pr-3 text-[#b2b2b2]">{r.familia}</td>
                    <td className="py-1.5 text-[#00557f] font-semibold">
                      {r.precio != null
                        ? r.precio.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Exceso de stock */}
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <h3 className="text-sm font-bold text-[#C8842A] uppercase tracking-wider mb-1">
            Exceso de stock · &gt;12 meses
          </h3>
          <p className="text-xs text-[#b2b2b2] mb-4">Capital inmovilizado — revisar política de compras o promociones</p>
          {alertasExceso.length === 0 ? (
            <p className="text-sm text-[#3A9E6A]">Sin alertas de exceso de stock</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e2ddd9]">
                  {['Código', 'Descripción', 'ABC', 'Cobertura'].map(h => (
                    <th key={h} className="text-left pb-2 font-bold text-[#00557f] uppercase tracking-wider pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertasExceso.map((r, i) => (
                  <tr key={i} className="border-b border-[#f0ece8]">
                    <td className="py-1.5 pr-3 font-mono text-[#b2b2b2]">{r.codigo}</td>
                    <td className="py-1.5 pr-3 text-[#1d1d1b] truncate max-w-[140px]">{r.desc}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.abc === 'A' ? 'bg-green-100 text-green-700' :
                        r.abc === 'B' ? 'bg-blue-100 text-blue-700' :
                        r.abc === 'C' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>{r.abc ?? 'S/D'}</span>
                    </td>
                    <td className="py-1.5 font-semibold text-[#C8842A]">
                      {r.cobertura != null ? `${r.cobertura}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
