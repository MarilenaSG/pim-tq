import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import type { AlertItem, AlertCategory } from '@/types'

const CATEGORY_CONFIG: Record<AlertCategory, { label: string; icon: string; severityColor: string }> = {
  stock:      { label: 'Stock crítico',              icon: '⚠',  severityColor: '#C0392B' },
  fichas:     { label: 'Fichas incompletas',         icon: '◻',  severityColor: '#C8842A' },
  ciclo_vida: { label: 'Anomalías de ciclo de vida', icon: '↻',  severityColor: '#C8842A' },
  sync:       { label: 'Estado de sincronización',  icon: '⊕',  severityColor: '#C0392B' },
}

async function getAlerts(): Promise<AlertItem[]> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    const res = await fetch(`${base}/api/alerts/list`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { severidad?: string }
}) {
  const alerts = await getAlerts()
  const filterSev = searchParams.severidad ?? 'todas'

  const filtered = filterSev === 'todas'
    ? alerts
    : alerts.filter(a => a.severidad === filterSev)

  const byCategory = (cat: AlertCategory) => filtered.filter(a => a.categoria === cat)

  const total = alerts.length
  const criticas = alerts.filter(a => a.severidad === 'critica').length

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          eyebrow="Operativo"
          title="Alertas"
          subtitle={
            total === 0
              ? 'Sin alertas pendientes'
              : `${total} alerta${total !== 1 ? 's' : ''} activa${total !== 1 ? 's' : ''} · ${criticas} crítica${criticas !== 1 ? 's' : ''}`
          }
        />
        <a
          href="/alerts"
          className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
        >
          ↻ Actualizar
        </a>
      </div>

      {/* Severity filter */}
      <div className="flex gap-2">
        {[
          { key: 'todas',   label: 'Todas' },
          { key: 'critica', label: '🔴 Críticas' },
          { key: 'media',   label: '🟠 Medias' },
        ].map(f => (
          <Link
            key={f.key}
            href={f.key === 'todas' ? '/alerts' : `/alerts?severidad=${f.key}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: filterSev === f.key ? '#00557f' : 'rgba(0,85,127,0.06)',
              color:      filterSev === f.key ? '#fff'    : '#00557f',
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {total === 0 ? (
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ background: 'rgba(58,158,106,0.06)', border: '1px solid rgba(58,158,106,0.2)' }}
        >
          <div className="text-2xl mb-2">✓</div>
          <p className="font-semibold" style={{ color: '#2d7a54' }}>Sin alertas pendientes</p>
          <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>Todo el catálogo está en orden.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.keys(CATEGORY_CONFIG) as AlertCategory[]).map(cat => {
            const items = byCategory(cat)
            const cfg = CATEGORY_CONFIG[cat]
            return (
              <details key={cat} open={items.length > 0} className="group">
                <summary
                  className="flex items-center justify-between px-5 py-3 rounded-xl cursor-pointer list-none"
                  style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)' }}
                >
                  <span className="flex items-center gap-2.5 font-semibold text-sm text-tq-snorkel">
                    <span>{cfg.icon}</span>
                    {cfg.label}
                    {items.length > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${cfg.severityColor}15`, color: cfg.severityColor }}
                      >
                        {items.length}
                      </span>
                    )}
                  </span>
                  {items.length === 0 && (
                    <span className="text-xs font-medium" style={{ color: '#3A9E6A' }}>Sin alertas ✓</span>
                  )}
                  <span className="text-xs opacity-40 group-open:rotate-90 transition-transform">▶</span>
                </summary>

                {items.length > 0 && (
                  <div
                    className="mt-1 rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(0,85,127,0.08)' }}
                  >
                    {items.map((alert, i) => (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between gap-4 px-5 py-3 bg-white hover:bg-[rgba(0,85,127,0.02)] transition-colors"
                        style={{
                          borderBottom: i < items.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                        }}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                            style={{ background: alert.severidad === 'critica' ? '#C0392B' : '#C8842A' }}
                          />
                          <p className="text-sm text-tq-snorkel leading-snug">{alert.titulo}</p>
                        </div>
                        <Link
                          href={alert.href_accion}
                          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          style={{ background: 'rgba(0,153,242,0.08)', color: '#0099f2' }}
                        >
                          Ver →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
