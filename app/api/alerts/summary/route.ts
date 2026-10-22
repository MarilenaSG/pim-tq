import { NextResponse } from 'next/server'
import { fetchAlerts, summarizeAlerts } from '@/lib/alerts'

// Sin esto Next 14 genera la respuesta una sola vez en el build y la sirve congelada
export const dynamic = 'force-dynamic'

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
      byCategory: { stock: 0, sin_venta: 0, familias_sin_new: 0 },
    })
  }
}
