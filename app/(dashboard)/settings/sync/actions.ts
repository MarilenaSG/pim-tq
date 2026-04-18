'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { syncMetabase } from '@/lib/metabase'

export interface SyncActionResult {
  ok: boolean
  modelsUpserted?: number
  variantsUpserted?: number
  imagesUpserted?: number
  errors?: string[]
  error?: string
}

export async function triggerMetabaseSync(): Promise<SyncActionResult> {
  const supabase = createServiceClient()

  const { data: logEntry } = await supabase
    .from('sync_log')
    .insert({
      source:       'metabase',
      status:       'running',
      triggered_by: 'manual',
      started_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  const logId = logEntry?.id

  try {
    const result = await syncMetabase()

    if (logId) {
      await supabase
        .from('sync_log')
        .update({
          status:          result.errors.length > 0 ? 'error' : 'success',
          records_updated: result.recordsUpdated,
          error_message:   result.errors.length > 0 ? result.errors.join('\n') : null,
          finished_at:     new Date().toISOString(),
        })
        .eq('id', logId)
    }

    return {
      ok:               result.errors.length === 0,
      modelsUpserted:   result.modelsUpserted,
      variantsUpserted: result.variantsUpserted,
      imagesUpserted:   result.imagesUpserted,
      errors:           result.errors,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (logId) {
      await supabase
        .from('sync_log')
        .update({
          status:        'error',
          error_message: message,
          finished_at:   new Date().toISOString(),
        })
        .eq('id', logId)
    }

    return { ok: false, error: message }
  }
}
