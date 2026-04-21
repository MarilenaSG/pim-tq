import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncReservas } from '@/lib/reservas'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-api-key')
  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: logEntry, error: logInsertErr } = await supabase
    .from('sync_log')
    .insert({ source: 'reservas', status: 'running', triggered_by: 'manual', started_at: new Date().toISOString() })
    .select('id')
    .single()

  if (logInsertErr || !logEntry) {
    return NextResponse.json({ error: `Error creando sync_log: ${logInsertErr?.message}` }, { status: 500 })
  }

  try {
    const result = await syncReservas()

    await supabase.from('sync_log').update({
      status:          result.errors.length > 0 ? 'error' : 'success',
      records_updated: result.rowsInserted,
      error_message:   result.errors.length > 0 ? result.errors.join('\n') : null,
      finished_at:     new Date().toISOString(),
    }).eq('id', logEntry.id)

    return NextResponse.json({ ok: true, rowsInserted: result.rowsInserted, errors: result.errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('sync_log').update({
      status: 'error', error_message: message, finished_at: new Date().toISOString(),
    }).eq('id', logEntry.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
