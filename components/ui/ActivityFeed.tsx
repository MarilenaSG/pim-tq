import { ActivityItem } from '@/types'

interface ActivityFeedProps {
  items: ActivityItem[]
  maxItems?: number
}

const typeConfig: Record<ActivityItem['type'], { icon: string; color: string }> = {
  sync:   { icon: '↻', color: '#0099f2' },
  edit:   { icon: '✎', color: '#00557f' },
  export: { icon: '↗', color: '#3A9E6A' },
  ai:     { icon: '✦', color: '#c8a164' },
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (diffMin < 1)  return 'ahora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h`
  return `${Math.floor(diffH / 24)}d`
}

export function ActivityFeed({ items, maxItems = 6 }: ActivityFeedProps) {
  const visible = items.slice(0, maxItems)

  if (visible.length === 0) {
    return (
      <div className="text-center py-8 text-xs" style={{ color: '#b2b2b2' }}>
        Sin actividad reciente
      </div>
    )
  }

  return (
    <ul className="divide-y" style={{ borderColor: 'rgba(0,85,127,0.08)' }}>
      {visible.map((item) => {
        const cfg = typeConfig[item.type]
        return (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <span
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: `${cfg.color}18`, color: cfg.color }}
            >
              {cfg.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-tq-snorkel truncate">
                {item.title}
              </div>
              {item.description && (
                <div className="text-xs mt-0.5 truncate" style={{ color: '#b2b2b2' }}>
                  {item.description}
                </div>
              )}
            </div>
            <span className="shrink-0 text-xs" style={{ color: '#c6c6c6' }}>
              {formatTime(item.timestamp)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
