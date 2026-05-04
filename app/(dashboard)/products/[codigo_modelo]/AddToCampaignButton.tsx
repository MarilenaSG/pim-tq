'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui'

export interface ActiveCampaign { id: string; nombre: string; color: string | null }

export function AddToCampaignButton({
  codigoModelo,
  campaigns,
  alreadyIn,
}: {
  codigoModelo: string
  campaigns: ActiveCampaign[]
  alreadyIn: Set<string>
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  if (campaigns.length === 0) return null

  async function add(campaignId: string, nombre: string) {
    setLoading(campaignId)
    setOpen(false)
    const res = await fetch(`/api/campaigns/${campaignId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos: [codigoModelo] }),
    })
    setLoading(null)
    if (!res.ok) { toast('Error al añadir a campaña', 'error'); return }
    toast(`Añadido a "${nombre}"`, 'success')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        style={{ background: 'rgba(200,132,42,0.1)', color: '#a06818', border: '1px solid rgba(200,132,42,0.2)' }}
      >
        {loading ? '…' : '◈ Añadir a campaña'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1 left-0 z-20 rounded-xl overflow-hidden min-w-48"
            style={{ background: 'white', boxShadow: '0 8px 24px rgba(0,32,60,0.15)', border: '1px solid rgba(0,85,127,0.1)' }}
          >
            {campaigns.map(c => {
              const inIt = alreadyIn.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => !inIt && add(c.id, c.nombre)}
                  disabled={inIt}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-[rgba(0,85,127,0.04)] transition-colors disabled:opacity-50"
                  style={{ color: '#00557f' }}
                >
                  {c.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />}
                  <span className="flex-1">{c.nombre}</span>
                  {inIt && <span className="text-[10px] font-bold" style={{ color: '#3A9E6A' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
