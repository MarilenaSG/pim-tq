import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { KpiCard, SyncIndicator, StatusBadge } from '@/components/ui'
import type { SyncLog } from '@/types'

async function getDashboardData() {
  const supabase = createServerClient()

  const [
    productsResult,
    variantsResult,
    shopifyResult,
    imagesResult,
    abcAResult,
    syncLogsResult,
    revenueResult,
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('product_variants').select('*', { count: 'exact', head: true }),
    supabase.from('product_shopify_data').select('*', { count: 'exact', head: true }),
    supabase.from('product_images').select('codigo_modelo').eq('source', 'shopify'),
    supabase.from('products').select('codigo_modelo').eq('abc_ventas', 'A'),
    supabase.from('sync_log').select('*').order('started_at', { ascending: false }).limit(10),
    supabase.from('products').select('ingresos_12m'),
  ])

  const totalProducts = productsResult.count ?? 0
  const totalVariants = variantsResult.count ?? 0
  const totalShopify  = shopifyResult.count ?? 0
  const withShopifyImages = new Set((imagesResult.data ?? []).map(r => r.codigo_modelo)).size
  const sinImagenShopify  = Math.max(0, totalProducts - withShopifyImages)
  const abcACount     = abcAResult.data?.length ?? 0
  const sinShopify    = Math.max(0, totalProducts - totalShopify)

  const totalIngresos = (revenueResult.data ?? []).reduce(
    (acc, p) => acc + (Number(p.ingresos_12m) || 0), 0
  )

  const logs = (syncLogsResult.data ?? []) as SyncLog[]
  const lastMetabase = logs.find(l => l.source === 'metabase' && l.status !== 'running') ?? null
  const lastShopify  = logs.find(l => l.source === 'shopify'  && l.status !== 'running') ?? null

  return { totalProducts, totalVariants, totalShopify, sinImagenShopify, abcACount, sinShopify, totalIngresos, lastMetabase, lastShopify }
}

export default async function DashboardPage() {
  const {
    totalProducts, totalVariants, totalShopify, sinImagenShopify,
    abcACount, sinShopify, totalIngresos, lastMetabase, lastShopify,
  } = await getDashboardData()

  const shopifyPct       = totalProducts > 0 ? Math.round((totalShopify      / totalProducts) * 100) : 0
  const sinImagenPct     = totalProducts > 0 ? Math.round((sinImagenShopify  / totalProducts) * 100) : 0
  const abcAPct          = totalProducts > 0 ? Math.round((abcACount         / totalProducts) * 100) : 0

  const formatEur = (n: number) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-bold tracking-widest uppercase text-tq-sky mb-1">
          Te Quiero Joyerías
        </p>
        <h1
          className="text-4xl font-bold text-tq-snorkel mb-2"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Dashboard
        </h1>
        <p className="text-sm capitalize" style={{ color: 'color-mix(in srgb, #00557f 65%, #fff)' }}>
          {today}
        </p>
      </div>

      {/* KPI grid — catálogo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label="Modelos"
          value={totalProducts.toLocaleString('es-ES')}
          sub="referencias únicas"
          color="neutral"
          icon="◻"
        />
        <KpiCard
          label="Variantes"
          value={totalVariants.toLocaleString('es-ES')}
          sub="SKUs totales"
          color="blue"
          icon="◫"
        />
        <KpiCard
          label="Con Shopify"
          value={totalShopify.toLocaleString('es-ES')}
          sub={`${shopifyPct}% del catálogo`}
          color="green"
          icon="⊕"
        />
        <KpiCard
          label="Sin imagen Shopify"
          value={sinImagenShopify.toLocaleString('es-ES')}
          sub={`${sinImagenPct}% sin fotos del producto`}
          color={sinImagenShopify === 0 ? 'green' : 'red'}
          icon="◎"
        />
      </div>

      {/* KPI grid — negocio */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <KpiCard
          label="Ingresos 12m"
          value={formatEur(totalIngresos)}
          sub="suma de todos los modelos"
          color="green"
          icon="€"
        />
        <KpiCard
          label="Productos ABC A"
          value={abcACount.toLocaleString('es-ES')}
          sub={`top performers — ${abcAPct}% del catálogo`}
          color="amber"
          icon="★"
        />
      </div>

      {/* Sync status */}
      <h2 className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: '#00557f' }}>
        Estado de sincronización
      </h2>
      <div className="grid grid-cols-2 gap-4 mb-6">

        {/* Metabase */}
        <div className="tq-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-tq-snorkel">Metabase CSV</span>
            <StatusBadge
              status={!lastMetabase ? 'warn' : lastMetabase.status === 'success' ? 'ok' : 'error'}
              label={!lastMetabase ? 'Nunca' : lastMetabase.status === 'success' ? 'OK' : 'Error'}
              dot
            />
          </div>
          <SyncIndicator
            status={lastMetabase?.status === 'error' ? 'error' : 'success'}
            lastSync={lastMetabase?.finished_at ?? null}
            label={
              lastMetabase
                ? `${(lastMetabase.records_updated ?? 0).toLocaleString('es-ES')} registros`
                : 'Sin sincronizar'
            }
          />
          {lastMetabase?.error_message && (
            <p className="mt-2 text-xs line-clamp-2" style={{ color: '#C0392B' }}>
              {lastMetabase.error_message}
            </p>
          )}
          <div className="mt-3">
            <Link href="/settings/sync" className="text-xs font-semibold" style={{ color: '#0099f2' }}>
              Ir a sync →
            </Link>
          </div>
        </div>

        {/* Shopify */}
        <div className="tq-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-tq-snorkel">Shopify</span>
            <StatusBadge
              status={!lastShopify ? 'warn' : lastShopify.status === 'success' ? 'shopify' : 'error'}
              label={!lastShopify ? 'Nunca' : lastShopify.status === 'success' ? 'Shopify' : 'Error'}
              dot
            />
          </div>
          <SyncIndicator
            status={lastShopify?.status === 'error' ? 'error' : 'success'}
            lastSync={lastShopify?.finished_at ?? null}
            label={
              lastShopify
                ? `${(lastShopify.records_updated ?? 0).toLocaleString('es-ES')} registros`
                : 'Sin sincronizar'
            }
          />
          {lastShopify?.error_message && (
            <p className="mt-2 text-xs line-clamp-2" style={{ color: '#C0392B' }}>
              {lastShopify.error_message}
            </p>
          )}
          <div className="mt-3">
            <Link href="/settings/sync" className="text-xs font-semibold" style={{ color: '#0099f2' }}>
              Ir a sync →
            </Link>
          </div>
        </div>
      </div>

      {/* Alert: models without Shopify */}
      {sinShopify > 0 && (
        <div
          className="mb-6 rounded-xl px-5 py-4"
          style={{ background: 'rgba(200,132,42,0.07)', border: '1px solid rgba(200,132,42,0.25)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: '#a06818' }}>
            ⚠ {sinShopify.toLocaleString('es-ES')} modelo{sinShopify !== 1 ? 's' : ''} sin datos de Shopify
          </p>
          <p className="text-xs mb-3" style={{ color: '#b2b2b2' }}>
            Estos productos no tienen título, descripción ni imágenes de Shopify. Ejecuta un sync para completarlos.
          </p>
          <Link
            href="/settings/sync"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: '#C8842A', color: '#fff' }}
          >
            Sincronizar ahora →
          </Link>
        </div>
      )}

      {/* Quick nav */}
      <h2 className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: '#00557f' }}>
        Accesos rápidos
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/products',     label: 'Ver productos',    color: '#00557f' },
          { href: '/settings/sync', label: 'Sincronizar',    color: '#0099f2' },
          { href: '/catalog',      label: 'Catálogo público', color: '#C8842A' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: l.color }}
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  )
}
