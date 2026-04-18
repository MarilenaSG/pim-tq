import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold tracking-widest uppercase text-tq-sky mb-1">
            {eyebrow}
          </p>
        )}
        <h1
          className="text-3xl font-bold text-tq-snorkel leading-tight"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[color-mix(in_srgb,#00557f_65%,#fff)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div>
      )}
    </div>
  )
}
