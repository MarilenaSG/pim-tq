'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const tabs = [
  { href: '/analytics/surtido',      label: 'Surtido' },
  { href: '/analytics/precio',       label: 'Precio' },
  { href: '/analytics/ciclo-vida',   label: 'Ciclo de vida' },
  { href: '/analytics/rentabilidad', label: 'Rentabilidad' },
  { href: '/analytics/stock',        label: 'Stock' },
  { href: '/analytics/ventas',       label: 'Ventas' },
]

export function AnalyticsTabs() {
  const pathname = usePathname()
  const params   = useSearchParams()
  const qs       = params.toString() ? `?${params.toString()}` : ''

  return (
    <nav className="flex gap-1">
      {tabs.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${qs}`}
            className="px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
            style={{
              color:       active ? '#00557f' : 'rgba(0,85,127,0.5)',
              borderColor: active ? '#00557f' : 'transparent',
              fontWeight:  active ? 600 : undefined,
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
