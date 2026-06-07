import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { KpiCard, SyncIndicator, StatusBadge } from '@/components/ui'
import { ZoneCardsSection }    from '@/components/ui/ZoneCardsSection'
import { ZoneSummaryWidget }   from '@/components/ui/ZoneSummaryWidget'
import type { SyncLog } from '@/types'

async function getDashboardData() {
  const supabase = createServerClient()

  const [activeRes, varRes, syncRes, imgRes, discRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, ingresos_12m, abc_ventas', { count: 'exact' })
      .eq('is_discontinued', false),
    supabase
      .from('product_variants')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(6),
    supabase
      .from('product_images')
      .select('codigo_modelo', { count: 'exact', head: true })
      .eq('is_primary', true),
    supabase
      .from('products')
      .select('codigo_modelo')
      .eq('is_discontinued', true),
  ])

  const rows          = activeRes.data ?? []
  const total         = activeRes.count ?? 0
  const totalIngresos = rows.reduce((s, p) => s + (Number(p.ingresos_12m) || 0), 0)
  const abcACount     = rows.filter(p => p.abc_ventas === 'A').length
  const totalVariants = varRes.count ?? 0
  const sinImagen     = Math.max(0, total - (imgRes.count ?? 0))

  const logs         = (syncRes.data ?? []) as SyncLog[]
  const lastMetabase = logs.find(l => l.source === 'metabase' && l.status !== 'running') ?? null

  // Descatalogadas con stock: productos is_discontinued=true que aún tienen variantes con stock_variante > 0
  const discCodes = (discRes.data ?? []).map(p => p.codigo_modelo as string)
  let descatalogadasConStock = 0
  if (discCodes.length > 0) {
    const { data: withStock } = await supabase
      .from('product_variants')
      .select('codigo_modelo')
      .in('codigo_modelo', discCodes)
      .gt('stock_variante', 0)
    descatalogadasConStock = new Set((withStock ?? []).map(v => v.codigo_modelo as string)).size
  }

  return { total, totalVariants, abcACount, totalIngresos, lastMetabase, sinImagen, descatalogadasConStock }
}

export default async function DashboardPage() {
  const { total, totalVariants, abcACount, totalIngresos, lastMetabase, sinImagen, descatalogadasConStock } =
    await getDashboardData()

  const abcAPct   = total > 0 ? Math.round((abcACount / total) * 100) : 0
  const fmtEur    = (n: number) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="p-8 max-w-6xl">

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#0099f2' }}>
          Te Quiero Jewels
        </p>
        <h1 className="text-4xl font-bold text-[#00557f] mt-1 mb-1"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          Dashboard
        </h1>
        <p className="text-sm capitalize" style={{ color: 'color-mix(in srgb, #00557f 60%, #fff)' }}>
          {today}
        </p>
      </div>

      {/* Zone cards */}
      <ZoneCardsSection />

      {/* Zone-aware summary widget (client, reads localStorage) */}
      <ZoneSummaryWidget />

      {/* Catálogo KPIs */}
      <h2 className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: '#00557f' }}>
        Catálogo
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Modelos activos"
          value={total.toLocaleString('es-ES')}
          sub="referencias únicas"
          color="blue"
          icon="◻"
        />
        <KpiCard
          label="Variantes (SKU)"
          value={totalVariants.toLocaleString('es-ES')}
          sub="unidades de venta"
          color="neutral"
          icon="◫"
        />
        <KpiCard
          label="Ingresos 12m"
          value={fmtEur(totalIngresos)}
          sub="suma del catálogo activo"
          color="green"
          icon="€"
        />
        <KpiCard
          label="ABC-A"
          value={`${abcACount} (${abcAPct}%)`}
          sub="modelos top performers"
          color="amber"
          icon="★"
        />
      </div>

      {/* Alerta: descatalogadas con stock */}
      <div className="mb-6">
        <Link
          href="/products?lifecycle=descatalogado&con_stock=1"
          className="block tq-card p-4 border-l-4 hover:opacity-90 transition-opacity"
          style={{ borderLeftColor: descatalogadasConStock > 0 ? '#C0392B' : '#3A9E6A' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: descatalogadasConStock > 0 ? '#C0392B' : '#3A9E6A' }}
            >
              {descatalogadasConStock > 0 ? '!' : '✓'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: descatalogadasConStock > 0 ? '#C0392B' : '#3A9E6A' }}>
                {descatalogadasConStock > 0
                  ? `${descatalogadasConStock} referencia${descatalogadasConStock !== 1 ? 's' : ''} descatalogada${descatalogadasConStock !== 1 ? 's' : ''} con stock`
                  : 'Sin referencias descatalogadas con stock'}
              </p>
              <p className="text-xs text-[#888] mt-0.5">
                {descatalogadasConStock > 0
                  ? 'Capital inmovilizado en productos fuera de catálogo — revisar liquidación'
                  : 'Todo el stock está en productos activos'}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#0099f2] flex-shrink-0">Ver →</span>
          </div>
        </Link>
      </div>

      {/* Sync + Completitud row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Sync card */}
        <div className="tq-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#00557f]">Metabase CSV</span>
            <StatusBadge
              status={!lastMetabase ? 'warn' : lastMetabase.status === 'success' ? 'ok' : 'error'}
              label={!lastMetabase ? 'Nunca' : lastMetabase.status === 'success' ? 'OK' : 'Error'}
              dot
            />
          </div>
          <SyncIndicator
            status={lastMetabase?.status === 'error' ? 'error' : 'success'}
            lastSync={lastMetabase?.finished_at ?? null}
            label={lastMetabase
              ? `${(lastMetabase.records_updated ?? 0).toLocaleString('es-ES')} registros`
              : 'Sin sincronizar'}
          />
          {lastMetabase?.error_message && (
            <p className="mt-2 text-xs text-[#C0392B] line-clamp-2">{lastMetabase.error_message}</p>
          )}
          <Link href="/settings/sync" className="mt-3 inline-block text-xs font-semibold text-[#0099f2]">
            Gestionar sync →
          </Link>
        </div>

        {/* Completitud card */}
        <div className="tq-card p-5">
          <p className="text-sm font-semibold text-[#00557f] mb-3">Completitud del catálogo</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#555]">Con imagen primaria</span>
              <span className="text-xs font-bold text-[#3A9E6A]">
                {(total - sinImagen).toLocaleString('es-ES')} / {total.toLocaleString('es-ES')}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#f4f1ee] overflow-hidden">
              <div
                className="h-2 rounded-full bg-[#3A9E6A]"
                style={{ width: total > 0 ? `${Math.round(((total - sinImagen) / total) * 100)}%` : '0%' }}
              />
            </div>
            {sinImagen > 0 && (
              <p className="text-xs text-[#C8842A]">{sinImagen} modelos sin imagen primaria</p>
            )}
          </div>
          <Link href="/products?sin_imagen=1" className="mt-3 inline-block text-xs font-semibold text-[#0099f2]">
            Ver fichas incompletas →
          </Link>
        </div>
      </div>

      {/* Quick nav */}
      <h2 className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: '#00557f' }}>
        Accesos rápidos
      </h2>
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { href: '/products',            label: 'Productos',       bg: '#00557f' },
          { href: '/campaigns',           label: 'Campañas',        bg: '#C8842A' },
          { href: '/analytics/ciclo-vida',label: 'Ciclo de vida',   bg: '#2A5F9E' },
          { href: '/ventas',              label: 'Ventas',          bg: '#C8842A' },
          { href: '/stock',               label: 'Stock',           bg: '#3A9E6A' },
          { href: '/tiendas/boletin',     label: 'Boletín',         bg: '#8B5E1A' },
        ].map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-center py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: l.bg }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
