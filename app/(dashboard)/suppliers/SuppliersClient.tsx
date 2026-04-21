'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type SupplierRow = {
  proveedor: string
  modelos: number
  pctCatalogo: number
  ingresos: number
  pctIngresos: number
  pctIngresosMax: number
  margenMedio: number | null
  abcA: number; abcB: number; abcC: number
  abcATotal: number; abcAConStock: number
  familias: string[]
  topProductos: { codigo_modelo: string; familia: string | null; abc_ventas: string | null; ingresos_12m: number | null }[]
}

type SortKey = 'proveedor' | 'modelos' | 'ingresos' | 'margenMedio' | 'abcA'

function fmtEuro(n: number) { return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' }

export function SuppliersClient({
  suppliers, totalIngresos, totalProducts, defaultMarginTarget, highlight,
}: {
  suppliers: SupplierRow[]
  totalIngresos: number
  totalProducts: number
  defaultMarginTarget: number
  highlight: string
}) {
  const [sortKey, setSortKey] = useState<SortKey>('ingresos')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<SupplierRow | null>(null)
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (highlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const s = suppliers.find(s => s.proveedor === highlight)
      if (s) setSelected(s)
    }
  }, [highlight, suppliers])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...suppliers].sort((a, b) => {
    const av: number | string = sortKey === 'proveedor' ? a.proveedor : (a[sortKey] ?? 0)
    const bv: number | string = sortKey === 'proveedor' ? b.proveedor : (b[sortKey] ?? 0)
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 opacity-40" style={{ fontSize: 9 }}>
      {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th onClick={() => toggleSort(k)}
      className={`px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase cursor-pointer select-none hover:opacity-70 ${right ? 'text-right' : ''}`}
      style={{ color: sortKey === k ? '#00557f' : '#b2b2b2' }}>
      {children}<SortIcon k={k} />
    </th>
  )

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 max-w-[1400px] space-y-5 overflow-auto">

        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#0099f2' }}>Operativo</p>
          <h1 className="text-2xl font-bold text-tq-snorkel">Proveedores</h1>
          <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>
            {suppliers.length} proveedores · {totalProducts} modelos en catálogo
          </p>
        </div>

        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                <Th k="proveedor">Proveedor</Th>
                <Th k="modelos">Modelos</Th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>% Catálogo</th>
                <Th k="ingresos" right>Ingresos 12m</Th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>% Ingresos</th>
                <Th k="margenMedio" right>Margen medio</Th>
                <Th k="abcA">ABC-A</Th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>ABC-C</th>
                <th className="px-3 py-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Familias</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const isHighlight = s.proveedor === highlight
                return (
                  <tr
                    key={s.proveedor}
                    ref={isHighlight ? highlightRef : null}
                    className="hover:bg-[rgba(0,85,127,0.02)] transition-colors cursor-pointer"
                    onClick={() => setSelected(selected?.proveedor === s.proveedor ? null : s)}
                    style={{
                      borderBottom: i < sorted.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                      background: isHighlight ? 'rgba(0,153,242,0.04)' : undefined,
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-semibold text-tq-sky">{s.proveedor}</span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-tq-snorkel">{s.modelos}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-[rgba(0,85,127,0.08)]">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, s.pctCatalogo)}%`, background: '#00557f' }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: '#b2b2b2' }}>{s.pctCatalogo.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-mono text-right text-tq-snorkel whitespace-nowrap">{fmtEuro(s.ingresos)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[rgba(0,85,127,0.08)]">
                          <div className="h-1.5 rounded-full" style={{ width: `${s.pctIngresosMax}%`, background: '#0099f2' }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: '#b2b2b2' }}>{s.pctIngresos.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {s.margenMedio == null
                        ? <span style={{ color: '#b2b2b2' }}>—</span>
                        : <span style={{ color: s.margenMedio >= defaultMarginTarget ? '#3A9E6A' : s.margenMedio >= defaultMarginTarget * 0.8 ? '#C8842A' : '#C0392B', fontWeight: 600 }}>{s.margenMedio.toFixed(1)}%</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        background: s.modelos > 0 && s.abcA / s.modelos > 0.2 ? 'rgba(58,158,106,0.12)' : 'rgba(0,85,127,0.06)',
                        color: s.modelos > 0 && s.abcA / s.modelos > 0.2 ? '#2d7a54' : '#b2b2b2',
                      }}>{s.abcA}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        background: s.modelos > 0 && s.abcC / s.modelos > 0.5 ? 'rgba(192,57,43,0.1)' : 'rgba(0,85,127,0.06)',
                        color: s.modelos > 0 && s.abcC / s.modelos > 0.5 ? '#C0392B' : '#b2b2b2',
                      }}>{s.abcC}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {s.familias.slice(0, 3).map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}>{f}</span>
                        ))}
                        {s.familias.length > 3 && <span className="text-[9px]" style={{ color: '#b2b2b2' }}>+{s.familias.length - 3}</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {/* Totals */}
              <tr style={{ background: 'rgba(0,85,127,0.03)', borderTop: '2px solid rgba(0,85,127,0.1)' }}>
                <td className="px-3 py-2.5 text-xs font-bold text-tq-snorkel">TOTAL</td>
                <td className="px-3 py-2.5 text-xs font-bold text-tq-snorkel">{totalProducts}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-tq-snorkel">100%</td>
                <td className="px-3 py-2.5 text-xs font-bold font-mono text-right text-tq-snorkel">{fmtEuro(totalIngresos)}</td>
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar */}
      {selected && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSelected(null)} />
          <aside className="fixed right-0 top-0 h-full w-96 bg-white z-30 flex flex-col overflow-y-auto"
            style={{ boxShadow: '-4px 0 24px rgba(0,32,60,0.12)', borderLeft: '1px solid rgba(0,85,127,0.1)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Proveedor</p>
                <h2 className="text-base font-bold text-tq-snorkel">{selected.proveedor}</h2>
                <p className="text-xs" style={{ color: '#b2b2b2' }}>{selected.modelos} modelos</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-lg opacity-40 hover:opacity-70">✕</button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Modelos', value: selected.modelos },
                  { label: 'Ingresos 12m', value: fmtEuro(selected.ingresos) },
                  { label: 'Margen medio', value: selected.margenMedio != null ? selected.margenMedio.toFixed(1) + '%' : '—' },
                  { label: 'ABC-A', value: selected.abcA },
                ].map(k => (
                  <div key={k.label} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,85,127,0.04)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#b2b2b2' }}>{k.label}</div>
                    <div className="text-sm font-bold text-tq-snorkel">{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Familias distribution */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Familias</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.familias.map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* ABC */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#b2b2b2' }}>Distribución ABC</p>
                <div className="space-y-1.5">
                  {([['A', selected.abcA, '#3A9E6A'], ['B', selected.abcB, '#0099f2'], ['C', selected.abcC, '#C8842A']] as const).map(([label, count, color]) => (
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
                    <Link key={p.codigo_modelo} href={`/products/${p.codigo_modelo}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[rgba(0,85,127,0.04)] transition-colors">
                      <div>
                        <span className="font-mono text-xs font-bold text-tq-sky">{p.codigo_modelo}</span>
                        {p.familia && <span className="ml-2 text-[10px]" style={{ color: '#b2b2b2' }}>{p.familia}</span>}
                      </div>
                      <span className="text-xs font-mono" style={{ color: '#b2b2b2' }}>
                        {p.ingresos_12m != null ? fmtEuro(p.ingresos_12m) : '—'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Link href={`/products?supplier=${encodeURIComponent(selected.proveedor)}`}
                  className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center text-white"
                  style={{ background: '#00557f' }}>
                  Ver todos sus productos →
                </Link>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
