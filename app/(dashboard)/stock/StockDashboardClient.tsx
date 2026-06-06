'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Legend,
} from 'recharts'
import type { StockSummary } from '@/app/api/stock/summary/route'
import type { StockPorModelo } from '@/app/api/stock/por-modelo/route'

const TQ_BLUE  = '#00557f'
const TQ_GOLD  = '#C8842A'
const TQ_GREEN = '#3A9E6A'
const TQ_RED   = '#C0392B'

type AlertType = 'rotura' | 'exceso'
type Tab = 'alertas' | 'inventario'
type NivelFilter = 'all' | 'sin_stock' | 'bajo' | 'normal' | 'alto'

function NivelBadge({ nivel }: { nivel: StockPorModelo['nivel'] }) {
  const cfg = {
    sin_stock: { label: 'Sin stock',  color: TQ_RED,   bg: '#fdf0f0' },
    bajo:      { label: 'Bajo',       color: TQ_GOLD,  bg: '#fdf3e4' },
    normal:    { label: 'Normal',     color: TQ_GREEN, bg: '#e8f5f0' },
    alto:      { label: 'Alto',       color: TQ_BLUE,  bg: '#e8f4fb' },
  }[nivel]
  return (
    <span className="text-xs font-semibold rounded-full px-2 py-0.5"
      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  )
}

function KpiCard({
  label, value, sub, color, alert,
}: {
  label: string; value: string; sub?: string; color?: string; alert?: boolean
}) {
  return (
    <div className={`tq-card p-4 ${alert ? 'ring-1 ring-[#C0392B]/30' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-[#b2b2b2] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? TQ_BLUE }}>{value}</p>
      {sub && <p className="text-xs text-[#b2b2b2] mt-0.5">{sub}</p>}
    </div>
  )
}

function AlertRow({
  item, type,
}: {
  item: StockSummary['alertas_rotura'][0]
  type: AlertType
}) {
  const urgente = type === 'rotura' && (item.cobertura_dias ?? 99) <= 7

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#f4f1ee] last:border-0 ${urgente ? 'bg-red-50/60' : 'hover:bg-[#fafaf9]'}`}>
      {item.imagen ? (
        <img src={item.imagen} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#f4f1ee] flex items-center justify-center flex-shrink-0">
          <span className="text-[#c6c6c6] text-xs">◻</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#1d1d1b] truncate">{item.description ?? item.codigo_modelo}</p>
        <p className="text-xs text-[#b2b2b2]">{item.codigo_modelo} · {item.familia ?? '—'}</p>
      </div>
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="text-xs font-bold" style={{ color: type === 'rotura' ? TQ_RED : TQ_GOLD }}>
          {item.stock_total} uds.
        </p>
        {type === 'rotura' && item.cobertura_dias != null && (
          <p className="text-xs" style={{ color: urgente ? TQ_RED : '#b2b2b2' }}>
            {item.cobertura_dias}d cobertura
          </p>
        )}
        {type === 'exceso' && (
          <p className="text-xs text-[#b2b2b2]">0 uds/mes</p>
        )}
      </div>
    </div>
  )
}

export default function StockDashboardClient() {
  const [summary, setSummary]       = useState<StockSummary | null>(null)
  const [inventory, setInventory]   = useState<StockPorModelo[]>([])
  const [loadingSum, setLoadingSum] = useState(true)
  const [loadingInv, setLoadingInv] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [tab, setTab]               = useState<Tab>('alertas')
  const [alertType, setAlertType]   = useState<AlertType>('rotura')
  const [nivelFilter, setNivelFilter] = useState<NivelFilter>('all')
  const [search, setSearch]         = useState('')
  const [invLoaded, setInvLoaded]   = useState(false)

  useEffect(() => {
    fetch('/api/stock/summary')
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then(setSummary)
      .catch(e => setError(typeof e === 'string' ? e : 'Error cargando datos'))
      .finally(() => setLoadingSum(false))
  }, [])

  const loadInventory = useCallback(async () => {
    if (invLoaded) return
    setLoadingInv(true)
    try {
      const res = await fetch('/api/stock/por-modelo?limit=500')
      if (!res.ok) throw new Error((await res.json()).error)
      setInventory(await res.json())
      setInvLoaded(true)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Error cargando inventario')
    } finally {
      setLoadingInv(false)
    }
  }, [invLoaded])

  useEffect(() => {
    if (tab === 'inventario') loadInventory()
  }, [tab, loadInventory])

  const filteredInv = inventory.filter(r => {
    if (nivelFilter !== 'all' && r.nivel !== nivelFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.codigo_modelo.toLowerCase().includes(q) ||
             (r.description ?? '').toLowerCase().includes(q)
    }
    return true
  })

  if (loadingSum) return (
    <div className="flex items-center justify-center py-24 text-[#b2b2b2] text-sm">Cargando datos de stock…</div>
  )
  if (error) return (
    <div className="rounded-xl p-8 text-center mt-6" style={{ background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
      <p className="text-sm font-semibold text-red-700">{error}</p>
    </div>
  )
  if (!summary) return null

  const alertas = alertType === 'rotura' ? summary.alertas_rotura : summary.alertas_exceso

  return (
    <div className="space-y-5 mt-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Unidades en stock"
          value={summary.total_unidades.toLocaleString('es-ES')}
          sub={`${summary.total_modelos} modelos · ${summary.total_variantes} variantes`}
          color={TQ_BLUE}
        />
        <KpiCard
          label="Sin stock"
          value={summary.modelos_sin_stock.toString()}
          sub="Modelos activos con 0 unidades"
          color={TQ_RED}
          alert={summary.modelos_sin_stock > 5}
        />
        <KpiCard
          label="Stock bajo (≤3 uds.)"
          value={summary.modelos_stock_bajo.toString()}
          sub="Modelos en riesgo de rotura"
          color={TQ_GOLD}
          alert={summary.modelos_stock_bajo > 10}
        />
        <KpiCard
          label="Cobertura media"
          value={summary.cobertura_media_dias != null
            ? `${summary.cobertura_media_dias}d`
            : '—'}
          sub={summary.capital_inmovilizado != null
            ? `Capital: ${summary.capital_inmovilizado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`
            : 'Días de cobertura sobre ventas/mes'}
          color={TQ_GREEN}
        />
      </div>

      {/* Middle row: Distribución + Familias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribución por nivel */}
        <div className="tq-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00557f] mb-3">
            Distribución por nivel de stock
          </h2>
          <div className="flex gap-4 items-center">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={summary.distribucion}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {summary.distribucion.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8e3df' }}
                  formatter={(v) => [`${Number(v ?? 0)} modelos`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {summary.distribucion.map(d => (
                <div key={d.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-[#555]">{d.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold" style={{ color: d.color }}>{d.count}</span>
                    {d.unidades > 0 && <span className="text-xs text-[#b2b2b2] ml-1">({d.unidades} uds.)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Por familia */}
        <div className="tq-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00557f] mb-3">
            Stock por familia
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={summary.por_familia}
              layout="vertical"
              margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#b2b2b2' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="familia"
                tick={{ fontSize: 11, fill: '#555' }}
                axisLine={false}
                tickLine={false}
                width={82}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e8e3df', borderRadius: 8 }}
                formatter={(v) => [`${Number(v ?? 0).toLocaleString('es-ES')} uds.`, 'Stock']}
              />
              <Bar dataKey="stock" fill={TQ_GREEN} radius={[0, 4, 4, 0]} barSize={14}
                label={{
                  position: 'right',
                  formatter: (v: unknown) => {
                    const n = Number(v ?? 0)
                    const row = summary.por_familia.find(f => f.stock === n)
                    return row ? `${row.pct}%` : ''
                  },
                  fontSize: 10,
                  fill: '#b2b2b2',
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs: Alertas | Inventario */}
      <div>
        <div className="flex border-b border-[#e8e3df] mb-4">
          {(['alertas', 'inventario'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px"
              style={{
                borderColor: tab === t ? TQ_BLUE : 'transparent',
                color:       tab === t ? TQ_BLUE : '#b2b2b2',
              }}
            >
              {t === 'alertas' ? 'Alertas' : 'Inventario completo'}
              {t === 'alertas' && (
                <span className="ml-2 text-xs rounded-full px-1.5 py-0.5 font-bold"
                  style={{
                    background: summary.alertas_rotura.length > 0 ? '#fdf0f0' : '#f4f1ee',
                    color:      summary.alertas_rotura.length > 0 ? TQ_RED    : '#b2b2b2',
                  }}>
                  {summary.alertas_rotura.length + summary.alertas_exceso.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'alertas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Alertas rotura */}
            <div className="tq-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f4f1ee]">
                <div>
                  <h3 className="text-sm font-bold text-[#C0392B]">⚠ Riesgo de rotura</h3>
                  <p className="text-xs text-[#b2b2b2]">Stock ≤ 2 uds. con ventas recientes</p>
                </div>
                <span className="text-lg font-bold text-[#C0392B]">{summary.alertas_rotura.length}</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {summary.alertas_rotura.length === 0 ? (
                  <p className="text-center text-xs text-[#b2b2b2] py-8">Sin alertas de rotura ✓</p>
                ) : (
                  summary.alertas_rotura.map(item => (
                    <AlertRow key={item.codigo_modelo} item={item} type="rotura" />
                  ))
                )}
              </div>
            </div>

            {/* Alertas exceso */}
            <div className="tq-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f4f1ee]">
                <div>
                  <h3 className="text-sm font-bold text-[#C8842A]">◈ Posible sobrante</h3>
                  <p className="text-xs text-[#b2b2b2]">Stock {'>'} 10 uds. sin ventas en el mes</p>
                </div>
                <span className="text-lg font-bold text-[#C8842A]">{summary.alertas_exceso.length}</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {summary.alertas_exceso.length === 0 ? (
                  <p className="text-center text-xs text-[#b2b2b2] py-8">Sin excesos detectados ✓</p>
                ) : (
                  summary.alertas_exceso.map(item => (
                    <AlertRow key={item.codigo_modelo} item={item} type="exceso" />
                  ))
                )}
              </div>
            </div>

            {/* Top 10 por volumen */}
            <div className="tq-card overflow-hidden lg:col-span-2">
              <div className="px-4 py-3 border-b border-[#f4f1ee]">
                <h3 className="text-sm font-bold text-[#00557f]">Top 10 por volumen de stock</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['#', 'Referencia', 'Familia', 'Stock', 'Uds/mes', 'Cobertura', 'PVP'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1ee]">
                  {summary.top_stock.map((item, i) => (
                    <tr key={item.codigo_modelo} className="hover:bg-[#fafaf9] transition-colors">
                      <td className="px-4 py-2 text-xs text-[#b2b2b2] w-8">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {item.imagen ? (
                            <img src={item.imagen} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-[#f4f1ee] flex-shrink-0" />
                          )}
                          <div>
                            <p className="text-xs font-semibold text-[#1d1d1b]">{item.description ?? item.codigo_modelo}</p>
                            <p className="text-xs text-[#b2b2b2]">{item.codigo_modelo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-[#555]">{item.familia ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-bold" style={{ color: TQ_BLUE }}>{item.stock_total}</td>
                      <td className="px-4 py-2 text-xs text-[#555]">{item.unidades_mes || '—'}</td>
                      <td className="px-4 py-2 text-xs">
                        {item.cobertura_dias != null ? (
                          <span style={{
                            color: item.cobertura_dias <= 30 ? TQ_GOLD
                              : item.cobertura_dias >= 180 ? TQ_BLUE : TQ_GREEN,
                          }}>
                            {item.cobertura_dias}d
                          </span>
                        ) : <span className="text-[#b2b2b2]">—</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-[#555]">
                        {item.precio_venta != null
                          ? item.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'inventario' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                type="text"
                placeholder="Buscar modelo…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white w-52"
              />
              {(['all', 'sin_stock', 'bajo', 'normal', 'alto'] as NivelFilter[]).map(n => (
                <button
                  key={n}
                  onClick={() => setNivelFilter(n)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border transition-colors"
                  style={{
                    borderColor: nivelFilter === n ? TQ_BLUE : '#e8e3df',
                    background:  nivelFilter === n ? '#e8f4fb' : 'white',
                    color:       nivelFilter === n ? TQ_BLUE : '#b2b2b2',
                  }}
                >
                  {n === 'all' ? 'Todos' : n === 'sin_stock' ? 'Sin stock' : n.charAt(0).toUpperCase() + n.slice(1)}
                </button>
              ))}
              <span className="text-sm text-[#b2b2b2] self-center ml-auto">
                {filteredInv.length} referencias
              </span>
            </div>

            {loadingInv ? (
              <div className="py-10 text-center text-sm text-[#b2b2b2]">Cargando inventario…</div>
            ) : (
              <div className="tq-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#f4f1ee]">
                      {['Referencia', 'Familia', 'Nivel', 'Stock', 'Variantes c/stock', 'Uds/mes', 'Cobertura', 'ABC'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f1ee]">
                    {filteredInv.slice(0, 200).map(r => (
                      <tr key={r.codigo_modelo} className="hover:bg-[#fafaf9] transition-colors">
                        <td className="px-3 py-2">
                          <p className="text-xs font-semibold text-[#1d1d1b] truncate max-w-[200px]">{r.description ?? r.codigo_modelo}</p>
                          <p className="text-xs text-[#b2b2b2]">{r.codigo_modelo}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#555]">{r.familia ?? '—'}</td>
                        <td className="px-3 py-2"><NivelBadge nivel={r.nivel} /></td>
                        <td className="px-3 py-2 text-xs font-bold" style={{
                          color: r.stock_total === 0 ? TQ_RED : r.stock_total <= 3 ? TQ_GOLD : TQ_GREEN,
                        }}>{r.stock_total}</td>
                        <td className="px-3 py-2 text-xs text-[#555]">
                          {r.variantes_con_stock}/{r.num_variantes}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#555]">{r.unidades_mes || '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.cobertura_dias != null ? (
                            <span style={{
                              color: r.cobertura_dias <= 14 ? TQ_RED
                                : r.cobertura_dias <= 30 ? TQ_GOLD
                                : r.cobertura_dias >= 180 ? '#b2b2b2'
                                : TQ_GREEN,
                            }}>{r.cobertura_dias}d</span>
                          ) : <span className="text-[#b2b2b2]">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {r.abc_ventas ? (
                            <span className="text-xs font-bold rounded px-1.5 py-0.5"
                              style={{
                                background: r.abc_ventas === 'A' ? '#e8f5f0' : r.abc_ventas === 'B' ? '#fdf3e4' : '#f4f1ee',
                                color:      r.abc_ventas === 'A' ? TQ_GREEN  : r.abc_ventas === 'B' ? TQ_GOLD   : '#888',
                              }}>
                              {r.abc_ventas}
                            </span>
                          ) : <span className="text-[#b2b2b2] text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredInv.length > 200 && (
                  <p className="text-xs text-center text-[#b2b2b2] py-3 border-t border-[#f4f1ee]">
                    Mostrando 200 de {filteredInv.length}. Usa los filtros para acotar.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
