'use client'

import { useState } from 'react'
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
  shopifyStatus:      string | null
  shopifyVendor:      string | null
  leaderSlug:         string | null
  completitudPct:     number
  completitudNivel:   'alta' | 'media' | 'baja'
  is_discontinued:    boolean
  stock_total:        number
}

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

function ShopifyCell({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px]" style={{ color: '#d0cdc9' }}>—</span>
  const color = status === 'active' ? '#3A9E6A' : status === 'draft' ? '#C8842A' : '#b2b2b2'
  return <span className="text-[10px] font-bold capitalize" style={{ color }}>{status}</span>
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
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length }}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="w-14 px-3 py-3" />
              {(['Código', 'Descripción', 'Metal / Qt', 'Familia', 'ABC', 'Ingresos 12m', 'Vars', 'Shopify', 'Completitud'] as const).map(h => (
                <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr
                key={p.codigo_modelo}
                className="hover:bg-[rgba(0,85,127,0.02)] transition-colors"
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                  background: selected.has(p.codigo_modelo) ? 'rgba(0,153,242,0.04)' : undefined,
                }}
              >
                {/* Checkbox */}
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.codigo_modelo)}
                    onChange={() => toggle(p.codigo_modelo)}
                    className="cursor-pointer"
                  />
                </td>

                {/* Imagen */}
                <td className="px-3 py-2">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" style={{ background: '#f5f3f0' }} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(0,85,127,0.06)', color: '#d0cdc9' }}>◫</div>
                  )}
                </td>

                {/* Código */}
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/products/${p.codigo_modelo}`} className="font-mono text-xs font-bold text-tq-sky hover:underline">
                    {p.codigo_modelo}
                  </Link>
                  {p.leaderSlug && (
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: '#b2b2b2' }}>{p.leaderSlug}</div>
                  )}
                </td>

                {/* Descripción */}
                <td className="px-3 py-2 max-w-xs">
                  <div className="flex flex-col gap-1">
                    {p.is_discontinued && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase w-fit"
                        style={{ background: 'rgba(80,80,80,0.1)', color: '#555555', border: '1px solid rgba(80,80,80,0.2)' }}
                      >
                        ✕ Descatalogado
                      </span>
                    )}
                    <span className="line-clamp-2 text-xs leading-snug text-tq-snorkel">{p.description ?? '—'}</span>
                  </div>
                </td>

                {/* Metal / Quilates */}
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="text-xs font-medium text-tq-snorkel">{p.metal ?? '—'}</span>
                  {p.karat && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(200,161,100,0.15)', color: '#8a6830' }}>
                      {p.karat}
                    </span>
                  )}
                </td>

                {/* Familia */}
                <td className="px-3 py-2 text-xs" style={{ color: '#b2b2b2' }}>{p.familia ?? '—'}</td>

                {/* ABC */}
                <td className="px-3 py-2"><AbcBadge abc={p.abc_ventas} /></td>

                {/* Ingresos 12m */}
                <td className="px-3 py-2 font-mono text-xs text-right text-tq-snorkel whitespace-nowrap">
                  {p.ingresos_12m != null ? p.ingresos_12m.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' : '—'}
                </td>

                {/* Variantes / Stock */}
                <td className="px-3 py-2 text-xs text-center whitespace-nowrap" style={{ color: '#b2b2b2' }}>
                  <span>{p.num_variantes ?? '—'}</span>
                  {p.stock_total > 0 && (
                    <span className="ml-1 text-[10px] font-bold" style={{ color: '#3A9E6A' }}>/ {p.stock_total}</span>
                  )}
                </td>

                {/* Shopify */}
                <td className="px-3 py-2"><ShopifyCell status={p.shopifyStatus} /></td>

                {/* Completitud */}
                <td className="px-3 py-2 w-28">
                  <CompletitudBar pct={p.completitudPct} nivel={p.completitudNivel} />
                </td>
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
