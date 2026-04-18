import Link from 'next/link'
import { ReactNode } from 'react'

interface FeatureCardProps {
  icon: ReactNode
  name: string
  description: string
  href: string
  badge?: string
}

export function FeatureCard({ icon, name, description, href, badge }: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group block bg-white rounded-xl p-5 transition-shadow hover:shadow-md"
      style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
    >
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
          style={{ background: 'rgba(0,153,242,0.10)', color: '#0099f2' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-tq-snorkel group-hover:text-tq-sky transition-colors">
              {name}
            </span>
            {badge && (
              <span
                className="text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(0,153,242,0.12)', color: '#007acc' }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#b2b2b2' }}>
            {description}
          </p>
        </div>
        <span
          className="shrink-0 text-sm transition-transform group-hover:translate-x-0.5"
          style={{ color: '#c6c6c6' }}
        >
          →
        </span>
      </div>
    </Link>
  )
}
