'use client'

import Link from 'next/link'
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import type { Tienda, TiendaTendencia, TiendaFamilia, TiendaMetal, TiendaTopPorMetal, TiendaCluster } from '@/types'

// ── Helpers ───────────────────────────────────────────────────

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function mesLabel(anyo: number, mes: number): string {
  return `${MESES[mes - 1]} ${String(anyo).slice(2)}`
}

function fmtEuro(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

function fmtEuroShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M €'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K €'
  return n.toFixed(0) + ' €'
}

function mbColor(mb: number | null): string {
  if (mb == null) return '#8fa8b8'
  if (mb >= 50)   return '#3A9E6A'
  if (mb >= 40)   return '#C8842A'
  return '#C0392B'
}

const CLUSTER_COLOR: Record<TiendaCluster, string> = {
  A: '#3A9E6A',
  B: '#0099f2',
  C: '#C8842A',
}
const CLUSTER_BG: Record<TiendaCluster, string> = {
  A: 'rgba(58,158,106,0.12)',
  B: 'rgba(0,153,242,0.12)',
  C: 'rgba(200,132,42,0.12)',
}

const METAL_COLOR: Record<string, string> = {
  'Oro':   '#c8a164',
  'Plata': '#8fa8b8',
  'Acero': '#5a7a8a',
}
function metalColor(metal: string): string {
  return METAL_COLOR[metal] ?? '#b2b2b2'
}

const FAMILIA_PALETTE = [
  '#00557f','#0099f2','#3A9E6A','#C8842A','#c8a164','#8fa8b8','#5a7a8a','#C0392B',
]

// ── Sub-components ────────────────────────────────────────────

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background: bg }}
    >
      {children}
    </span>
  )
}

function AbcBadge({ abc }: { abc: string | null }) {
  if (!abc) return <span style={{ color: '#8fa8b8' }}>—</span>
  const styles: Record<string, { color: string; bg: string }> = {
    A: { color: '#2d7a54', bg: 'rgba(58,158,106,0.12)' },
    B: { color: '#006da3', bg: 'rgba(0,153,242,0.12)' },
    C: { color: '#a06818', bg: 'rgba(200,132,42,0.12)' },
  }
  const s = styles[abc] ?? { color: '#8fa8b8', bg: 'rgba(0,0,0,0.06)' }
  return <Badge color={s.color} bg={s.bg}>{abc}</Badge>
}

function KpiPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="flex flex-col bg-white rounded-xl px-5 py-4"
      style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>{label}</span>
      <span className="mt-1 text-2xl font-bold" style={{ color: '#00557f', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <span className="mt-0.5 text-[11px]" style={{ color: '#8fa8b8' }}>{sub}</span>}
    </div>
  )
}

// ── Custom Tooltip para AreaChart ─────────────────────────────

function TendenciaTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg shadow-lg px-3 py-2 text-xs border" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
      <p className="font-semibold mb-1" style={{ color: '#00264d' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: '#5a7a8a' }}>
          {p.name === 'ingresos' ? 'Ingresos: ' : 'Uds: '}
          <span style={{ color: '#00557f', fontWeight: 600 }}>
            {p.name === 'ingresos' ? fmtEuro(p.value) : p.value.toLocaleString('es-ES')}
          </span>
        </p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

interface Props {
  tienda:    Tienda
  tendencia: TiendaTendencia[]
  familias:  TiendaFamilia[]
  metales:   TiendaMetal[]
  topOro:    TiendaTopPorMetal[]
  topPlata:  TiendaTopPorMetal[]
}

export function TiendaDetailClient({ tienda, tendencia, familias, metales, topOro, topPlata }: Props) {
  // ── Derived KPIs ──────────────────────────────────────────
  const ingresos12m = tendencia.reduce((s, r) => s + r.ingresos, 0)
  const uds12m      = tendencia.reduce((s, r) => s + r.uds,      0)
  const coste12m    = tendencia.reduce((s, r) => s + r.coste,    0)
  const mb          = ingresos12m > 0 ? (ingresos12m - coste12m) / ingresos12m * 100 : null
  const ticket      = uds12m > 0 ? ingresos12m / uds12m : null
  const nModelos    = new Set([...topOro, ...topPlata].map(p => p.codigo_modelo)).size

  // Chart data
  const tendenciaData = tendencia.map(r => ({
    label:    mesLabel(r.anyo, r.mes),
    ingresos: r.ingresos,
    uds:      r.uds,
  }))

  const familiasData = familias.slice(0, 8).map((f, i) => ({
    name:     f.familia,
    ingresos: f.ingresos,
    fill:     FAMILIA_PALETTE[i % FAMILIA_PALETTE.length],
  }))

  const metalesData = metales.map(m => ({
    name:  m.metal,
    value: m.ingresos,
    fill:  metalColor(m.metal),
  }))
  const totalMetales = metalesData.reduce((s, m) => s + m.value, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ── HEADER ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/tiendas" style={{ color: '#8fa8b8', fontSize: 13, textDecoration: 'none' }}>
            Red de tiendas
          </Link>
          <span style={{ color: '#8fa8b8' }}>›</span>
          <span style={{ color: '#5a7a8a', fontSize: 13 }}>{tienda.nombre_corto ?? tienda.nombre}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1
            className="text-3xl font-bold leading-tight"
            style={{ color: '#00557f', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {tienda.nombre}
          </h1>
          <div className="flex items-center gap-2 shrink-0 pt-1 flex-wrap">
            {tienda.cluster && (
              <Badge
                color={CLUSTER_COLOR[tienda.cluster]}
                bg={CLUSTER_BG[tienda.cluster]}
              >
                Cluster {tienda.cluster}
              </Badge>
            )}
            {tienda.zona && (
              <Badge color="#00557f" bg="rgba(0,85,127,0.08)">{tienda.zona}</Badge>
            )}
            {tienda.tipo && (
              <Badge color="#5a7a8a" bg="rgba(90,122,138,0.08)">{tienda.tipo}</Badge>
            )}
            {tienda.isla && (
              <Badge color="#8fa8b8" bg="rgba(143,168,184,0.12)">{tienda.isla}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-5 gap-3">
        <KpiPill label="Ingresos 12m"  value={fmtEuro(ingresos12m)} />
        <KpiPill label="Uds 12m"       value={uds12m.toLocaleString('es-ES')} />
        <KpiPill
          label="MB%"
          value={mb != null ? `${mb.toFixed(1)}%` : '—'}
        />
        <KpiPill
          label="Ticket medio"
          value={ticket != null ? fmtEuro(ticket) : '—'}
        />
        <KpiPill
          label="Productos distintos"
          value={nModelos > 0 ? String(nModelos) : (topProductos.length > 0 ? `+${topProductos.length}` : '—')}
          sub="top 15 mostrados"
        />
      </div>

      {/* ── TENDENCIA MENSUAL ── */}
      <section>
        <h2
          className="text-base font-semibold mb-4"
          style={{ color: '#00557f', fontFamily: 'inherit' }}
        >
          Tendencia mensual
        </h2>
        {tendenciaData.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#8fa8b8', boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            Sin datos de ventas
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tendenciaData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tq-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00557f" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#00557f" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#8fa8b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtEuroShort}
                  tick={{ fontSize: 11, fill: '#8fa8b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip content={<TendenciaTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#00557f"
                  strokeWidth={2}
                  fill="url(#tq-area-grad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#00557f' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── DESGLOSE: FAMILIAS + METALES ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Por familia */}
        <section>
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: '#00557f', fontFamily: 'inherit' }}
          >
            Por familia
          </h2>
          {familiasData.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#8fa8b8', boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              Sin datos
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={familiasData}
                  layout="vertical"
                  margin={{ top: 0, right: 60, bottom: 0, left: 8 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={fmtEuroShort}
                    tick={{ fontSize: 10, fill: '#8fa8b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11, fill: '#5a7a8a' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [typeof v === 'number' ? fmtEuro(v) : '—', 'Ingresos']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,85,127,0.1)' }}
                  />
                  <Bar dataKey="ingresos" radius={[0, 4, 4, 0]}>
                    {familiasData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Por metal */}
        <section>
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: '#00557f', fontFamily: 'inherit' }}
          >
            Por metal
          </h2>
          {metalesData.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center" style={{ color: '#8fa8b8', boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              Sin datos
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={metalesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    innerRadius={50}
                  >
                    {metalesData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => {
                      const val = typeof v === 'number' ? v : 0
                      const label = typeof name === 'string' ? name : ''
                      return [
                        `${fmtEuro(val)} (${totalMetales > 0 ? ((val / totalMetales) * 100).toFixed(1) : 0}%)`,
                        label,
                      ]
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,85,127,0.1)' }}
                  />
                  <Legend
                    iconSize={10}
                    formatter={(value: string, entry: { payload?: object }) => {
                      const payload = entry.payload as { value?: number } | undefined
                      const pct = totalMetales > 0 && payload?.value != null
                        ? ((payload.value / totalMetales) * 100).toFixed(1)
                        : '0.0'
                      return (
                        <span style={{ color: '#5a7a8a', fontSize: 12 }}>
                          {value} <span style={{ color: '#8fa8b8' }}>({pct}%)</span>
                        </span>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* ── TOP ORO / TOP PLATA ── */}
      <div className="grid grid-cols-2 gap-6">
        <TopMetalTable
          titulo="Top Oro"
          color="#c8a164"
          bgColor="rgba(200,161,100,0.08)"
          productos={topOro}
        />
        <TopMetalTable
          titulo="Top Plata"
          color="#5a7a8a"
          bgColor="rgba(90,122,138,0.08)"
          productos={topPlata}
        />
      </div>

    </div>
  )
}

// ── Top por metal: tabla reutilizable ─────────────────────────

function TopMetalTable({
  titulo,
  color,
  bgColor,
  productos,
}: {
  titulo:   string
  color:    string
  bgColor:  string
  productos: TiendaTopPorMetal[]
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <h2 className="text-base font-semibold" style={{ color: '#00557f' }}>
          {titulo}
        </h2>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-auto"
          style={{ background: bgColor, color }}
        >
          por unidades
        </span>
      </div>

      {productos.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center text-sm"
          style={{ background: bgColor, color: '#8fa8b8' }}
        >
          Sin ventas en los últimos 12 meses
        </div>
      ) : (
        <div className="tq-table-wrap">
          <table className="tq-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Familia</th>
                <th>Kt</th>
                <th>ABC</th>
                <th className="right">Uds</th>
                <th className="right">MB%</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, idx) => (
                <tr key={p.codigo_modelo}>
                  <td style={{ color: '#8fa8b8', fontWeight: 700, fontSize: 11 }}>{idx + 1}</td>
                  <td>
                    <Link
                      href={`/products/${p.codigo_modelo}`}
                      className="font-mono text-[12px] font-semibold"
                      style={{ color: '#0099f2' }}
                    >
                      {p.codigo_modelo}
                    </Link>
                  </td>
                  <td style={{ color: '#00264d', maxWidth: 160 }}>
                    <span className="line-clamp-2 text-[12px]">{p.description ?? '—'}</span>
                  </td>
                  <td style={{ color: '#5a7a8a', fontSize: 12 }}>{p.familia ?? '—'}</td>
                  <td style={{ color: '#8fa8b8', fontSize: 11 }}>{p.karat ?? '—'}</td>
                  <td><AbcBadge abc={p.abc_ventas} /></td>
                  <td
                    className="text-right font-mono tabular-nums font-semibold"
                    style={{ color }}
                  >
                    {p.uds.toLocaleString('es-ES')}
                  </td>
                  <td className="text-right font-semibold" style={{ color: mbColor(p.mb_pct) }}>
                    {p.mb_pct != null ? `${p.mb_pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
