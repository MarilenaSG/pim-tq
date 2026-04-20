import Link from 'next/link'
import { ReactNode } from 'react'

const tabs = [
  { href: '/analytics/surtido',       label: 'Surtido' },
  { href: '/analytics/precio',        label: 'Precio' },
  { href: '/analytics/ciclo-vida',    label: 'Ciclo de vida' },
  { href: '/analytics/rentabilidad',  label: 'Rentabilidad' },
  { href: '/analytics/stock',         label: 'Stock' },
]

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--tq-bg)]">
      {/* Sub-nav */}
      <div className="bg-white border-b border-[#e2ddd9] px-8">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-4 py-3.5 text-sm font-medium text-[#00557f]/60 hover:text-[#00557f] border-b-2 border-transparent hover:border-[#00557f]/30 transition-colors"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-8 max-w-7xl">
        {children}
      </div>
    </div>
  )
}
