'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/catalog',         label: 'Catálogo' },
  { href: '/catalog/pedidos', label: 'Plantilla Pedidos' },
]

export function CatalogTabNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1">
      {TABS.map(tab => {
        const active = pathname === tab.href || (tab.href !== '/catalog' && pathname.startsWith(tab.href))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"
            style={{
              color:        active ? '#ffffff' : 'rgba(255,255,255,0.6)',
              borderBottom: active ? '2px solid white' : '2px solid transparent',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
