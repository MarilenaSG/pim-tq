import { KpiColor } from '@/types'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  color?: KpiColor
  icon?: string
}

const colorMap: Record<KpiColor, { accent: string; bg: string; text: string }> = {
  blue:    { accent: '#0099f2', bg: 'rgba(0,153,242,0.08)',   text: '#0099f2' },
  green:   { accent: '#3A9E6A', bg: 'rgba(58,158,106,0.08)',  text: '#3A9E6A' },
  amber:   { accent: '#C8842A', bg: 'rgba(200,132,42,0.08)',  text: '#C8842A' },
  red:     { accent: '#C0392B', bg: 'rgba(192,57,43,0.08)',   text: '#C0392B' },
  neutral: { accent: '#00557f', bg: 'rgba(0,85,127,0.06)',    text: '#00557f' },
}

export function KpiCard({ label, value, sub, color = 'neutral', icon }: KpiCardProps) {
  const c = colorMap[color]
  return (
    <div
      className="relative bg-white rounded-xl overflow-hidden"
      style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
    >
      {/* Color accent bar */}
      <div className="h-1" style={{ background: c.accent }} />

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-bold tracking-widest uppercase"
               style={{ color: c.text }}>
            {label}
          </div>
          {icon && (
            <span className="text-lg" style={{ color: c.accent }}>{icon}</span>
          )}
        </div>
        <div
          className="mt-2 text-3xl font-bold tracking-tight"
          style={{ color: '#00557f', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-1 text-xs" style={{ color: '#b2b2b2' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
