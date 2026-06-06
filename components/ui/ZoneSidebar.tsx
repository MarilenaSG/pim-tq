'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { ZONES, DEFAULT_ZONE, getZone, getZoneHome, type ZoneConfig } from '@/lib/zones'
import { SidebarAlertBadge } from '@/components/ui/SidebarAlertBadge'
import type { Zone } from '@/types'

const LS_ZONE   = 'tq_last_zone'
const LS_PICKER = 'tq_zone_switcher_open'

function isValidZone(v: string | null): v is Zone {
  return v === 'cm' || v === 'ventas' || v === 'stock' || v === 'tiendas'
}

export function ZoneSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const [activeZone, setActiveZone]   = useState<Zone>(DEFAULT_ZONE)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [mounted,    setMounted]      = useState(false)

  // Hydrate from localStorage once on client
  useEffect(() => {
    const stored = localStorage.getItem(LS_ZONE)
    if (isValidZone(stored)) setActiveZone(stored)

    const pickerStored = localStorage.getItem(LS_PICKER)
    if (pickerStored === 'true') setPickerOpen(true)

    setMounted(true)
  }, [])

  const switchZone = useCallback((zone: Zone) => {
    setActiveZone(zone)
    setPickerOpen(false)
    localStorage.setItem(LS_ZONE, zone)
    localStorage.setItem(LS_PICKER, 'false')
    router.push(getZoneHome(zone))
  }, [router])

  const togglePicker = useCallback(() => {
    setPickerOpen(prev => {
      const next = !prev
      localStorage.setItem(LS_PICKER, String(next))
      return next
    })
  }, [])

  const zoneConfig: ZoneConfig = mounted ? getZone(activeZone) : ZONES[0]

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-tq-snorkel text-white overflow-y-auto">

      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <Image
          src="/brand/icon_cream.png"
          alt="Te Quiero Joyerías"
          width={32}
          height={32}
          className="shrink-0 opacity-90"
        />
        <div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-white/50 leading-none mb-1">
            Te Quiero Joyerías
          </div>
          <div className="text-base font-semibold tracking-tight leading-none">
            PIM
          </div>
        </div>
      </div>

      {/* Zone switcher */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={togglePicker}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-white/10"
          style={{
            background: pickerOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
            color: 'white',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="text-xs">{zoneConfig.icon}</span>
            <span>{zoneConfig.shortLabel}</span>
          </span>
          <span className="text-[10px] text-white/50 transition-transform" style={{ transform: pickerOpen ? 'rotate(180deg)' : undefined }}>
            ▾
          </span>
        </button>

        {/* Zone picker dropdown */}
        {pickerOpen && (
          <div className="mt-1 rounded-lg overflow-hidden border border-white/10">
            {ZONES.map(z => (
              <button
                key={z.zone}
                onClick={() => switchZone(z.zone)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  background: z.zone === activeZone
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  color: z.zone === activeZone ? 'white' : 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span className="text-xs opacity-70">{z.icon}</span>
                <div className="min-w-0">
                  <div className="font-medium leading-tight truncate">{z.label}</div>
                  <div className="text-[10px] text-white/40 leading-tight truncate">{z.description}</div>
                </div>
                {z.zone === activeZone && (
                  <span className="ml-auto text-[10px] text-white/40">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 py-3 space-y-4">
        {zoneConfig.sections.map(section => (
          <div key={section.label}>
            <div className="px-2 mb-1 text-[10px] font-bold tracking-widest uppercase text-white/35">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const isActive = item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors"
                      style={{
                        background:  isActive ? 'rgba(255,255,255,0.15)' : undefined,
                        color:       isActive ? 'white' : 'rgba(255,255,255,0.7)',
                        fontWeight:  isActive ? 600 : undefined,
                      }}
                    >
                      <span className="text-xs" style={{ opacity: isActive ? 0.8 : 0.5 }}>
                        {item.icon}
                      </span>
                      {item.label}
                      {item.badge === 'alerts' && (
                        <span className="ml-auto">
                          <SidebarAlertBadge />
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2.5">
        <Image
          src="/brand/icon_cream.png"
          alt=""
          width={16}
          height={16}
          className="opacity-20"
        />
        <div className="text-xs text-white/30">v2.0</div>
      </div>
    </aside>
  )
}
