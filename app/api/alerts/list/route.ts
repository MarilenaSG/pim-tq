import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AlertItem, AlertCategory } from '@/types'

function makeId(cat: string, key: string) {
  return `${cat}:${key}`
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') as AlertCategory | null

  try {
    const supabase = createServiceClient()

    const { data: settingsData } = await supabase.from('alert_settings').select('key, value')
    const settings = Object.fromEntries((settingsData ?? []).map(s => [s.key, s.value]))
    const umbralA = parseInt(settings['umbral_stock_abc_a'] ?? '5', 10)

    const alerts: AlertItem[] = []
    const now = new Date()
    const hace6Meses = new Date(now)
    hace6Meses.setMonth(hace6Meses.getMonth() - 6)

    // ── Stock crítico ──────────────────────────────────────────
    if (!category || category === 'stock') {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('codigo_modelo, stock_variante, abc_ventas')
        .eq('abc_ventas', 'A')

      // Aggregate stock by model
      const stockByModel: Record<string, number> = {}
      for (const v of variants ?? []) {
        if (!v.codigo_modelo) continue
        stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
      }

      const lowStockModels = Object.entries(stockByModel).filter(([, s]) => s < umbralA)

      if (lowStockModels.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('codigo_modelo, description')
          .in('codigo_modelo', lowStockModels.map(([m]) => m))

        const descMap = Object.fromEntries((products ?? []).map(p => [p.codigo_modelo, p.description]))

        for (const [modelo, stock] of lowStockModels) {
          alerts.push({
            id: makeId('stock', modelo),
            categoria: 'stock',
            severidad: 'critica',
            titulo: `"${descMap[modelo] ?? modelo}" (ABC-A) — solo ${stock} unidad${stock !== 1 ? 'es' : ''} en stock`,
            codigo_modelo: modelo,
            descripcion: descMap[modelo] ?? null,
            href_accion: `/products/${modelo}?tab=variantes`,
            campo_problema: 'stock',
          })
        }
      }
    }

    // ── Fichas incompletas ─────────────────────────────────────
    if (!category || category === 'fichas') {
      const [imagesRes, shopifyRes] = await Promise.all([
        supabase
          .from('product_images')
          .select('codigo_modelo')
          .eq('is_primary', true),
        supabase
          .from('product_shopify_data')
          .select('codigo_modelo, shopify_description, shopify_seo_title'),
      ])

      const withPrimary = new Set((imagesRes.data ?? []).map(r => r.codigo_modelo))
      const shopifyMap = Object.fromEntries(
        (shopifyRes.data ?? []).map(r => [r.codigo_modelo, r])
      )

      const { data: products } = await supabase
        .from('products')
        .select('codigo_modelo, description, category, abc_ventas')

      for (const p of products ?? []) {
        const shopify = shopifyMap[p.codigo_modelo]

        if (!withPrimary.has(p.codigo_modelo)) {
          alerts.push({
            id: makeId('fichas', `${p.codigo_modelo}:img`),
            categoria: 'fichas',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" — sin imagen primaria`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}?tab=imagenes`,
            campo_problema: 'imagen',
          })
        }

        if (!shopify && p.category !== 'OUTLET') {
          alerts.push({
            id: makeId('fichas', `${p.codigo_modelo}:noshopify`),
            categoria: 'fichas',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" — sin datos de Shopify`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}?tab=shopify`,
            campo_problema: 'shopify_desc',
          })
        } else if (shopify && !shopify.shopify_description && p.category !== 'OUTLET') {
          alerts.push({
            id: makeId('fichas', `${p.codigo_modelo}:nodesc`),
            categoria: 'fichas',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" — sin descripción Shopify`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}?tab=shopify`,
            campo_problema: 'shopify_desc',
          })
        }

        if (p.abc_ventas === 'A' && shopify && !shopify.shopify_seo_title) {
          alerts.push({
            id: makeId('fichas', `${p.codigo_modelo}:noseo`),
            categoria: 'fichas',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" (ABC-A) — sin título SEO`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}?tab=shopify`,
            campo_problema: 'seo_title',
          })
        }
      }
    }

    // ── Anomalías de ciclo de vida ─────────────────────────────
    if (!category || category === 'ciclo_vida') {
      const { data: products } = await supabase
        .from('products')
        .select('codigo_modelo, description, category, abc_ventas, primera_entrada, metabase_synced_at')

      for (const p of products ?? []) {
        if (p.abc_ventas === 'A' && p.category === 'TO_BE_DISCONTINUED') {
          alerts.push({
            id: makeId('ciclo_vida', `${p.codigo_modelo}:disc`),
            categoria: 'ciclo_vida',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" es ABC-A pero está marcado para discontinuar`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}`,
            campo_problema: null,
          })
        }

        if (
          p.category === 'NEW' &&
          p.primera_entrada &&
          new Date(p.primera_entrada) < hace6Meses &&
          p.abc_ventas === 'C'
        ) {
          alerts.push({
            id: makeId('ciclo_vida', `${p.codigo_modelo}:new`),
            categoria: 'ciclo_vida',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" lleva +6 meses como NEW sin rendir (ABC-C)`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}`,
            campo_problema: null,
          })
        }

        if (p.abc_ventas === null && p.metabase_synced_at !== null) {
          alerts.push({
            id: makeId('ciclo_vida', `${p.codigo_modelo}:noabc`),
            categoria: 'ciclo_vida',
            severidad: 'media',
            titulo: `"${p.description ?? p.codigo_modelo}" no tiene clasificación ABC tras el último sync`,
            codigo_modelo: p.codigo_modelo,
            descripcion: p.description ?? null,
            href_accion: `/products/${p.codigo_modelo}`,
            campo_problema: null,
          })
        }
      }
    }

    // ── Sync con errores ───────────────────────────────────────
    if (!category || category === 'sync') {
      const { data: logs } = await supabase
        .from('sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20)

      const hace48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
      const sources = ['metabase', 'shopify'] as const

      for (const source of sources) {
        const last = (logs ?? []).find(l => l.source === source && l.status !== 'running')
        if (!last) continue

        const isError = last.status === 'error'
        const isStale = new Date(last.started_at) < hace48h

        if (isError || isStale) {
          alerts.push({
            id: makeId('sync', source),
            categoria: 'sync',
            severidad: isError ? 'critica' : 'media',
            titulo: isError
              ? `Sync ${source} falló: ${last.error_message ?? 'error desconocido'}`
              : `Sync ${source} lleva más de 48h sin ejecutarse`,
            codigo_modelo: null,
            descripcion: null,
            href_accion: '/settings/sync',
            campo_problema: null,
          })
        }
      }
    }

    return NextResponse.json(alerts)
  } catch (err) {
    console.error('alerts/list error:', err)
    return NextResponse.json([])
  }
}
