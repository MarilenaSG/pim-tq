import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('products')
      .select('codigo_modelo')
      .order('familia', { ascending: true, nullsFirst: false })
      .order('codigo_modelo', { ascending: true })

    if (error) throw new Error(error.message)

    const codes = (data ?? []).map(r => r.codigo_modelo as string)

    const header = 'codigo_modelo,campo_1,campo_2,campo_3'
    const rows   = codes.map(c => `${c},,, `)
    const csv    = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plantilla-campos-TQ.csv"',
      },
    })
  } catch (err) {
    console.error('[export/csv-template]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
