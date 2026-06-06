'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { syncMetabase } from '@/lib/metabase'
import { syncVentas } from '@/lib/ventas'
import { syncReservas } from '@/lib/reservas'

export interface SyncActionResult {
  ok: boolean
  modelsUpserted?: number
  variantsUpserted?: number
  imagesUpserted?: number
  rowsUpserted?: number
  rowsInserted?: number
  errors?: string[]
  error?: string
}

async function withSyncLog(
  supabase: ReturnType<typeof createServiceClient>,
  source: string,
  fn: () => Promise<SyncActionResult>
): Promise<SyncActionResult> {
  const { data: logEntry } = await supabase
    .from('sync_log')
    .insert({ source, status: 'running', triggered_by: 'manual', started_at: new Date().toISOString() })
    .select('id')
    .single()
  const logId = logEntry?.id

  try {
    const result = await fn()
    const records =
      (result.modelsUpserted ?? 0) + (result.variantsUpserted ?? 0) +
      (result.imagesUpserted ?? 0) + (result.rowsUpserted ?? 0) + (result.rowsInserted ?? 0)

    if (logId) {
      await supabase.from('sync_log').update({
        status:          result.ok ? 'success' : 'error',
        records_updated: records,
        error_message:   result.errors?.length ? result.errors.join('\n') : result.error ?? null,
        finished_at:     new Date().toISOString(),
      }).eq('id', logId)
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (logId) {
      await supabase.from('sync_log').update({
        status: 'error', error_message: message, finished_at: new Date().toISOString(),
      }).eq('id', logId)
    }
    return { ok: false, error: message }
  }
}

export async function triggerMetabaseSync(): Promise<SyncActionResult> {
  const supabase = createServiceClient()
  return withSyncLog(supabase, 'metabase', async () => {
    const result = await syncMetabase()
    return {
      ok:               result.errors.length === 0,
      modelsUpserted:   result.modelsUpserted,
      variantsUpserted: result.variantsUpserted,
      imagesUpserted:   result.imagesUpserted,
      errors:           result.errors,
    }
  })
}

export async function triggerVentasSync(): Promise<SyncActionResult> {
  const supabase = createServiceClient()
  return withSyncLog(supabase, 'ventas', async () => {
    const result = await syncVentas()
    return {
      ok:           result.errors.length === 0,
      rowsUpserted: result.rowsUpserted,
      errors:       result.errors,
    }
  })
}

export async function triggerReservasSync(): Promise<SyncActionResult> {
  const supabase = createServiceClient()
  return withSyncLog(supabase, 'reservas', async () => {
    const result = await syncReservas()
    return {
      ok:           result.errors.length === 0,
      rowsInserted: result.rowsInserted,
      errors:       result.errors,
    }
  })
}
