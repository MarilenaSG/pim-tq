import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { SyncPanel } from './SyncPanel'
import type { SyncLog } from '@/types'

async function getSyncData() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  const logs = (data ?? []) as SyncLog[]
  const lastMetabaseSync = logs.find(l => l.source === 'metabase' && l.status !== 'running') ?? null
  const lastVentasSync   = logs.find(l => l.source === 'ventas'   && l.status !== 'running') ?? null
  const lastReservasSync = logs.find(l => l.source === 'reservas' && l.status !== 'running') ?? null

  return { logs, lastMetabaseSync, lastVentasSync, lastReservasSync }
}

export default async function SyncPage() {
  const { logs, lastMetabaseSync, lastVentasSync, lastReservasSync } = await getSyncData()

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Configuración"
        title="Sincronización"
        subtitle="Importa datos de Metabase hacia el PIM"
      />

      <Suspense>
        <SyncPanel
          lastMetabaseSync={lastMetabaseSync}
          lastVentasSync={lastVentasSync}
          lastReservasSync={lastReservasSync}
          recentLogs={logs}
        />
      </Suspense>
    </div>
  )
}
