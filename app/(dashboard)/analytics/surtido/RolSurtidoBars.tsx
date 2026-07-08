'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

export interface RolSurtidoDatum {
  rol:   string
  count: number
  color: string
}

export function RolSurtidoBars({ data }: { data: RolSurtidoDatum[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="tq-table-wrap p-5 mb-8">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-semibold text-[#00264d]">Rol de surtido</h3>
        <span className="text-[11px] text-[#8fa8b8]">{total.toLocaleString('es-ES')} modelos activos clasificados</span>
      </div>
      <div style={{ width: '100%', height: 300 }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.08)" vertical={false} />
            <XAxis dataKey="rol" tick={{ fontSize: 11, fill: '#8fa8b8' }} interval={0} height={40} />
            <YAxis tick={{ fontSize: 11, fill: '#8fa8b8' }} allowDecimals={false} />
            <Tooltip
              formatter={(v) => [`${Number(v).toLocaleString('es-ES')} modelos`, 'Modelos']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,85,127,0.12)' }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#00264d', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
