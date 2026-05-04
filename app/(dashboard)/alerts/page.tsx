import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { fetchAlerts, summarizeAlerts } from '@/lib/alerts'
import type { AlertItem, AlertCategory } from '@/types'

const CATEGORY_CONFIG: Record<AlertCategory, { label: string; icon: string; severityColor: string; severidad: 'critica' | 'media' }> = {
  stock:             { label: 'Stock crítico (ABC-A < 38 uds)',          icon: '⚠',  severityColor: '#C0392B', severidad: 'critica' },
  sin_venta:         { label: 'Sin ventas en +6 meses',                  icon: '⊘',  severityColor: '#C0392B', severidad: 'critica' },
  familias_sin_new:  { label: 'Familias sin incorporación nueva (+6 m)', icon: '↻',  severityColor: '#C8842A', severidad: 'media'   },
  shopify_inactivo:  { label: 'En catálogo pero inactivos en Shopify',   icon: '◻',  severityColor: '#C8842A', severidad: 'media'   },
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { severidad?: string }
}) {
  // Direct Supabase call — no self-fetch needed
  const all    = await fetchAlerts()
  const summary = summarizeAlerts(all)

  const filterSev = searchParams.severidad ?? 'todas'
  const filtered  = filterSev === 'todas' ? all : all.filter(a => a.severidad === filterSev)
  const byCategory = (cat: AlertCategory) => filtered.filter(a => a.categoria === cat)

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          eyebrow="Operativo"
          title="Alertas"
          subtitle={
            summary.total === 0
              ? 'Sin alertas pendientes'
              : `${summary.total} alerta${summary.total !== 1 ? 's' : ''} · ${summary.criticas} crítica${summary.criticas !== 1 ? 's' : ''} · ${summary.medias} media${summary.medias !== 1 ? 's' : ''}`
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
          { key: 'todas',   label: 'Todas',      count: summary.total    },
          { key: 'critica', label: '● Críticas',  count: summary.criticas },
          { key: 'media',   label: '● Medias',    count: summary.medias   },
        ].map(f => (
          <Link
            key={f.key}
            href={f.key === 'todas' ? '/alerts' : `/alerts?severidad=${f.key}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            style={{
              background: filterSev === f.key ? '#00557f' : 'rgba(0,85,127,0.06)',
              color:      filterSev === f.key ? '#fff'    : '#00557f',
            }}
          >
            {f.label}
            {f.count > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: filterSev === f.key ? 'rgba(255,255,255,0.25)' : 'rgba(0,85,127,0.1)',
                  color:      filterSev === f.key ? '#fff' : '#00557f',
                }}
              >
                {f.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ background: 'rgba(58,158,106,0.06)', border: '1px solid rgba(58,158,106,0.2)' }}
        >
          <div className="text-2xl mb-2">✓</div>
          <p className="font-semibold" style={{ color: '#2d7a54' }}>Sin alertas pendientes</p>
          <p className="text-sm mt-1" style={{ color: '#b2b2b2' }}>Todo el catálogo está en orden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(CATEGORY_CONFIG) as AlertCategory[]).map(cat => {
            const items = byCategory(cat)
            const cfg   = CATEGORY_CONFIG[cat]
            if (items.length === 0 && filterSev !== 'todas') return null
            return (
              <details key={cat} open={items.length > 0} className="group">
                <summary
                  className="flex items-center justify-between px-5 py-3 rounded-xl cursor-pointer list-none select-none"
                  style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)' }}
                >
                  <span className="flex items-center gap-2.5 font-semibold text-sm text-tq-snorkel">
                    <span>{cfg.icon}</span>
                    {cfg.label}
                    {items.length > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${cfg.severityColor}18`, color: cfg.severityColor }}
                      >
                        {items.length}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    {items.length === 0 && (
                      <span className="text-xs font-medium" style={{ color: '#3A9E6A' }}>Sin alertas ✓</span>
                    )}
                    <span className="text-xs opacity-40 group-open:rotate-90 transition-transform">▶</span>
                  </span>
                </summary>

                {items.length > 0 && (
                  <div
                    className="mt-1 rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(0,85,127,0.08)' }}
                  >
                    {items.map((alert, i) => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        color={cfg.severityColor}
                        last={i === items.length - 1}
                      />
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

function AlertRow({ alert, color, last }: { alert: AlertItem; color: string; last: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-3 bg-white hover:bg-[rgba(0,85,127,0.02)] transition-colors"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(0,85,127,0.05)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
          style={{ background: color }}
        />
        <p className="text-sm leading-snug" style={{ color: '#00557f' }}>
          {alert.titulo}
        </p>
      </div>
      <Link
        href={alert.href_accion}
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        style={{ background: 'rgba(0,85,127,0.07)', color: '#00557f' }}
      >
        Ver →
      </Link>
    </div>
  )
}
