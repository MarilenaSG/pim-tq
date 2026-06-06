'use client'

import { useEffect, useState, useCallback } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts'
import { PageHeader } from '@/components/ui'
import type { VentasPorModelo } from '@/app/api/ventas/por-modelo/route'

const TQ_BLUE = '#00557f'

function fmtEur(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K €`
  return `${n.toLocaleString('es-ES')} €`
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

function SparkBar({ data }: { data: { label: string; ingresos: number }[] }) {
  return (
    <ResponsiveContainer width={80} height={32}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Bar dataKey="ingresos" fill={TQ_BLUE} opacity={0.5} radius={[2, 2, 0, 0]} />
        <Tooltip
          contentStyle={{ fontSize: 11, border: '1px solid #e8e3df', borderRadius: 6, padding: '4px 8px' }}
          formatter={(v) => [fmtEur(Number(v ?? 0)), '']}
          labelStyle={{ display: 'none' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function SellOutPage() {
  const [rows, setRows]       = useState<VentasPorModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [familia, setFamilia] = useState('all')
  const [metal, setMetal]     = useState('all')
  const [order, setOrder]     = useState<'ingresos' | 'unidades' | 'variacion'>('ingresos')
  const [search, setSearch]   = useState('')

  const [familias, setFamilias] = useState<string[]>([])
  const [metales,  setMetales]  = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ order, limit: '100' })
    if (familia !== 'all') params.set('familia', familia)
    if (metal   !== 'all') params.set('metal',   metal)
    try {
      const res = await fetch(`/api/ventas/por-modelo?${params}`)
      if (!res.ok) throw new Error((await res.json()).error)
      const data: VentasPorModelo[] = await res.json()
      setRows(data)

      // Derive filter options from full unfiltered result (only first load)
      if (familia === 'all' && metal === 'all') {
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
    <div className="p-6 max-w-6xl">
      <PageHeader
        eyebrow="Zona Ventas"
        title="Sell-out por modelo"
        subtitle="Ventas de los últimos 12 meses con comparativa vs período anterior"
        actions={
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#e8e3df] hover:bg-white transition-colors"
          >
            ↻ Actualizar
          </button>
        }
      />

      {/* Totals */}
      {!loading && !error && (
        <div className="flex gap-6 mt-4 mb-1 text-sm">
          <span><b className="text-[#00557f]">{fmtEur(totalIngresos)}</b> <span className="text-[#b2b2b2]">ingresos 12m</span></span>
          <span><b className="text-[#C8842A]">{totalUnidades.toLocaleString('es-ES')}</b> <span className="text-[#b2b2b2]">unidades 12m</span></span>
          <span><b className="text-[#1d1d1b]">{filtered.length}</b> <span className="text-[#b2b2b2]">referencias</span></span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mt-4 mb-4">
        <input
          type="text"
          placeholder="Buscar modelo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white w-52"
        />
        <select value={familia} onChange={e => { setFamilia(e.target.value) }}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={metal} onChange={e => { setMetal(e.target.value) }}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">Todos los metales</option>
          {metales.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={order} onChange={e => setOrder(e.target.value as typeof order)}
          className="border border-[#e8e3df] rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ingresos">Ordenar: Mayor ingreso</option>
          <option value="unidades">Ordenar: Más unidades</option>
          <option value="variacion">Ordenar: Mayor crecimiento</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#b2b2b2] text-sm">Cargando…</div>
      ) : error ? (
        <div className="rounded-xl p-8 text-center" style={{ background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center mt-4" style={{ background: 'rgba(200,132,42,0.04)', border: '1px solid rgba(200,132,42,0.12)' }}>
          <p className="text-3xl mb-2">▨</p>
          <p className="text-sm font-semibold text-[#a06818]">Sin datos de ventas disponibles</p>
          <p className="text-xs text-[#b2b2b2] mt-1">
            Ejecuta el sync de Metabase en Configuración → Sincronización para importar las ventas.
          </p>
        </div>
      ) : (
        <div className="tq-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f4f1ee]">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">Referencia</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">Ingresos 12m</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">Uds. 12m</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">Var. vs ant.</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">Ú. 6 meses</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#b2b2b2]">Meses activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f1ee]">
              {filtered.map((r, i) => (
                <tr key={r.codigo_modelo} className="hover:bg-[#fafaf9] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {r.imagen ? (
                        <img src={r.imagen} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#f4f1ee] flex items-center justify-center flex-shrink-0">
                          <span className="text-[#c6c6c6] text-xs">◻</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#1d1d1b] text-xs">{r.description ?? r.codigo_modelo}</p>
                        <p className="text-xs text-[#b2b2b2]">{r.codigo_modelo} · {r.familia ?? '—'} · {r.metal ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold" style={{ color: TQ_BLUE }}>
                    {fmtEur(r.ingresos_12m)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#555]">
                    {r.unidades_12m.toLocaleString('es-ES')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <VarBadge pct={r.variacion_pct} />
                  </td>
                  <td className="px-4 py-2.5 flex justify-center">
                    <SparkBar data={r.sparkline} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-[#b2b2b2]">
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
