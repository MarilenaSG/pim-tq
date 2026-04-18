import { SyncStatus } from '@/types'

interface SyncIndicatorProps {
  lastSync: Date | string | null
  status: SyncStatus
  label?: string
}

function formatRelative(date: Date | string | null): string {
  if (!date) return 'Nunca sincronizado'
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1)  return 'Hace menos de 1 min'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffH < 24)   return `Hace ${diffH}h`
  if (diffD === 1)  return 'Ayer'
  return `Hace ${diffD} días`
}

const statusConfig: Record<SyncStatus, { color: string; pulse: boolean; label: string }> = {
  success: { color: '#3A9E6A', pulse: false, label: 'Sincronizado' },
  error:   { color: '#C0392B', pulse: false, label: 'Error' },
  running: { color: '#0099f2', pulse: true,  label: 'Sincronizando…' },
}

export function SyncIndicator({ lastSync, status, label }: SyncIndicatorProps) {
  const cfg = statusConfig[status]

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex items-center justify-center w-2.5 h-2.5">
        {cfg.pulse && (
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping"
            style={{ background: cfg.color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full w-2 h-2"
          style={{ background: cfg.color }}
        />
      </span>
      <span style={{ color: cfg.color }} className="font-semibold text-xs">
        {label ?? cfg.label}
      </span>
      <span className="text-xs" style={{ color: '#b2b2b2' }}>
        · {formatRelative(lastSync)}
      </span>
    </div>
  )
}
