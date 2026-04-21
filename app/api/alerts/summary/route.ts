import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AlertSummary } from '@/types'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: settingsData } = await supabase.from('alert_settings').select('key, value')
    const settings = Object.fromEntries((settingsData ?? []).map(s => [s.key, s.value]))
    const umbralA = parseInt(settings['umbral_stock_abc_a'] ?? '5', 10)

    const now = new Date()
    const hace6Meses = new Date(now)
    hace6Meses.setMonth(hace6Meses.getMonth() - 6)
    const hace48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    // Run queries in parallel
    const [variantsRes, totalRes, primaryImgRes, cicloDiscRes, cicloNewRes, syncRes] =
      await Promise.all([
        supabase.from('product_variants').select('codigo_modelo, stock_variante').eq('abc_ventas', 'A'),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('product_images').select('*', { count: 'exact', head: true }).eq('is_primary', true),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('abc_ventas', 'A').eq('category', 'TO_BE_DISCONTINUED'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('category', 'NEW').lt('primera_entrada', hace6Meses.toISOString()).eq('abc_ventas', 'C'),
        supabase.from('sync_log').select('source, status, started_at').order('started_at', { ascending: false }).limit(10),
      ])

    // Stock alerts: aggregate by model
    const stockByModel: Record<string, number> = {}
    for (const v of variantsRes.data ?? []) {
      if (!v.codigo_modelo) continue
      stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
    }
    const stockAlerts = Object.values(stockByModel).filter(s => s < umbralA).length

    // Fichas alerts: products without primary image
    const totalProducts = totalRes.count ?? 0
    const withPrimary = primaryImgRes.count ?? 0
    const fichasAlerts = Math.max(0, totalProducts - withPrimary)

    // Ciclo de vida alerts
    const cicloAlerts = (cicloDiscRes.count ?? 0) + (cicloNewRes.count ?? 0)

    // Sync alerts
    const logs = syncRes.data ?? []
    let syncAlerts = 0
    for (const source of ['metabase', 'shopify'] as const) {
      const last = logs.find(l => l.source === source)
      if (!last) continue
      if (last.status === 'error' || new Date(last.started_at) < hace48h) syncAlerts++
    }

    const byCategory = { stock: stockAlerts, fichas: fichasAlerts, ciclo_vida: cicloAlerts, sync: syncAlerts }
    const summary: AlertSummary = {
      total: stockAlerts + fichasAlerts + cicloAlerts + syncAlerts,
      criticas: stockAlerts + syncAlerts,
      medias: fichasAlerts + cicloAlerts,
      byCategory,
    }

    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('alerts/summary error:', err)
    return NextResponse.json({ total: 0, criticas: 0, medias: 0, byCategory: { stock: 0, fichas: 0, ciclo_vida: 0, sync: 0 } })
  }
}
