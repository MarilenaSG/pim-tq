import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncMetabase } from '@/lib/metabase'
import { syncShopify } from '@/lib/shopify'

export const maxDuration = 60

async function runSync(
  supabase: ReturnType<typeof createServiceClient>,
  source: 'metabase' | 'shopify',
  syncFn: () => Promise<{ errors: string[]; recordsUpdated?: number; shopifyDataUpserted?: number; imagesUpserted?: number }>
) {
  const { data: log } = await supabase
    .from('sync_log')
    .insert({ source, status: 'running', triggered_by: 'cron', started_at: new Date().toISOString() })
    .select('id')
    .single()

  try {
    const result = await syncFn()
    const records = result.recordsUpdated ??
      ((result.shopifyDataUpserted ?? 0) + (result.imagesUpserted ?? 0))

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

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-api-key')
  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Run syncs sequentially (Metabase first, then Shopify)
  const metabaseResult = await runSync(supabase, 'metabase', syncMetabase)
  const shopifyResult  = await runSync(supabase, 'shopify', syncShopify)

  return NextResponse.json({
    ok: true,
    results: { metabase: metabaseResult, shopify: shopifyResult },
  })
}
