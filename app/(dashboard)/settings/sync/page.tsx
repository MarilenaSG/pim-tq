import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { SyncPanel } from './SyncPanel'
import { getShopifyStatus } from './actions'
import type { SyncLog } from '@/types'

async function getSyncData() {
  const supabase = createServerClient()

  const [logsResult, shopifyStatus] = await Promise.all([
    supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20),
    getShopifyStatus(),
  ])

  const logs = (logsResult.data ?? []) as SyncLog[]
  const lastMetabaseSync = logs.find(l => l.source === 'metabase' && l.status !== 'running') ?? null
  const lastShopifySync  = logs.find(l => l.source === 'shopify'  && l.status !== 'running') ?? null
  const lastVentasSync   = logs.find(l => l.source === 'ventas'   && l.status !== 'running') ?? null
  const lastReservasSync = logs.find(l => l.source === 'reservas' && l.status !== 'running') ?? null

  return { logs, lastMetabaseSync, lastShopifySync, lastVentasSync, lastReservasSync, shopifyStatus }
}

export default async function SyncPage() {
  const { logs, lastMetabaseSync, lastShopifySync, lastVentasSync, lastReservasSync, shopifyStatus } = await getSyncData()

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Configuración"
        title="Sincronización"
        subtitle="Importa datos de Metabase y Shopify hacia el PIM"
      />

      <Suspense>
        <SyncPanel
          lastMetabaseSync={lastMetabaseSync}
          lastShopifySync={lastShopifySync}
          lastVentasSync={lastVentasSync}
          lastReservasSync={lastReservasSync}
          recentLogs={logs}
          shopifyConnected={shopifyStatus.connected}
          shopifyShop={shopifyStatus.shop}
        />
      </Suspense>
    </div>
  )
}
