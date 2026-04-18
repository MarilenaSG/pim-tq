import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { SyncPanel } from './SyncPanel'
import type { SyncLog } from '@/types'

async function getSyncData(): Promise<{
  lastMetabaseSync: SyncLog | null
  recentLogs: SyncLog[]
}> {
  const supabase = createServerClient()

  const { data: logs } = await supabase
    .from('sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)

  if (!logs) return { lastMetabaseSync: null, recentLogs: [] }

  const lastMetabaseSync = (logs.find(l => l.source === 'metabase' && l.status !== 'running') ?? null) as SyncLog | null

  return {
    lastMetabaseSync,
    recentLogs: logs as SyncLog[],
  }
}

export default async function SyncPage() {
  const { lastMetabaseSync, recentLogs } = await getSyncData()

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Configuración"
        title="Sincronización"
        subtitle="Importa datos de Metabase y Shopify hacia el PIM"
      />

      <SyncPanel
        lastMetabaseSync={lastMetabaseSync}
        recentLogs={recentLogs}
      />
    </div>
  )
}
