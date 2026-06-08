'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { SidebarAlertBadge } from '@/components/ui/SidebarAlertBadge'

const LS_KEY = 'tq_sidebar_collapsed'

const NAV = [
  {
    label: 'Inicio',
    items: [
      { label: 'Dashboard',         href: '/',                    icon: '◈', exact: true },
      { label: 'Productos',         href: '/products',            icon: '◻' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { label: 'Campañas',          href: '/campaigns',           icon: '◈' },
      { label: 'Lanzamientos',      href: '/lanzamiento',         icon: '◈' },
      { label: 'Alertas',           href: '/alerts',              icon: '⚑', badge: true },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { label: 'Ventas',             href: '/ventas',              icon: '▨' },
    ],
  },
  {
    label: 'Analítica',
    items: [
      { label: 'Analítica',         href: '/analytics/surtido',   icon: '▦' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { label: 'Stock',             href: '/stock',               icon: '▥' },
      { label: 'Proveedores',       href: '/suppliers',           icon: '◇' },
    ],
  },
  {
    label: 'Tiendas',
    items: [
      { label: 'Red de tiendas',    href: '/tiendas',             icon: '◫' },
      { label: 'Boletín',           href: '/tiendas/boletin',     icon: '◫' },
      { label: 'Catálogo',          href: '/tiendas/catalogo',    icon: '◻' },
    ],
  },
  {
    label: 'Ajustes',
    items: [
      { label: 'Sincronización',    href: '/settings/sync',       icon: '↻' },
      { label: 'Reglas de precio',  href: '/settings/pricing',    icon: '⊞' },
      { label: 'Ayuda',             href: '/help',                icon: '?' },
    ],
  },
] as const

export function ZoneSidebar() {
  const pathname   = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    if (href === '/analytics/surtido') return pathname.startsWith('/analytics')
    if (href === '/lanzamiento') return pathname.startsWith('/lanzamiento')
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Avoid flash of wrong state before hydration
  const c = mounted ? collapsed : false

  return (
    <aside
      className="shrink-0 flex flex-col bg-tq-snorkel text-white overflow-y-auto overflow-x-hidden"
      style={{
        width:      c ? 56 : 224,
        minWidth:   c ? 56 : 224,
        transition: 'width 200ms ease, min-width 200ms ease',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center border-b border-white/10"
        style={{
          padding:        c ? '14px 0' : '14px 16px',
          justifyContent: c ? 'center' : 'space-between',
          minHeight:      60,
        }}
      >
        {c ? (
          <button onClick={toggle} title="Expandir menú" className="opacity-60 hover:opacity-100 transition-opacity">
            <Image src="/brand/icon_cream.png" alt="TQ" width={26} height={26} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <Image src="/brand/icon_cream.png" alt="Te Quiero Jewels" width={26} height={26} className="shrink-0 opacity-90" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold tracking-widest uppercase text-white/40 leading-none mb-0.5 truncate">
                  Te Quiero Jewels
                </div>
                <div className="text-[13px] font-semibold leading-none tracking-tight">PIM</div>
              </div>
            </div>
            <button
              onClick={toggle}
              title="Colapsar menú"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
              style={{ fontSize: 10 }}
            >
              ◀
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3" style={{ padding: c ? '12px 0' : '12px 8px' }}>
        {NAV.map(section => (
          <div key={section.label} className="mb-3">
            {!c && (
              <div className="px-2 mb-1 text-[9px] font-bold tracking-widest uppercase text-white/50">
                {section.label}
              </div>
            )}
            <ul className="space-y-px">
              {section.items.map(item => {
                const active = isActive(item.href, 'exact' in item ? item.exact : false)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={c ? item.label : undefined}
                      className="flex items-center rounded-md transition-colors"
                      style={{
                        gap:        c ? 0 : 8,
                        padding:    c ? '7px 0' : '6px 8px',
                        justifyContent: c ? 'center' : undefined,
                        background: active ? 'rgba(255,255,255,0.14)' : undefined,
                        color:      active ? 'white' : 'rgba(255,255,255,0.82)',
                        fontWeight: active ? 600 : undefined,
                        fontSize:   13,
                      }}
                    >
                      <span style={{ fontSize: 12, opacity: active ? 0.85 : 0.45, flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      {!c && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {'badge' in item && item.badge && (
                            <SidebarAlertBadge />
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            {!c && <div className="mt-3 mx-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />}
          </div>
        ))}
      </nav>

      {/* Footer — expand button when collapsed */}
      {c && (
        <div className="py-3 flex justify-center border-t border-white/10">
          <button
            onClick={toggle}
            title="Expandir menú"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/70"
            style={{ fontSize: 10 }}
          >
            ▶
          </button>
        </div>
      )}
    </aside>
  )
}
