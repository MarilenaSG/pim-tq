import { NextRequest, NextResponse } from 'next/server'
import { fetchAlerts } from '@/lib/alerts'
import type { AlertCategory } from '@/types'

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') as AlertCategory | null
  try {
    const alerts = await fetchAlerts(category)
    return NextResponse.json(alerts)
  } catch (err) {
    console.error('alerts/list error:', err)
    return NextResponse.json([])
  }
}
