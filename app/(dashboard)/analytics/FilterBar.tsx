'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { FilterSelect } from '@/components/ui'

interface Props {
  familias:  string[]
  metales:   string[]
  suppliers: string[]
}

export function FilterBar({ familias, metales, suppliers }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const familia  = params.get('familia')  ?? ''
  const metal    = params.get('metal')    ?? ''
  const supplier = params.get('supplier') ?? ''

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (!value) next.delete(key)
    else next.set(key, value)
    router.push(`${pathname}?${next.toString()}`)
  }, [params, pathname, router])

  const hasFilter = !!(familia || metal || supplier)

  return (
    <div
      className="flex items-center gap-2 px-6 py-2 border-b"
      style={{ borderColor: '#e2ddd9', background: '#faf8f6' }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: '#b2b2b2' }}>
        Filtros
      </span>

      <FilterSelect
        placeholder="Marca"
        value={supplier}
        options={suppliers}
        onChange={v => update('supplier', v)}
        maxWidth={150}
      />
      <FilterSelect
        placeholder="Familia"
        value={familia}
        options={familias}
        onChange={v => update('familia', v)}
      />
      <FilterSelect
        placeholder="Metal"
        value={metal}
        options={metales}
        onChange={v => update('metal', v)}
      />

      {hasFilter && (
        <button
          onClick={() => { update('familia', ''); update('metal', ''); update('supplier', '') }}
          className="h-8 px-2.5 text-xs font-semibold rounded-lg transition-colors"
          style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}
        >
          ✕ Limpiar
        </button>
      )}

      {hasFilter && (
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}>
          {[supplier, familia, metal].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  )
}
