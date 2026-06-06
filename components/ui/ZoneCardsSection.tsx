'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ZONES, getZoneHome } from '@/lib/zones'
import type { Zone } from '@/types'

const LS_ZONE = 'tq_last_zone'

function isValidZone(v: string | null): v is Zone {
  return v === 'cm' || v === 'ventas' || v === 'stock' || v === 'tiendas'
}

export function ZoneCardsSection() {
  const router = useRouter()
  const [activeZone, setActiveZone] = useState<Zone | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_ZONE)
    if (isValidZone(stored)) setActiveZone(stored)
  }, [])

  const handleSelect = useCallback((zone: Zone) => {
    setActiveZone(zone)
    localStorage.setItem(LS_ZONE, zone)
    router.push(getZoneHome(zone))
  }, [router])

  return (
    <div className="mb-8">
      <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#b2b2b2' }}>
        Zona de trabajo
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ZONES.map(z => {
          const isActive = activeZone === z.zone

          return (
            <button
              key={z.zone}
              onClick={() => handleSelect(z.zone)}
              className="text-left rounded-xl px-4 py-4 transition-all"
              style={{
                background:  isActive ? z.color : 'white',
                border:      `2px solid ${isActive ? z.color : 'rgba(0,85,127,0.08)'}`,
                boxShadow:   isActive
                  ? `0 4px 16px ${z.color}30`
                  : '0 2px 6px rgba(0,32,60,0.06)',
                transform:   isActive ? 'translateY(-1px)' : undefined,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-base"
                  style={{ color: isActive ? 'rgba(255,255,255,0.8)' : z.color }}
                >
                  {z.icon}
                </span>
                <span
                  className="text-xs font-bold tracking-wide uppercase"
                  style={{ color: isActive ? 'rgba(255,255,255,0.6)' : '#b2b2b2' }}
                >
                  {z.shortLabel}
                </span>
                {isActive && (
                  <span
                    className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}
                  >
                    Activa
                  </span>
                )}
              </div>
              <div
                className="text-sm font-semibold mb-0.5 leading-tight"
                style={{ color: isActive ? 'white' : '#00557f' }}
              >
                {z.label}
              </div>
              <div
                className="text-xs leading-tight"
                style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#b2b2b2' }}
              >
                {z.description}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
