'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { VentasSummary } from '@/app/api/ventas/summary/route'
import type { VentasPorModelo } from '@/app/api/ventas/por-modelo/route'

const TQ_BLUE  = '#00557f'
const TQ_GOLD  = '#C8842A'
const TQ_GREEN = '#3A9E6A'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K €`
  return `${n.toLocaleString('es-ES')} €`
}

function fmtPrecio(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function pctChange(curr: number, prev: number) {
  if (!prev) return null
  return Math.round(((curr - prev) / prev) * 100)
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, change, color = TQ_BLUE }: {
  label: string; value: string; sub?: string; change?: number | null; color?: string
}) {
  return (
    <div className="tq-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#b2b2b2] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub    && <p className="text-xs text-[#b2b2b2] mt-0.5">{sub}</p>}
      {change != null && (
        <p className={`text-xs font-semibold mt-1 ${change >= 0 ? 'text-[#3A9E6A]' : 'text-[#C0392B]'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs año anterior
        </p>
      )}
    </div>
  )
}

function VarBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-[#b2b2b2]">Sin ref.</span>
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-[#3A9E6A]' : 'text-[#C0392B]'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function Sparkline({ data }: { data: { label: string; ingresos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={34}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Bar dataKey="ingresos" fill={TQ_BLUE} opacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, border: '1px solid #e8e3df', borderRadius: 6, padding: '3px 7px' }}
          formatter={(v) => [fmtEur(Number(v ?? 0)), '']}
          labelFormatter={(_, payload) => {
            const d = payload?.[0]?.payload as { label: string; ingresos: number } | undefined
            return d ? <span style={{ color: '#b2b2b2', fontSize: 10 }}>{d.label}</span> : null
          }}
          labelStyle={{ marginBottom: 1 }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl p-8 text-center mt-4" style={{ background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
      <p className="text-sm font-semibold text-red-700">{msg}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl p-12 text-center mt-4" style={{ background: 'rgba(200,132,42,0.04)', border: '1px solid rgba(200,132,42,0.12)' }}>
      <p className="text-3xl mb-2">▨</p>
      <p className="text-sm font-semibold text-[#a06818]">{text}</p>
      <p className="text-xs text-[#b2b2b2] mt-1">Ejecuta el sync de Ventas en Configuración → Sincronización.</p>
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────────────────────

function TabResumen({ data }: { data: VentasSummary }) {
  const [metric, setMetric] = useState<'ingresos' | 'unidades'>('ingresos')
  const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  const ytdChange   = pctChange(data.ytd_ingresos, data.prev_ingresos / 12 * data.ytd_meses)
  const lastMChange = pctChange(data.last_ingresos, data.lm_prev_ingresos)

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={`YTD ${data.last_anyo}`}
          value={fmtEur(data.ytd_ingresos)}
          sub={`${data.ytd_unidades.toLocaleString('es-ES')} uds · ${data.ytd_meses} meses`}
          change={ytdChange}
          color={TQ_BLUE}
        />
        <KpiCard
          label={`${MESES[data.last_mes]} ${data.last_anyo}`}
          value={fmtEur(data.last_ingresos)}
          sub={`${data.last_unidades.toLocaleString('es-ES')} unidades`}
          change={lastMChange}
          color={TQ_GOLD}
        />
        <KpiCard
          label={`Año anterior ${data.last_anyo - 1}`}
          value={fmtEur(data.prev_ingresos)}
          sub={`${data.prev_unidades.toLocaleString('es-ES')} uds · 12 meses`}
          color="#666"
        />
        <KpiCard
          label="Ticket medio (último mes)"
          value={data.last_unidades > 0 ? fmtPrecio(data.last_ingresos / data.last_unidades) : '—'}
          sub="Ingresos ÷ unidades"
          color={TQ_GREEN}
        />
      </div>

      {/* Evolución mensual */}
      <div className="tq-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#00557f]">
            Evolución mensual — últimos 18 meses
          </h2>
          <div className="flex border border-[#e8e3df] rounded-lg overflow-hidden text-xs">
            {(['ingresos', 'unidades'] as const).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: metric === m ? (m === 'ingresos' ? '#e8f4fb' : '#fdf3e4') : 'white',
                  color:      metric === m ? (m === 'ingresos' ? TQ_BLUE : TQ_GOLD) : '#b2b2b2',
                  fontWeight: metric === m ? 700 : 400,
                }}
              >
                {m === 'ingresos' ? '€ Ingresos' : 'Uds.'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.evolucion} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="vg-ing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_BLUE} stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_BLUE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="vg-uds" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TQ_GOLD} stopOpacity={0.15} />
                <stop offset="95%" stopColor={TQ_GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#b2b2b2' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#b2b2b2' }} axisLine={false} tickLine={false} width={42}
              tickFormatter={v => metric === 'ingresos' ? `${(v / 1000).toFixed(0)}K` : String(v)} />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
              formatter={(v) => {
                const n = Number(v ?? 0)
                return metric === 'ingresos'
                  ? [n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), 'Ingresos']
                  : [n.toLocaleString('es-ES'), 'Unidades']
              }}
            />
            <Area type="monotone" dataKey={metric} stroke={metric === 'ingresos' ? TQ_BLUE : TQ_GOLD}
              strokeWidth={2} fill={`url(#vg-${metric === 'ingresos' ? 'ing' : 'uds'})`}
              dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top modelos + Familias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="tq-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#00557f] mb-3">Top 10 referencias · 12m</h2>
          <div className="space-y-2">
            {data.top_modelos.map((m, i) => {
              const maxIng = data.top_modelos[0]?.ingresos_12m ?? 1
              return (
                <div key={m.codigo_modelo} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-4 text-right text-[#b2b2b2]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-[#1d1d1b] truncate">{m.description ?? m.codigo_modelo}</p>
                      <p className="text-xs font-bold text-[#00557f] flex-shrink-0">{fmtEur(m.ingresos_12m)}</p>
                    </div>
                    <div className="h-1 rounded-full mt-1 bg-[#f0ece8]">
                      <div className="h-1 rounded-full"
                        style={{ width: `${Math.round((m.ingresos_12m / maxIng) * 100)}%`, background: TQ_BLUE, opacity: 0.55 + i * -0.04 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="tq-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#00557f] mb-3">Ingresos por familia · 12m</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.por_familia} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#b2b2b2' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="familia" tick={{ fontSize: 11, fill: '#555' }}
                axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
                formatter={(v) => [Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), 'Ingresos']}
              />
              <Bar dataKey="ingresos" fill={TQ_BLUE} radius={[0, 4, 4, 0]} barSize={14}
                label={{
                  position: 'right',
                  formatter: (v: unknown) => `${data.por_familia.find(f => f.ingresos === Number(v))?.pct_ingresos ?? 0}%`,
                  fontSize: 10, fill: '#b2b2b2',
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Por modelo ───────────────────────────────────────────────────────────

function TabPorModelo() {
  const [rows, setRows]       = useState<VentasPorModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [familia, setFamilia] = useState('all')
  const [metal, setMetal]     = useState('all')
  const [order, setOrder]     = useState<'ingresos' | 'unidades' | 'variacion'>('ingresos')
  const [search, setSearch]   = useState('')
  const [familias, setFamilias] = useState<string[]>([])
  const [metales,  setMetales]  = useState<string[]>([])
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ order, limit: '200' })
    if (familia !== 'all') params.set('familia', familia)
    if (metal   !== 'all') params.set('metal',   metal)
    try {
      const res = await fetch(`/api/ventas/por-modelo?${params}`)
      if (!res.ok) throw new Error((await res.json()).error)
      const data: VentasPorModelo[] = await res.json()
      setRows(data)
      if (firstLoad.current) {
        firstLoad.current = false
        const fams = Array.from(new Set(data.map(r => r.familia).filter(Boolean))).sort() as string[]
        const mets = Array.from(new Set(data.map(r => r.metal).filter(Boolean))).sort() as string[]
        setFamilias(fams)
        setMetales(mets)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [familia, metal, order])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? rows.filter(r =>
        r.codigo_modelo.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : rows

  const totalIngresos = filtered.reduce((s, r) => s + r.ingresos_12m, 0)
  const totalUnidades = filtered.reduce((s, r) => s + r.unidades_12m, 0)

  return (
    <div className="space-y-4">
      {/* Filters + totals */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Buscar modelo…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white w-48" />
        <select value={familia} onChange={e => setFamilia(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={metal} onChange={e => setMetal(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">Todos los metales</option>
          {metales.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={order} onChange={e => setOrder(e.target.value as typeof order)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ingresos">Mayor ingreso</option>
          <option value="unidades">Más unidades</option>
          <option value="variacion">Mayor crecimiento</option>
        </select>
        {!loading && !error && (
          <span className="ml-auto text-xs text-[#b2b2b2]">
            <b className="text-[#00557f]">{fmtEur(totalIngresos)}</b>
            {' · '}
            <b className="text-[#C8842A]">{totalUnidades.toLocaleString('es-ES')} uds</b>
            {' · '}
            {filtered.length} referencias
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#b2b2b2] text-sm">Cargando…</div>
      ) : error ? (
        <ErrorBox msg={error} />
      ) : filtered.length === 0 ? (
        <Empty text="Sin datos de ventas disponibles" />
      ) : (
        <div className="tq-card overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[22%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#f4f1ee]">
                {['Modelo (agrupado)', 'Ing. 12m', 'Uds.', 'Var.', 'Últimos 12 meses', 'Activo'].map((h, i) => (
                  <th key={h} className={`px-3 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2] ${i === 0 ? 'text-left' : 'text-right'} ${i === 4 ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f1ee]">
              {filtered.map(r => (
                <tr key={r.codigo_modelo} className="hover:bg-[#fafaf9] transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.imagen ? (
                        <img src={r.imagen} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#f4f1ee] flex items-center justify-center flex-shrink-0">
                          <span className="text-[#c6c6c6] text-xs">◻</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}>{r.codigo_modelo}</span>
                          <span className="text-[10px] text-[#b2b2b2]">{r.familia ?? '—'} · {r.metal ?? '—'}</span>
                        </div>
                        <p className="font-semibold text-[#1d1d1b] text-xs truncate">{r.description ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-xs" style={{ color: TQ_BLUE }}>
                    {fmtEur(r.ingresos_12m)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-[#555]">
                    {r.unidades_12m.toLocaleString('es-ES')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <VarBadge pct={r.variacion_pct} />
                  </td>
                  <td className="px-3 py-2">
                    <Sparkline data={r.sparkline} />
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-[#b2b2b2]">
                    {r.meses_con_ventas}/12
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'modelos'

export default function VentasDashboardClient() {
  const [tab, setTab]       = useState<Tab>('resumen')
  const [summary, setSummary]   = useState<VentasSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ventas/summary')
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then(setSummary)
      .catch(e => setError(typeof e === 'string' ? e : 'Error cargando datos'))
      .finally(() => setLoading(false))
  }, [])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resumen',  label: 'Resumen' },
    { key: 'modelos',  label: 'Por modelo' },
  ]

  return (
    <div className="space-y-0 mt-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#e8e3df] mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={{
              borderColor: tab === t.key ? TQ_BLUE : 'transparent',
              color:       tab === t.key ? TQ_BLUE : '#b2b2b2',
              fontWeight:  tab === t.key ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'resumen' && (
        loading ? (
          <div className="flex items-center justify-center py-24 text-[#b2b2b2] text-sm">Cargando…</div>
        ) : error ? (
          <ErrorBox msg={error} />
        ) : summary ? (
          <TabResumen data={summary} />
        ) : null
      )}

      {tab === 'modelos' && <TabPorModelo />}
    </div>
  )
}
