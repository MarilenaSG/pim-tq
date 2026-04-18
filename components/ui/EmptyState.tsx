import Link from 'next/link'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  message: string
  description?: string
  cta?: {
    label: string
    href: string
  }
}

export function EmptyState({ icon, message, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
        style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
      >
        {icon}
      </div>
      <p className="font-semibold text-tq-snorkel text-base">{message}</p>
      {description && (
        <p className="mt-1 text-sm max-w-xs" style={{ color: '#b2b2b2' }}>
          {description}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: '#0099f2' }}
        >
          {cta.label} →
        </Link>
      )}
    </div>
  )
}
