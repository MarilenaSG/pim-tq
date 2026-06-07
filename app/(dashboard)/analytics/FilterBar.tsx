'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface Props {
  familias: string[]
  metales:  string[]
}

export function FilterBar({ familias, metales }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()

  const familia = params.get('familia') ?? 'all'
  const metal   = params.get('metal')   ?? 'all'

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    router.push(`${pathname}?${next.toString()}`)
  }, [params, pathname, router])

  const hasFilter = familia !== 'all' || metal !== 'all'

  return (
    <div className="flex items-center gap-2 px-8 py-2.5 border-b border-[#e2ddd9] bg-[#faf8f6]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#b2b2b2] mr-1">Filtros</span>

      <select
        value={familia}
        onChange={e => update('familia', e.target.value)}
        className="text-xs border border-[#e0dbd6] rounded-lg px-2.5 py-1.5 bg-white text-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#00557f]"
      >
        <option value="all">Todas las familias</option>
        {familias.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      <select
        value={metal}
        onChange={e => update('metal', e.target.value)}
        className="text-xs border border-[#e0dbd6] rounded-lg px-2.5 py-1.5 bg-white text-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#00557f]"
      >
        <option value="all">Todos los metales</option>
        {metales.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      {hasFilter && (
        <button
          onClick={() => { update('familia', 'all'); update('metal', 'all') }}
          className="text-[11px] text-[#C0392B] hover:underline ml-1"
        >
          × Limpiar filtros
        </button>
      )}

      {hasFilter && (
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}>
          {[familia !== 'all' && familia, metal !== 'all' && metal].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  )
}
