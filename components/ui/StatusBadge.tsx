import { StatusVariant } from '@/types'

interface StatusBadgeProps {
  status: StatusVariant
  label?: string
  dot?: boolean
}

const variantMap: Record<StatusVariant, { bg: string; text: string; label: string }> = {
  ok:      { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54', label: 'OK' },
  warn:    { bg: 'rgba(200,132,42,0.12)',  text: '#a06818', label: 'Atención' },
  error:   { bg: 'rgba(192,57,43,0.12)',   text: '#992d22', label: 'Error' },
  info:    { bg: 'rgba(0,153,242,0.12)',   text: '#007acc', label: 'Info' },
  shopify:      { bg: 'rgba(150,191,71,0.15)',  text: '#4a7c1c', label: 'Shopify' },
  imagen:       { bg: 'rgba(200,161,100,0.15)', text: '#8a6020', label: 'Imagen' },
  discontinued: { bg: 'rgba(100,100,100,0.12)', text: '#555555', label: 'Descatalogado' },
  liquidacion:  { bg: 'rgba(192,57,43,0.08)',   text: '#8b2018', label: 'Próx. descatalogado' },
}

const dotColor: Record<StatusVariant, string> = {
  ok:      '#3A9E6A',
  warn:    '#C8842A',
  error:   '#C0392B',
  info:    '#0099f2',
  shopify:      '#6fa830',
  imagen:       '#c8a164',
  discontinued: '#888888',
  liquidacion:  '#C0392B',
}

export function StatusBadge({ status, label, dot = false }: StatusBadgeProps) {
  const v = variantMap[status]
  const displayLabel = label ?? v.label

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase"
      style={{ background: v.bg, color: v.text }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: dotColor[status] }}
        />
      )}
      {displayLabel}
    </span>
  )
}
