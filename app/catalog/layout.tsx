import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CatalogTabNav } from './CatalogTabNav'

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#f4f1ee' }}>
      {/* Header compartido + tabs — sticky */}
      <header style={{ background: '#00557f' }} className="sticky top-0 z-20 shadow-md">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/icon_cream.png"
              alt="Te Quiero Joyerías"
              width={36}
              height={36}
              className="shrink-0 opacity-90"
            />
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-white/50 leading-none mb-1">
                Te Quiero Joyerías
              </p>
              <p className="text-lg font-bold text-white leading-none">
                Catálogo de producto
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
          >
            ← PIM
          </Link>
        </div>

        {/* Tab nav */}
        <div className="border-t border-white/10">
          <div className="max-w-screen-2xl mx-auto px-4">
            <CatalogTabNav />
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
