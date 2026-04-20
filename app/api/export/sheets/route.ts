import { NextRequest, NextResponse } from 'next/server'
import { exportToGoogleSheets } from '@/lib/google-sheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      metal?:             string
      familia?:           string
      category?:          string
      abc?:               string
      includeFinancials?: boolean
    }

    const result = await exportToGoogleSheets({
      metal:             body.metal      || undefined,
      familia:           body.familia    || undefined,
      category:          body.category   || undefined,
      abc:               body.abc        || undefined,
      includeFinancials: body.includeFinancials ?? false,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[export/sheets]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
