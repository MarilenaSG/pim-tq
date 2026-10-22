import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncMetabase } from '@/lib/metabase'
import { syncVentas } from '@/lib/ventas'
import { syncReservas } from '@/lib/reservas'
import { syncShopify } from '@/lib/shopify'

export const maxDuration = 60

async function runSync(
  supabase: ReturnType<typeof createServiceClient>,
  source: string,
  syncFn: () => Promise<{ errors: string[]; recordsUpdated?: number; modelsUpserted?: number; variantsUpserted?: number; imagesUpserted?: number; rowsUpserted?: number; rowsInserted?: number }>
) {
  const { data: log } = await supabase
    .from('sync_log')
    .insert({ source, status: 'running', triggered_by: 'cron', started_at: new Date().toISOString() })
    .select('id')
    .single()

  try {
    const result = await syncFn()
    const records = result.recordsUpdated ??
      (result.modelsUpserted ?? 0) + (result.variantsUpserted ?? 0) + (result.imagesUpserted ?? 0) +
      (result.rowsUpserted ?? 0) + (result.rowsInserted ?? 0)

    await supabase.from('sync_log').update({
      status:          result.errors.length > 0 ? 'error' : 'success',
      records_updated: records,
      error_message:   result.errors.length > 0 ? result.errors.join('\n') : null,
      finished_at:     new Date().toISOString(),
    }).eq('id', log?.id)

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('sync_log').update({
      status: 'error', error_message: message, finished_at: new Date().toISOString(),
    }).eq('id', log?.id)
    return { error: message, errors: [message] }
  }
}

// Una fuente por invocación: las cuatro seguidas superan los 60 s de maxDuration.
// vercel.json programa un cron por fuente (Metabase primero, el resto una hora después).
const SYNC_FNS = {
  metabase: syncMetabase,
  shopify:  syncShopify,
  ventas:   syncVentas,
  reservas: syncReservas,
} as const

type SyncSource = keyof typeof SYNC_FNS

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  // Vercel Cron envía GET con "Authorization: Bearer <CRON_SECRET>"
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true
  // Llamadas manuales con header x-api-key
  return req.headers.get('x-api-key') === secret
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = req.nextUrl.searchParams.get('source')
  if (!source || !(source in SYNC_FNS)) {
    return NextResponse.json(
      { error: `Parámetro "source" obligatorio: ${Object.keys(SYNC_FNS).join(' | ')}` },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()
  const result = await runSync(supabase, source, SYNC_FNS[source as SyncSource])

  return NextResponse.json(
    { ok: result.errors.length === 0, source, result },
    { status: result.errors.length === 0 ? 200 : 500 }
  )
}

export const GET  = handle
export const POST = handle
