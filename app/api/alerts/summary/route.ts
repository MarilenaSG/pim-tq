import { NextResponse } from 'next/server'
import { fetchAlerts, summarizeAlerts } from '@/lib/alerts'

export async function GET() {
  try {
    const alerts  = await fetchAlerts()
    const summary = summarizeAlerts(alerts)
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('alerts/summary error:', err)
    return NextResponse.json({
      total: 0, criticas: 0, medias: 0,
      byCategory: { stock: 0, sin_venta: 0, familias_sin_new: 0, shopify_inactivo: 0 },
    })
  }
}
