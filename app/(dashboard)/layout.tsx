import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui'
import { ZoneSidebar } from '@/components/ui/ZoneSidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[var(--tq-bg)]">
      <ZoneSidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>
    </div>
  )
}
