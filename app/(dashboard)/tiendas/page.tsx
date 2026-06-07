import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader, KpiCard } from '@/components/ui'
import type { Tienda, TiendaKpi, TiendaCluster } from '@/types'

// ── Helpers ───────────────────────────────────────────────────

function fmtEuro(n: number) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

const CLUSTER_COLOR: Record<TiendaCluster, string> = {
  A: '#3A9E6A',
  B: '#0099f2',
  C: '#C8842A',
}

const CLUSTER_BG: Record<TiendaCluster, string> = {
  A: 'rgba(58,158,106,0.12)',
  B: 'rgba(0,153,242,0.12)',
  C: 'rgba(200,132,42,0.12)',
}

function ClusterBadge({ cluster }: { cluster: TiendaCluster | null }) {
  if (!cluster) return <span style={{ color: '#8fa8b8' }}>—</span>
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold"
      style={{ background: CLUSTER_BG[cluster], color: CLUSTER_COLOR[cluster] }}
    >
      {cluster}
    </span>
  )
}

function MbColor(mb: number | null): string {
  if (mb == null) return '#8fa8b8'
  if (mb >= 50) return '#3A9E6A'
  if (mb >= 40) return '#C8842A'
  return '#C0392B'
}

// ── Page ──────────────────────────────────────────────────────

export default async function TiendasPage() {
  const supabase = createServerClient()

  // Fetch active non-almacen tiendas
  const { data: rawTiendas } = await supabase
    .from('tiendas')
    .select('id, nombre, nombre_corto, zona, tipo, cluster, isla, activo, es_almacen, created_at')
    .eq('activo', true)
    .eq('es_almacen', false)
    .order('nombre', { ascending: true })

  // Fetch KPIs via RPC
  const { data: rawKpis } = await supabase.rpc('tiendas_kpis_listing')

  const tiendas = (rawTiendas ?? []) as Tienda[]
  const kpis    = (rawKpis    ?? []) as TiendaKpi[]

  // Join
  const kpiMap = new Map<string, TiendaKpi>()
  for (const k of kpis) kpiMap.set(k.tienda_nombre, k)

  type TiendaRow = Tienda & { kpi: TiendaKpi | null }
  const rows: TiendaRow[] = tiendas.map(t => ({ ...t, kpi: kpiMap.get(t.nombre) ?? null }))

  // Sort by ingresos DESC
  rows.sort((a, b) => (b.kpi?.ingresos_12m ?? 0) - (a.kpi?.ingresos_12m ?? 0))

  // Network-level KPIs
  const totalIngresos = rows.reduce((s, r) => s + (r.kpi?.ingresos_12m ?? 0), 0)
  const mbValues      = rows.map(r => r.kpi?.mb_pct).filter((v): v is number => v != null)
  const mbMedio       = mbValues.length > 0
    ? mbValues.reduce((a, b) => a + b, 0) / mbValues.length
    : null

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Red de tiendas"
        eyebrow="Tiendas"
        subtitle={`${tiendas.length} tiendas activas · últimos 12 meses`}
      />

      {/* KPI summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Ingresos red 12m"
          value={fmtEuro(totalIngresos)}
          color="blue"
          icon="€"
        />
        <KpiCard
          label="MB% medio"
          value={mbMedio != null ? `${mbMedio.toFixed(1)}%` : '—'}
          color={mbMedio != null && mbMedio >= 50 ? 'green' : mbMedio != null && mbMedio >= 40 ? 'amber' : 'neutral'}
          icon="▧"
        />
        <KpiCard
          label="Tiendas activas"
          value={String(tiendas.length)}
          color="neutral"
          icon="◫"
        />
      </div>

      {/* Tabla de tiendas */}
      <div className="tq-table-wrap">
        <table className="tq-table">
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Cluster</th>
              <th>Zona</th>
              <th>Isla</th>
              <th className="right">Ingresos 12m</th>
              <th className="right">MB%</th>
              <th className="right">Uds 12m</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const mb = row.kpi?.mb_pct ?? null
              return (
                <tr key={row.id} style={{ cursor: 'pointer' }}>
                  <td>
                    <Link
                      href={`/tiendas/${row.id}`}
                      className="block w-full"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      <span
                        className="font-medium"
                        style={{ color: '#00557f', fontSize: 13 }}
                      >
                        {row.nombre_corto ?? row.nombre}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <ClusterBadge cluster={row.cluster} />
                  </td>
                  <td style={{ color: '#5a7a8a' }}>{row.zona ?? '—'}</td>
                  <td style={{ color: '#5a7a8a' }}>{row.isla ?? '—'}</td>
                  <td className="text-right font-mono tabular-nums" style={{ color: '#00264d' }}>
                    {row.kpi ? fmtEuro(row.kpi.ingresos_12m) : '—'}
                  </td>
                  <td className="text-right font-semibold" style={{ color: MbColor(mb) }}>
                    {mb != null ? `${mb.toFixed(1)}%` : '—'}
                  </td>
                  <td className="text-right font-mono tabular-nums" style={{ color: '#5a7a8a' }}>
                    {row.kpi ? row.kpi.uds_12m.toLocaleString('es-ES') : '—'}
                  </td>
                  <td className="text-right" style={{ width: 32 }}>
                    <Link
                      href={`/tiendas/${row.id}`}
                      style={{ color: '#8fa8b8', textDecoration: 'none', fontSize: 16 }}
                      aria-label={`Ver ficha ${row.nombre}`}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ color: '#5a7a8a', fontWeight: 700 }}>Total red</td>
              <td className="text-right font-mono tabular-nums" style={{ color: '#00264d' }}>
                {fmtEuro(totalIngresos)}
              </td>
              <td className="text-right" style={{ color: MbColor(mbMedio) }}>
                {mbMedio != null ? `${mbMedio.toFixed(1)}%` : '—'}
              </td>
              <td className="text-right font-mono tabular-nums" style={{ color: '#5a7a8a' }}>
                {rows.reduce((s, r) => s + (r.kpi?.uds_12m ?? 0), 0).toLocaleString('es-ES')}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
