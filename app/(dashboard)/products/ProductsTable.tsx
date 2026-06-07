'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'

export type ProductTableRow = {
  codigo_modelo:      string
  description:        string | null
  metal:              string | null
  karat:              string | null
  familia:            string | null
  num_variantes:      number | null
  ingresos_12m:       number | null
  abc_ventas:         string | null
  imageUrl:           string | null
  leaderSlug:         string | null
  completitudPct:     number
  completitudNivel:   'alta' | 'media' | 'baja'
  is_discontinued:    boolean
  lifecycle_status:   string
  stock_total:        number
  shopify_status:     string | null
}

type SortKey = 'stock_total' | 'ingresos_12m' | null
type SortDir = 'asc' | 'desc'

export type CampaignOption = { id: string; nombre: string }

// ── sub-components ────────────────────────────────────────────────

function AbcBadge({ abc }: { abc: string | null }) {
  if (!abc) return <span style={{ color: '#d0cdc9' }}>—</span>
  const cfg: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(58,158,106,0.12)', text: '#2d7a54' },
    B: { bg: 'rgba(0,153,242,0.12)',  text: '#007acc' },
    C: { bg: 'rgba(200,132,42,0.12)', text: '#a06818' },
  }
  const { bg, text } = cfg[abc] ?? { bg: 'rgba(0,85,127,0.06)', text: '#b2b2b2' }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: bg, color: text }}>{abc}</span>
}


function CompletitudBar({ pct, nivel }: { pct: number; nivel: 'alta' | 'media' | 'baja' }) {
  const bar = nivel === 'alta' ? '#3A9E6A' : nivel === 'media' ? '#C8842A' : '#C0392B'
  const text = bar
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold" style={{ color: text }}>{pct}%</span>
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(0,85,127,0.08)' }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: bar }} />
      </div>
    </div>
  )
}

function ShopifyStatusBadge({ status }: { status: string | null }) {
  const cfg = {
    active:   { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54', label: 'Activo'    },
    draft:    { bg: 'rgba(200,132,42,0.12)',   text: '#a06818', label: 'Borrador'  },
    archived: { bg: 'rgba(192,57,43,0.12)',    text: '#992d22', label: 'Archivado' },
  }[status ?? ''] ?? { bg: 'rgba(0,85,127,0.06)', text: '#b2b2b2', label: 'Sin sync' }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

function StockCell({ stock }: { stock: number }) {
  if (stock === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}>
      ⚠ 0
    </span>
  )
  return <span className="font-mono text-xs font-bold" style={{ color: '#3A9E6A' }}>{stock.toLocaleString('es-ES')}</span>
}

function SortableHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      className={`sortable right${active ? ' sort-active' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 opacity-40" style={{ fontSize: 8 }}>
        {active ? (dir === 'desc' ? '▼' : '▲') : '⇅'}
      </span>
    </th>
  )
}

// ── main ──────────────────────────────────────────────────────────

export function ProductsTable({
  rows,
  campaigns,
}: {
  rows: ProductTableRow[]
  campaigns: CampaignOption[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [campaignDrop, setCampaignDrop] = useState(false)
  const [addingToCampaign, setAddingToCampaign] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -1
      const bv = b[sortKey] ?? -1
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
  }, [rows, sortKey, sortDir])

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.codigo_modelo)))
  }

  function toggle(code: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function addToCampaign(campaignId: string, campaignName: string) {
    setAddingToCampaign(true)
    setCampaignDrop(false)
    const codigos = Array.from(selected)
    const res = await fetch(`/api/campaigns/${campaignId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos }),
    })
    setAddingToCampaign(false)
    if (!res.ok) { toast('Error al añadir a campaña', 'error'); return }
    toast(`${codigos.length} producto(s) añadidos a "${campaignName}"`, 'success')
    setSelected(new Set())
  }

  function compare() {
    const codes = Array.from(selected).slice(0, 4)
    router.push(`/compare?items=${codes.join(',')}`)
  }

  return (
    <div className="relative">
      <div className="tq-table-wrap">
        <table className="tq-table">
          <thead>
            <tr>
              <th style={{ width: 32, paddingRight: 0 }}>
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length }}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
              <th style={{ width: 52 }} />
              <th>Código</th>
              <th>Descripción</th>
              <th>Metal / Qt</th>
              <th>Familia</th>
              <th>ABC</th>
              <SortableHeader label="Ingresos 12m" sortKey="ingresos_12m" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th>Vars</th>
              <SortableHeader label="Stock" sortKey="stock_total" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th>Shopify</th>
              <th>Completitud</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(p => (
              <tr
                key={p.codigo_modelo}
                className={selected.has(p.codigo_modelo) ? 'row-selected' : ''}
              >
                {/* Checkbox */}
                <td style={{ paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.codigo_modelo)}
                    onChange={() => toggle(p.codigo_modelo)}
                    className="cursor-pointer"
                  />
                </td>

                {/* Imagen */}
                <td>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" style={{ background: '#f5f3f0' }} />
                  ) : (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,85,127,0.06)', color: '#d0cdc9', fontSize: 15 }}>◫</div>
                  )}
                </td>

                {/* Código */}
                <td className="whitespace-nowrap">
                  <Link href={`/products/${p.codigo_modelo}`} className="font-mono text-xs font-bold text-tq-sky hover:underline">
                    {p.codigo_modelo}
                  </Link>
                  {p.leaderSlug && (
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: '#8fa8b8' }}>{p.leaderSlug}</div>
                  )}
                </td>

                {/* Descripción */}
                <td style={{ maxWidth: 280 }}>
                  <div className="flex flex-col gap-0.5">
                    {p.is_discontinued && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase w-fit"
                        style={{ background: 'rgba(80,80,80,0.08)', color: '#777', border: '1px solid rgba(80,80,80,0.15)' }}>
                        ✕ Descatalogado
                      </span>
                    )}
                    <span className="line-clamp-2 text-[13px] leading-snug" style={{ color: '#00264d' }}>{p.description ?? '—'}</span>
                  </div>
                </td>

                {/* Metal / Quilates */}
                <td className="whitespace-nowrap">
                  <span className="text-[13px] font-medium" style={{ color: '#00264d' }}>{p.metal ?? '—'}</span>
                  {p.karat && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(200,161,100,0.15)', color: '#8a6830' }}>
                      {p.karat}
                    </span>
                  )}
                </td>

                {/* Familia */}
                <td style={{ color: '#8fa8b8', fontSize: 12 }}>{p.familia ?? '—'}</td>

                {/* ABC */}
                <td><AbcBadge abc={p.abc_ventas} /></td>

                {/* Ingresos 12m */}
                <td className="right font-mono whitespace-nowrap" style={{ color: '#00264d', fontWeight: 500 }}>
                  {p.ingresos_12m != null ? p.ingresos_12m.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' : '—'}
                </td>

                {/* Variantes */}
                <td className="text-center" style={{ color: '#8fa8b8', fontSize: 12 }}>{p.num_variantes ?? '—'}</td>

                {/* Stock */}
                <td className="text-center whitespace-nowrap"><StockCell stock={p.stock_total} /></td>

                {/* Shopify */}
                <td><ShopifyStatusBadge status={p.shopify_status} /></td>

                {/* Completitud */}
                <td style={{ width: 110 }}><CompletitudBar pct={p.completitudPct} nivel={p.completitudNivel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
          style={{ background: '#00557f', color: 'white', minWidth: 380 }}
        >
          <span className="text-sm font-semibold mr-1">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>

          {/* Add to campaign */}
          <div className="relative">
            <button
              onClick={() => setCampaignDrop(v => !v)}
              disabled={addingToCampaign || campaigns.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors hover:bg-white/10"
            >
              {addingToCampaign ? '…' : '◈ Añadir a campaña'}
            </button>
            {campaignDrop && campaigns.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCampaignDrop(false)} />
                <div
                  className="absolute bottom-full mb-2 left-0 rounded-xl py-1 z-20 min-w-48"
                  style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,32,60,0.18)', border: '1px solid rgba(0,85,127,0.1)' }}
                >
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      onClick={() => addToCampaign(c.id, c.nombre)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[rgba(0,85,127,0.05)] transition-colors text-tq-snorkel"
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Compare */}
          <button
            onClick={compare}
            disabled={selected.size < 2 || selected.size > 4}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors hover:bg-white/10"
            title="Compara entre 2 y 4 productos"
          >
            ◧ Comparar {selected.size > 4 ? '(máx 4)' : ''}
          </button>

          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-white/60 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
