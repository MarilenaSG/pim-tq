import { createServiceClient } from '@/lib/supabase/server'
import type { AlertItem, AlertCategory } from '@/types'

// < 2 unidades por tienda × 19 puntos de venta
const UMBRAL_STOCK_A = 38
const HACE_6_MESES = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d
}

function makeId(cat: string, key: string) {
  return `${cat}:${key}`
}

export async function fetchAlerts(category?: AlertCategory | null): Promise<AlertItem[]> {
  const supabase = createServiceClient()
  const alerts: AlertItem[] = []
  const hace6Meses = HACE_6_MESES()

  // ── 1. Stock crítico: ABC-A con total < 38 uds ───────────────
  if (!category || category === 'stock') {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('codigo_modelo, stock_variante')
      .eq('abc_ventas', 'A')
      .eq('is_discontinued', false)

    const stockByModel: Record<string, number> = {}
    for (const v of variants ?? []) {
      if (!v.codigo_modelo) continue
      stockByModel[v.codigo_modelo] = (stockByModel[v.codigo_modelo] ?? 0) + (v.stock_variante ?? 0)
    }

    const lowStock = Object.entries(stockByModel).filter(([, s]) => s < UMBRAL_STOCK_A)

    if (lowStock.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('codigo_modelo, description')
        .eq('is_discontinued', false)
        .in('codigo_modelo', lowStock.map(([m]) => m))
      const descMap = Object.fromEntries((prods ?? []).map(p => [p.codigo_modelo, p.description]))

      for (const [modelo, stock] of lowStock) {
        alerts.push({
          id: makeId('stock', modelo),
          categoria: 'stock',
          severidad: 'critica',
          titulo: `${descMap[modelo] ?? modelo} — ${stock} ud${stock !== 1 ? 's' : ''} en stock (ABC-A, umbral ${UMBRAL_STOCK_A})`,
          codigo_modelo: modelo,
          descripcion: descMap[modelo] ?? null,
          href_accion: `/products/${modelo}?tab=variantes`,
          campo_problema: 'stock',
        })
      }
    }
  }

  // ── 2. Sin ventas en +6 meses ────────────────────────────────
  if (!category || category === 'sin_venta') {
    const { data: prods } = await supabase
      .from('products')
      .select('codigo_modelo, description, primera_entrada, ingresos_modelo_12m, is_discontinued')
      .eq('is_discontinued', false)
      .lt('primera_entrada', hace6Meses.toISOString().slice(0, 10))

    for (const p of prods ?? []) {
      const sinVentas = !p.ingresos_modelo_12m || p.ingresos_modelo_12m === 0
      if (!sinVentas) continue
      alerts.push({
        id: makeId('sin_venta', p.codigo_modelo),
        categoria: 'sin_venta',
        severidad: 'critica',
        titulo: `${p.description ?? p.codigo_modelo} — sin ventas en los últimos 12 meses`,
        codigo_modelo: p.codigo_modelo,
        descripcion: p.description ?? null,
        href_accion: `/products/${p.codigo_modelo}`,
        campo_problema: 'ingresos_modelo_12m',
      })
    }
  }

  // ── 3. Familias sin producto nuevo en 6 meses ────────────────
  if (!category || category === 'familias_sin_new') {
    const { data: prods } = await supabase
      .from('products')
      .select('familia, primera_entrada')
      .eq('is_discontinued', false)
      .not('familia', 'is', null)
      .not('primera_entrada', 'is', null)

    // Max primera_entrada por familia
    const maxByFamilia: Record<string, Date> = {}
    for (const p of prods ?? []) {
      if (!p.familia || !p.primera_entrada) continue
      const d = new Date(p.primera_entrada)
      if (!maxByFamilia[p.familia] || d > maxByFamilia[p.familia]) {
        maxByFamilia[p.familia] = d
      }
    }

    const now = new Date()
    for (const [familia, lastDate] of Object.entries(maxByFamilia)) {
      if (lastDate >= hace6Meses) continue
      const mesesAtras = Math.round((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
      alerts.push({
        id: makeId('familias_sin_new', familia),
        categoria: 'familias_sin_new',
        severidad: 'media',
        titulo: `Familia "${familia}" — sin incorporación nueva desde hace ${mesesAtras} meses`,
        codigo_modelo: null,
        descripcion: null,
        href_accion: `/products?familia=${encodeURIComponent(familia)}`,
        campo_problema: 'primera_entrada',
      })
    }
  }

  // ── 4. En catálogo pero inactivo en Shopify ──────────────────
  if (!category || category === 'shopify_inactivo') {
    const [catalogRes, shopifyRes] = await Promise.all([
      supabase.from('products').select('codigo_modelo, description').eq('is_discontinued', false),
      supabase.from('product_shopify_data').select('codigo_modelo, shopify_status'),
    ])

    const shopifyMap = Object.fromEntries(
      (shopifyRes.data ?? []).map(r => [r.codigo_modelo, r.shopify_status])
    )

    for (const p of catalogRes.data ?? []) {
      const status = shopifyMap[p.codigo_modelo]
      if (!status || status === 'active') continue
      alerts.push({
        id: makeId('shopify_inactivo', p.codigo_modelo),
        categoria: 'shopify_inactivo',
        severidad: 'media',
        titulo: `${p.description ?? p.codigo_modelo} — en catálogo pero "${status}" en Shopify`,
        codigo_modelo: p.codigo_modelo,
        descripcion: p.description ?? null,
        href_accion: `/products/${p.codigo_modelo}?tab=shopify`,
        campo_problema: 'shopify_status',
      })
    }
  }

  return alerts
}

export function summarizeAlerts(alerts: AlertItem[]) {
  const count = (cat: AlertCategory) => alerts.filter(a => a.categoria === cat).length
  return {
    total:    alerts.length,
    criticas: alerts.filter(a => a.severidad === 'critica').length,
    medias:   alerts.filter(a => a.severidad === 'media').length,
    byCategory: {
      stock:             count('stock'),
      sin_venta:         count('sin_venta'),
      familias_sin_new:  count('familias_sin_new'),
      shopify_inactivo:  count('shopify_inactivo'),
    },
  }
}
