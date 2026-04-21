'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type FamiliaRow = {
  familia: string
  modelos: number
  variantes: number
  skusActivos: number
  ingresos: number
  pctIngresos: number
  abcA: number; abcB: number; abcC: number; abcNull: number
  margenMedio: number | null
  abcATotal: number; abcAConStock: number
  topProductos: { codigo_modelo: string; abc_ventas: string | null; ingresos_12m: number | null }[]
}

type SortKey = 'familia' | 'modelos' | 'ingresos' | 'margenMedio' | 'pctIngresos'
type SortDir = 'asc' | 'desc'

function fmtEuro(n: number) { return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' }
function fmtPct(n: number | null) { return n == null ? '—' : n.toFixed(1) + '%' }

function MargenColor({ v, target }: { v: number | null; target?: number }) {
  if (v == null) return <span style={{ color: '#b2b2b2' }}>—</span>
  const tgt = target ?? 40
  const color = v >= tgt ? '#3A9E6A' : v >= tgt * 0.8 ? '#C8842A' : '#C0392B'
  return <span style={{ color, fontWeight: 600 }}>{v.toFixed(1)}%</span>
}

function StockAbcA({ ok, total }: { ok: number; total: number }) {
  if (total === 0) return <span style={{ color: '#b2b2b2' }}>—</span>
  const pct = total > 0 ? ok / total : 0
  const color = pct >= 0.9 ? '#3A9E6A' : pct >= 0.8 ? '#C8842A' : '#C0392B'
  return <span style={{ color, fontWeight: 600 }}>{ok}/{total}</span>
}

export function CategoryManagerClient({
  familias, totalIngresos, familiasActivas, familiaTop, stockCriticoFamilias,
  concentracion, marginTargets, filters, filterOptions,
}: {
  familias: FamiliaRow[]
  totalIngresos: number
  familiasActivas: number
  familiaTop: { nombre: string; ingresos: number } | null
  stockCriticoFamilias: number
  concentracion: number
  marginTargets: Record<string, number>
  filters: { metal: string; karat: string; proveedor: string; category: string }
  filterOptions: { metals: string[]; karats: string[]; proveedores: string[]; categories: string[] }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [sortKey, setSortKey]   = useState<SortKey>('ingresos')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')
  const [selected, setSelected] = useState<FamiliaRow | null>(null)

  function setFilter(k: string, v: string) {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set(k, v); else p.delete(k)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...familias].sort((a, b) => {
    let av: number | string = a[sortKey] ?? 0
    let bv: number | string = b[sortKey] ?? 0
    if (sortKey === 'familia') { av = a.familia; bv = b.familia }
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalRow = {
    modelos: familias.reduce((s, f) => s + f.modelos, 0),
    variantes: familias.reduce((s, f) => s + f.variantes, 0),
    abcA: familias.reduce((s, f) => s + f.abcA, 0),
    abcB: familias.reduce((s, f) => s + f.abcB, 0),
    abcC: familias.reduce((s, f) => s + f.abcC, 0),
  }

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 opacity-40" style={{ fontSize: 9 }}>
      {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase cursor-pointer select-none hover:opacity-70 ${right ? 'text-right' : ''}`}
      style={{ color: sortKey === k ? '#00557f' : '#b2b2b2' }}
    >
      {children}<SortIcon k={k} />
    </th>
  )

  // Close panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-6 max-w-[1400px] space-y-5 overflow-auto">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#0099f2' }}>Operativo</p>
            <h1 className="text-2xl font-bold text-tq-snorkel">Category Manager</h1>
            <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>
              {familias.length} familias · {totalRow.modelos} modelos · {fmtEuro(totalIngresos)} ingresos 12m
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Familias activas', value: familiasActivas, sub: 'con ingresos > 0', color: '#00557f' },
            { label: 'Familia top', value: familiaTop?.nombre ?? '—', sub: familiaTop ? fmtEuro(familiaTop.ingresos) : '', color: '#3A9E6A' },
            { label: 'Stock crítico ABC-A', value: stockCriticoFamilias, sub: 'familias con falta de stock', color: stockCriticoFamilias > 0 ? '#C0392B' : '#3A9E6A' },
            { label: 'Concentración top 3', value: `${concentracion}%`, sub: 'de ingresos en top 3 familias', color: '#C8842A' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#b2b2b2' }}>{k.label}</div>
              <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#b2b2b2' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl px-4 py-3 flex flex-wrap gap-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          {[
            { key: 'metal',    label: 'Metal',      options: filterOptions.metals },
            { key: 'karat',    label: 'Quilates',   options: filterOptions.karats },
            { key: 'proveedor', label: 'Proveedor', options: filterOptions.proveedores },
            { key: 'category', label: 'Categoría',  options: filterOptions.categories },
          ].map(f => (
            <select
              key={f.key}
              value={filters[f.key as keyof typeof filters]}
              onChange={e => setFilter(f.key, e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none"
              style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
            >
              <option value="">{f.label}: todos</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                <Th k="familia">Familia</Th>
                <Th k="modelos">Modelos</Th>
                <th className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Vars</th>
                <Th k="ingresos" right>Ingresos 12m</Th>
                <Th k="pctIngresos" right>% Total</Th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>ABC A/B/C</th>
                <Th k="margenMedio" right>Margen medio</Th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Stock ABC-A</th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f, i) => (
                <tr
                  key={f.familia}
                  className="hover:bg-[rgba(0,85,127,0.02)] transition-colors"
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none' }}
                >
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setSelected(selected?.familia === f.familia ? null : f)}
                      className="text-sm font-semibold text-tq-sky hover:underline text-left"
                    >
                      {f.familia}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-tq-snorkel">{f.modelos}</td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: '#b2b2b2' }}>{f.variantes}</td>
                  <td className="px-3 py-2.5 text-sm font-mono text-right text-tq-snorkel whitespace-nowrap">{fmtEuro(f.ingresos)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 rounded-full bg-[rgba(0,85,127,0.08)]">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, f.pctIngresos)}%`, background: '#0099f2' }} />
                      </div>
                      <span className="text-xs font-mono text-right" style={{ color: '#b2b2b2', width: 36 }}>{f.pctIngresos.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      {f.abcA > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(58,158,106,0.12)', color: '#2d7a54' }}>A:{f.abcA}</span>}
                      {f.abcB > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,153,242,0.12)', color: '#007acc' }}>B:{f.abcB}</span>}
                      {f.abcC > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(200,132,42,0.12)', color: '#a06818' }}>C:{f.abcC}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <MargenColor v={f.margenMedio} target={marginTargets[f.familia]} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StockAbcA ok={f.abcAConStock} total={f.abcATotal} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <Link href={`/products?familia=${encodeURIComponent(f.familia)}`} className="text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap" style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}>Ver →</Link>
                      <Link href={`/analytics/price-ladder?familia=${encodeURIComponent(f.familia)}`} className="text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap" style={{ background: 'rgba(200,132,42,0.08)', color: '#a06818' }}>Ladder →</Link>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr style={{ background: 'rgba(0,85,127,0.03)', borderTop: '2px solid rgba(0,85,127,0.1)' }}>
                <td className="px-3 py-2.5 text-xs font-bold text-tq-snorkel">TOTAL</td>
                <td className="px-3 py-2.5 text-xs font-bold text-tq-snorkel">{totalRow.modelos}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-tq-snorkel">{totalRow.variantes}</td>
                <td className="px-3 py-2.5 text-xs font-bold font-mono text-right text-tq-snorkel">{fmtEuro(totalIngresos)}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-right text-tq-snorkel">100%</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(58,158,106,0.12)', color: '#2d7a54' }}>A:{totalRow.abcA}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,153,242,0.12)', color: '#007acc' }}>B:{totalRow.abcB}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(200,132,42,0.12)', color: '#a06818' }}>C:{totalRow.abcC}</span>
                  </div>
                </td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar panel */}
      {selected && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSelected(null)} />
          <aside
            className="fixed right-0 top-0 h-full w-96 bg-white z-30 flex flex-col overflow-y-auto"
            style={{ boxShadow: '-4px 0 24px rgba(0,32,60,0.12)', borderLeft: '1px solid rgba(0,85,127,0.1)' }}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Familia</p>
                <h2 className="text-base font-bold text-tq-snorkel">{selected.familia}</h2>
                <p className="text-xs" style={{ color: '#b2b2b2' }}>{selected.modelos} modelos</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-lg opacity-40 hover:opacity-70 transition-opacity" aria-label="Cerrar">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Modelos', value: selected.modelos },
                  { label: 'Variantes', value: selected.variantes },
                  { label: 'Ingresos 12m', value: fmtEuro(selected.ingresos) },
                  { label: 'Margen medio', value: fmtPct(selected.margenMedio) },
                ].map(k => (
                  <div key={k.label} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,85,127,0.04)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#b2b2b2' }}>{k.label}</div>
                    <div className="text-sm font-bold text-tq-snorkel">{k.value}</div>
                  </div>
                ))}
              </div>

              {/* ABC distribution */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Distribución ABC</p>
                <div className="space-y-1.5">
                  {([
                    { label: 'A', count: selected.abcA, color: '#3A9E6A' },
                    { label: 'B', count: selected.abcB, color: '#0099f2' },
                    { label: 'C', count: selected.abcC, color: '#C8842A' },
                  ] as const).map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="w-4 font-bold" style={{ color }}>{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-[rgba(0,85,127,0.08)]">
                        <div className="h-2 rounded-full" style={{ width: `${selected.modelos > 0 ? (count / selected.modelos) * 100 : 0}%`, background: color }} />
                      </div>
                      <span className="w-6 text-right" style={{ color: '#b2b2b2' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Top 5 por ingresos</p>
                <div className="space-y-1">
                  {selected.topProductos.map(p => (
                    <Link
                      key={p.codigo_modelo}
                      href={`/products/${p.codigo_modelo}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[rgba(0,85,127,0.04)] transition-colors"
                    >
                      <span className="font-mono text-xs font-bold text-tq-sky">{p.codigo_modelo}</span>
                      <div className="flex items-center gap-2">
                        {p.abc_ventas && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{
                              background: p.abc_ventas === 'A' ? 'rgba(58,158,106,0.12)' : p.abc_ventas === 'B' ? 'rgba(0,153,242,0.12)' : 'rgba(200,132,42,0.12)',
                              color: p.abc_ventas === 'A' ? '#2d7a54' : p.abc_ventas === 'B' ? '#007acc' : '#a06818',
                            }}>
                            {p.abc_ventas}
                          </span>
                        )}
                        <span className="text-xs font-mono" style={{ color: '#b2b2b2' }}>
                          {p.ingresos_12m != null ? fmtEuro(p.ingresos_12m) : '—'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Alerts */}
              {(selected.abcATotal > 0 && selected.abcAConStock < selected.abcATotal) && (
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#C0392B' }}>
                    ⚠ {selected.abcATotal - selected.abcAConStock} modelo{selected.abcATotal - selected.abcAConStock !== 1 ? 's' : ''} ABC-A sin stock
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Link href={`/products?familia=${encodeURIComponent(selected.familia)}`}
                  className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center text-white transition-opacity hover:opacity-85"
                  style={{ background: '#00557f' }}>
                  Ver todos los productos →
                </Link>
                <Link href={`/analytics/price-ladder?familia=${encodeURIComponent(selected.familia)}`}
                  className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center transition-colors"
                  style={{ background: 'rgba(200,132,42,0.1)', color: '#a06818' }}>
                  Ver price ladder →
                </Link>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
