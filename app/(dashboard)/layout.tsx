import Link from 'next/link'
import Image from 'next/image'
import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui'
import { ChatWidget } from '@/components/ui/ChatWidget'

const navSections = [
  {
    label: 'Principal',
    items: [
      { href: '/', label: 'Dashboard', icon: '◈' },
      { href: '/products', label: 'Productos', icon: '◻' },
      { href: '/catalog', label: 'Catálogo', icon: '◫' },
    ],
  },
  {
    label: 'Analítica',
    items: [
      { href: '/analytics/surtido', label: 'Surtido', icon: '▦' },
      { href: '/analytics/precio', label: 'Precio', icon: '▤' },
      { href: '/analytics/ciclo-vida', label: 'Ciclo de vida', icon: '▣' },
      { href: '/analytics/rentabilidad', label: 'Rentabilidad', icon: '▧' },
      { href: '/analytics/stock', label: 'Stock', icon: '▥' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '/export', label: 'Exportar', icon: '↗' },
      { href: '/settings/sync', label: 'Sincronización', icon: '↻' },
      { href: '/settings/fields', label: 'Campos custom', icon: '≡' },
      { href: '/settings/pricing', label: 'Reglas de precio', icon: '⊞' },
      { href: '/help', label: 'Ayuda', icon: '?' },
      { href: '/test', label: 'Design system', icon: '◐' },
    ],
  },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[var(--tq-bg)]">
      {/* Sidebar */}
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-2 mb-1.5 text-[11px] font-bold tracking-widest uppercase text-white/40">
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <span className="text-xs opacity-60">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
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
          <div className="text-xs text-white/30">v1.7 · Sesión 17</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>

      <ChatWidget />
    </div>
  )
}
