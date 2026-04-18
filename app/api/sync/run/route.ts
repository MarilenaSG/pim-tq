import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncMetabase } from '@/lib/metabase'

export const maxDuration = 60

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-api-key')
  if (!key || key !== process.env.CRON_SECRET) {
    return unauthorized()
  }

  const supabase = createServiceClient()
  const results: Record<string, unknown> = {}

  // Metabase sync
  const { data: metabaseLog } = await supabase
    .from('sync_log')
    .insert({
      source:       'metabase',
      status:       'running',
      triggered_by: 'cron',
      started_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  try {
    const result = await syncMetabase()
    results.metabase = result

    if (metabaseLog?.id) {
      await supabase
        .from('sync_log')
        .update({
          status:          result.errors.length > 0 ? 'error' : 'success',
          records_updated: result.recordsUpdated,
          error_message:   result.errors.length > 0 ? result.errors.join('\n') : null,
          finished_at:     new Date().toISOString(),
        })
        .eq('id', metabaseLog.id)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    results.metabase = { error: message }

    if (metabaseLog?.id) {
      await supabase
        .from('sync_log')
        .update({
          status:        'error',
          error_message: message,
          finished_at:   new Date().toISOString(),
        })
        .eq('id', metabaseLog.id)
    }
  }

  // Shopify sync — implementado en Sesión 4
  results.shopify = { skipped: 'Pendiente Sesión 4' }

  return NextResponse.json({ ok: true, results })
}
