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
  precioMedio: number | null
  abcA: number; abcB: number; abcC: number
  abcA_uni: number; abcB_uni: number; abcC_uni: number
  abcATotal: number; abcAConStock: number
  familias: string[]
  topProductos: { codigo_modelo: string; familia: string | null; abc_ventas: string | null; ingresos_12m: number | null }[]
}

type SortKey = 'proveedor' | 'modelos' | 'ingresos' | 'margenMedio' | 'abcA'

function fmtEuro(n: number) { return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' }

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1 rounded-full" style={{ background: 'rgba(0,85,127,0.1)' }}>
        <div className="h-1 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono tabular-nums" style={{ color: '#8fa8b8' }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function AbcBars({ a, b, c, total, colorA = '#3A9E6A', colorB = '#0099f2', colorC = '#C8842A' }: {
  a: number; b: number; c: number; total: number
  colorA?: string; colorB?: string; colorC?: string
}) {
  return (
    <div className="space-y-1.5">
      {([['A', a, colorA], ['B', b, colorB], ['C', c, colorC]] as const).map(([label, count, color]) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <span className="w-4 font-bold shrink-0" style={{ color }}>{label}</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,85,127,0.08)' }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: color }} />
          </div>
          <span className="w-5 text-right shrink-0 font-semibold" style={{ color: '#00264d' }}>{count}</span>
          <span className="w-8 text-right shrink-0 text-[11px]" style={{ color: '#8fa8b8' }}>
            {total > 0 ? ((count / total) * 100).toFixed(0) + '%' : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function PanelKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,85,127,0.04)' }}>
      <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8fa8b8' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: color ?? '#00264d' }}>{value}</div>
    </div>
  )
}

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

  function Th({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) {
    const active = sortKey === k
    return (
      <th
        className={`sortable${active ? ' sort-active' : ''}${right ? ' right' : ''}`}
        onClick={() => toggleSort(k)}
      >
        {children}
        <span className="ml-1 opacity-50" style={{ fontSize: 8 }}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </th>
    )
  }

  const margenColor = (m: number | null) =>
    m == null ? '#8fa8b8'
    : m >= defaultMarginTarget       ? '#3A9E6A'
    : m >= defaultMarginTarget * 0.8 ? '#C8842A'
    : '#C0392B'

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 max-w-[1400px] space-y-5 overflow-auto">

        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#0099f2' }}>Operativo</p>
          <h1 className="text-2xl font-bold text-tq-snorkel">Proveedores</h1>
          <p className="text-sm mt-1" style={{ color: '#8fa8b8' }}>
            {suppliers.length} proveedores · {totalProducts} modelos en catálogo
          </p>
        </div>

        <div className="tq-table-wrap">
          <table className="tq-table">
            <thead>
              <tr>
                <Th k="proveedor">Proveedor</Th>
                <Th k="modelos">Modelos</Th>
                <th>% Catálogo</th>
                <Th k="ingresos" right>Ingresos 12m</Th>
                <th>% Ingresos</th>
                <Th k="margenMedio" right>Margen medio</Th>
                <Th k="abcA">ABC-A ingr.</Th>
                <th>ABC-C ingr.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const isActive   = selected?.proveedor === s.proveedor
                const isHighlight = s.proveedor === highlight
                return (
                  <tr
                    key={s.proveedor}
                    ref={isHighlight ? highlightRef : null}
                    className={isActive ? 'row-active' : ''}
                    style={{ cursor: 'pointer', background: isHighlight && !isActive ? 'rgba(0,153,242,0.035)' : undefined }}
                    onClick={() => setSelected(isActive ? null : s)}
                  >
                    <td>
                      <span className="font-medium" style={{ fontSize: 13, color: '#00557f' }}>{s.proveedor}</span>
                    </td>
                    <td style={{ color: '#00264d' }}>{s.modelos}</td>
                    <td><MiniBar pct={s.pctCatalogo} color="#00557f" /></td>
                    <td className="right font-mono tabular-nums" style={{ color: '#00264d', fontWeight: 500 }}>{fmtEuro(s.ingresos)}</td>
                    <td><MiniBar pct={s.pctIngresos} color="#0099f2" /></td>
                    <td className="right">
                      {s.margenMedio == null
                        ? <span style={{ color: '#8fa8b8' }}>—</span>
                        : <span style={{ color: margenColor(s.margenMedio), fontWeight: 600 }}>{s.margenMedio.toFixed(1)}%</span>
                      }
                    </td>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{
                        background: s.modelos > 0 && s.abcA / s.modelos > 0.2 ? 'rgba(58,158,106,0.12)' : 'rgba(0,85,127,0.06)',
                        color:      s.modelos > 0 && s.abcA / s.modelos > 0.2 ? '#2d7a54' : '#8fa8b8',
                      }}>{s.abcA}</span>
                    </td>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{
                        background: s.modelos > 0 && s.abcC / s.modelos > 0.5 ? 'rgba(192,57,43,0.08)' : 'rgba(0,85,127,0.06)',
                        color:      s.modelos > 0 && s.abcC / s.modelos > 0.5 ? '#C0392B' : '#8fa8b8',
                      }}>{s.abcC}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td>{totalProducts}</td>
                <td>100%</td>
                <td className="right font-mono">{fmtEuro(totalIngresos)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSelected(null)} />
          <aside
            className="fixed right-0 top-0 h-full w-[22rem] bg-white z-30 flex flex-col overflow-y-auto"
            style={{ boxShadow: '-4px 0 24px rgba(0,32,60,0.1)', borderLeft: '1px solid rgba(0,85,127,0.08)' }}
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>Proveedor</p>
                <h2 className="text-[15px] font-bold text-tq-snorkel leading-tight">{selected.proveedor}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#8fa8b8' }}>{selected.modelos} modelos · {selected.familias.length} familias</p>
              </div>
              <button onClick={() => setSelected(null)} className="mt-1 text-base opacity-30 hover:opacity-60 transition-opacity">✕</button>
            </div>

            <div className="p-5 space-y-5 flex-1">

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-2.5">
                <PanelKpi label="Modelos"      value={String(selected.modelos)} />
                <PanelKpi label="Ingresos 12m" value={fmtEuro(selected.ingresos)} />
                <PanelKpi label="Precio medio"
                  value={selected.precioMedio != null ? fmtEuro(selected.precioMedio) : '—'} />
                <PanelKpi label="Margen medio"
                  value={selected.margenMedio != null ? selected.margenMedio.toFixed(1) + '%' : '—'}
                  color={margenColor(selected.margenMedio)} />
              </div>

              {/* ABC por ingresos */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8fa8b8' }}>ABC por ingresos</p>
                <AbcBars a={selected.abcA} b={selected.abcB} c={selected.abcC} total={selected.modelos} />
              </div>

              {/* ABC por rotación */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8fa8b8' }}>ABC por rotación (uds.)</p>
                <AbcBars
                  a={selected.abcA_uni} b={selected.abcB_uni} c={selected.abcC_uni}
                  total={selected.modelos}
                  colorA="#C8842A" colorB="#8B5E1A" colorC="#d4a87a"
                />
              </div>

              {/* Familias */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8fa8b8' }}>Familias</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.familias.map(f => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* Top 5 */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#8fa8b8' }}>Top 5 por ingresos</p>
                <div className="space-y-0.5">
                  {selected.topProductos.map(p => (
                    <Link key={p.codigo_modelo} href={`/products/${p.codigo_modelo}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors"
                      style={{ ['--hover-bg' as string]: 'rgba(0,85,127,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,85,127,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-tq-sky">{p.codigo_modelo}</span>
                        {p.familia && <span className="text-[10px]" style={{ color: '#8fa8b8' }}>{p.familia}</span>}
                      </div>
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: '#8fa8b8' }}>
                        {p.ingresos_12m != null ? fmtEuro(p.ingresos_12m) : '—'}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer CTA */}
            <div className="px-5 pb-5">
              <Link
                href={`/products?proveedor=${encodeURIComponent(selected.proveedor)}`}
                className="block text-[13px] font-semibold px-4 py-2.5 rounded-lg text-center text-white transition-opacity hover:opacity-90"
                style={{ background: '#00557f' }}
              >
                Ver todos sus productos →
              </Link>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
