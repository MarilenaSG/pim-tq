'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'

type LadderBucket = {
  rango: string
  min: number
  max: number
  modelos: number
  ingresos: number
  margenMedio: number | null
  esGap: boolean
  abcA: number; abcB: number; abcC: number
  productos: {
    codigo_modelo: string
    description: string | null
    precio: number | null
    margen: number | null
    abc: string | null
    ingresos: number | null
  }[]
}

type ProductRow = {
  codigo_modelo: string
  description: string | null
  variante: string | null
  precio_venta: number | null
  precio_tachado: number | null
  descuento: number | null
  margen: number | null
  abc: string | null
  ingresos: number | null
}

function fmtEuro(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

function AbcBadge({ abc }: { abc: string | null }) {
  if (!abc) return <span style={{ color: '#d0cdc9' }}>—</span>
  const cfg: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(58,158,106,0.12)', text: '#2d7a54' },
    B: { bg: 'rgba(0,153,242,0.12)',  text: '#007acc' },
    C: { bg: 'rgba(200,132,42,0.12)', text: '#a06818' },
  }
  const { bg, text } = cfg[abc] ?? { bg: 'rgba(0,85,127,0.06)', text: '#b2b2b2' }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: bg, color: text }}>{abc}</span>
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: LadderBucket }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const bucket = payload[0]?.payload as LadderBucket
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg text-xs space-y-1" style={{ border: '1px solid rgba(0,85,127,0.15)', maxWidth: 220 }}>
      <p className="font-bold text-tq-snorkel">{label}</p>
      <p style={{ color: '#b2b2b2' }}>{bucket.modelos} modelos</p>
      {bucket.margenMedio != null && <p style={{ color: '#C8842A' }}>Margen: {bucket.margenMedio.toFixed(1)}%</p>}
      {bucket.productos.slice(0, 4).map(p => (
        <p key={p.codigo_modelo} className="text-[10px]" style={{ color: '#00557f' }}>
          {p.codigo_modelo} — {p.precio != null ? p.precio.toLocaleString('es-ES') + ' €' : '—'}
        </p>
      ))}
      {bucket.productos.length > 4 && <p style={{ color: '#b2b2b2' }}>+{bucket.productos.length - 4} más…</p>}
    </div>
  )
}

export function PriceLadderClient({
  familias, selectedFamilia, selectedMetal, ladderData, allProducts, uniqMetals,
}: {
  familias: string[]
  selectedFamilia: string
  selectedMetal: string
  ladderData: LadderBucket[]
  allProducts: ProductRow[]
  uniqMetals: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [insights, setInsights] = useState<string[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)

  function setParam(k: string, v: string) {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set(k, v); else p.delete(k)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  const fetchInsights = useCallback(async () => {
    if (!selectedFamilia) return
    setInsightsLoading(true)
    setInsights([])
    try {
      const res = await fetch('/api/ai/ladder-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familia: selectedFamilia,
          ladderData: ladderData.map(b => ({
            rango: b.rango, modelos: b.modelos, ingresos: b.ingresos,
            margenMedio: b.margenMedio, esGap: b.esGap,
          })),
        }),
      })
      const data = await res.json()
      setInsights(data.insights ?? [])
    } catch { /* non-critical */ }
    setInsightsLoading(false)
  }, [selectedFamilia, ladderData])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  const chartData = ladderData.map(b => ({
    ...b,
    name: b.rango,
    modelosA: b.abcA,
    modelosB: b.abcB,
    modelosC: b.abcC,
    margen: b.margenMedio,
  }))

  const filteredProducts = selectedBucket
    ? allProducts.filter(p => {
        const bucket = ladderData.find(b => b.rango === selectedBucket)
        if (!bucket || p.precio_venta == null) return false
        return p.precio_venta >= bucket.min && (bucket.max >= 9999999 || p.precio_venta <= bucket.max)
      })
    : allProducts

  const sortedProducts = [...filteredProducts].sort((a, b) =>
    (b.precio_venta ?? 0) - (a.precio_venta ?? 0)
  )

  return (
    <div className="p-6 max-w-[1400px] space-y-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#0099f2' }}>Analítica</p>
        <h1 className="text-2xl font-bold text-tq-snorkel">Price Ladder</h1>
      </div>

      {/* Familia selector + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedFamilia}
          onChange={e => setParam('familia', e.target.value)}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold border bg-white focus:outline-none"
          style={{ borderColor: '#C8842A', color: '#a06818', minWidth: 200 }}
        >
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={selectedMetal}
          onChange={e => setParam('metal', e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
          style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
        >
          <option value="">Metal: todos</option>
          {uniqMetals.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {selectedBucket && (
          <button
            onClick={() => setSelectedBucket(null)}
            className="text-xs font-semibold px-3 py-2 rounded-lg"
            style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}
          >
            ✕ Filtro: {selectedBucket}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Chart + table */}
        <div className="xl:col-span-3 space-y-5">
          {/* Ladder chart */}
          <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#b2b2b2' }}>
              Distribución por tramo de precio — {selectedFamilia}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(d: any) => { if (d?.activeLabel) setSelectedBucket(String(d.activeLabel) === selectedBucket ? null : String(d.activeLabel)) }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,85,127,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#b2b2b2' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#b2b2b2' }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#C8842A' }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="modelosA" name="ABC-A" stackId="abc" fill="#3A9E6A" radius={[0, 0, 0, 0]}
                  cursor="pointer">
                  {chartData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.esGap ? 'rgba(192,57,43,0.15)' : '#3A9E6A'}
                      stroke={entry.rango === selectedBucket ? '#00557f' : 'none'}
                      strokeWidth={2}
                    />
                  ))}
                </Bar>
                <Bar yAxisId="left" dataKey="modelosB" name="ABC-B" stackId="abc" fill="#0099f2" cursor="pointer" />
                <Bar yAxisId="left" dataKey="modelosC" name="ABC-C" stackId="abc" fill="#C8842A" cursor="pointer" />
                <Line yAxisId="right" type="monotone" dataKey="margen" name="Margen medio %"
                  stroke="#C8842A" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>

            {/* GAP legend */}
            {ladderData.some(b => b.esGap) && (
              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#C0392B' }}>
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)' }} />
                Rangos vacíos (GAP de precio) — clic en barra para filtrar tabla
              </div>
            )}
          </div>

          {/* Products table */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#b2b2b2' }}>
                {selectedBucket ? `Modelos en rango ${selectedBucket}` : 'Todos los modelos'} — {sortedProducts.length}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                  {['Código', 'Descripción', 'Precio venta', 'Precio tachado', 'Desc%', 'Margen%', 'ABC', 'Ingresos 12m'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.slice(0, 50).map((p, i) => (
                  <tr key={p.codigo_modelo}
                    className="hover:bg-[rgba(0,85,127,0.02)] transition-colors"
                    style={{ borderBottom: i < sortedProducts.length - 1 ? '1px solid rgba(0,85,127,0.04)' : 'none' }}>
                    <td className="px-3 py-2">
                      <Link href={`/products/${p.codigo_modelo}`} className="font-mono text-xs font-bold text-tq-sky hover:underline">
                        {p.codigo_modelo}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-tq-snorkel max-w-[200px]">
                      <span className="line-clamp-1">{p.description ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-right">{fmtEuro(p.precio_venta)}</td>
                    <td className="px-3 py-2 text-xs font-mono text-right" style={{ color: '#b2b2b2' }}>{fmtEuro(p.precio_tachado)}</td>
                    <td className="px-3 py-2 text-xs text-right" style={{ color: p.descuento ? '#C8842A' : '#b2b2b2' }}>
                      {p.descuento != null ? p.descuento.toFixed(0) + '%' : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-semibold" style={{ color: p.margen != null && p.margen >= 40 ? '#3A9E6A' : '#C0392B' }}>
                      {p.margen != null ? p.margen.toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-3 py-2"><AbcBadge abc={p.abc} /></td>
                    <td className="px-3 py-2 text-xs font-mono text-right" style={{ color: '#b2b2b2' }}>{fmtEuro(p.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedProducts.length > 50 && (
              <p className="px-5 py-3 text-xs" style={{ color: '#b2b2b2' }}>Mostrando 50 de {sortedProducts.length} modelos. Usa los filtros de rango para ver más.</p>
            )}
          </div>
        </div>

        {/* Insights panel */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl p-5 sticky top-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#b2b2b2' }}>✦ Insights IA</p>
              <button onClick={fetchInsights} disabled={insightsLoading}
                className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                style={{ background: 'rgba(200,132,42,0.08)', color: '#a06818' }}>
                {insightsLoading ? '…' : '↻'}
              </button>
            </div>

            {insightsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-12 rounded-lg" style={{ background: 'rgba(0,85,127,0.04)' }} />
                ))}
              </div>
            ) : insights.length > 0 ? (
              <ul className="space-y-3">
                {insights.map((ins, i) => (
                  <li key={i} className="text-xs leading-relaxed text-tq-snorkel flex gap-2">
                    <span style={{ color: '#C8842A', fontSize: 16, lineHeight: 1.2 }}>·</span>
                    {ins}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: '#b2b2b2' }}>Sin insights disponibles.</p>
            )}

            <div className="mt-5 pt-4 border-t space-y-1" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Resumen</p>
              <p className="text-xs" style={{ color: '#b2b2b2' }}>
                {ladderData.filter(b => b.modelos > 0).length} rangos con productos
              </p>
              <p className="text-xs" style={{ color: '#C0392B' }}>
                {ladderData.filter(b => b.esGap).length} GAPs de precio
              </p>
              <p className="text-xs" style={{ color: '#b2b2b2' }}>
                {allProducts.length} modelos en total
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
