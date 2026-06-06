import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface StockSummary {
  // Totales globales
  total_unidades:       number
  total_modelos:        number   // modelos con stock > 0
  total_variantes:      number   // variantes con stock > 0
  modelos_sin_stock:    number   // modelos activos con stock = 0
  modelos_stock_bajo:   number   // stock_total entre 1 y 3

  // Capital inmovilizado (coste × stock, solo si hay coste)
  capital_inmovilizado: number | null

  // Cobertura media (días de stock = stock / (unidades_mes_anterior / 30))
  // Solo para variantes con ventas recientes
  cobertura_media_dias: number | null

  // Distribución de stock por categoría
  distribucion: { label: string; count: number; unidades: number; color: string }[]

  // Alertas de rotura (modelos activos sin stock o stock ≤ 2 con ventas recientes)
  alertas_rotura: {
    codigo_modelo: string
    description: string | null
    familia: string | null
    stock_total: number
    unidades_mes: number
    cobertura_dias: number | null
    imagen: string | null
  }[]

  // Modelos con exceso (stock alto y ventas bajas — posible sobrante)
  alertas_exceso: {
    codigo_modelo: string
    description: string | null
    familia: string | null
    stock_total: number
    unidades_mes: number
    cobertura_dias: number | null
    imagen: string | null
  }[]

  // Top 10 modelos por stock (capital inmovilizado)
  top_stock: {
    codigo_modelo: string
    description: string | null
    familia: string | null
    metal: string | null
    stock_total: number
    unidades_mes: number
    cobertura_dias: number | null
    precio_venta: number | null
    imagen: string | null
  }[]

  // Distribución por familia
  por_familia: { familia: string; stock: number; modelos: number; pct: number }[]
}

export async function GET() {
  const supabase = createServerClient()

  // ── Fetch variants con stock y datos de ventas ───────────────
  const { data: variants, error } = await supabase
    .from('product_variants')
    .select(`
      codigo_modelo, variante, stock_variante,
      unidades_mes_anterior, cost_price_medio, precio_venta,
      es_variante_lider
    `)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Fetch productos activos ───────────────────────────────────
  const { data: products } = await supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal, is_discontinued')
    .eq('is_discontinued', false)

  const activeSet = new Set((products ?? []).map(p => p.codigo_modelo as string))
  const prodMap   = Object.fromEntries(
    (products ?? []).map(p => [p.codigo_modelo, p])
  )

  // ── Fetch primary images ──────────────────────────────────────
  const { data: images } = await supabase
    .from('product_images')
    .select('codigo_modelo, url')
    .eq('is_primary', true)

  const imgMap = Object.fromEntries((images ?? []).map(i => [i.codigo_modelo as string, i.url as string]))

  // ── Aggregate by modelo ───────────────────────────────────────
  type ModelAgg = {
    stock:       number
    unidadesMes: number
    costeMedio:  number | null
    hasCoste:    boolean
    numVariantes: number
    precioVenta: number | null
  }

  const modelAgg = new Map<string, ModelAgg>()

  for (const v of variants ?? []) {
    const code = v.codigo_modelo as string
    if (!activeSet.has(code)) continue

    const stock  = v.stock_variante   ?? 0
    const uMes   = v.unidades_mes_anterior ?? 0
    const coste  = v.cost_price_medio as number | null

    const slot = modelAgg.get(code) ?? {
      stock: 0, unidadesMes: 0, costeMedio: null, hasCoste: false,
      numVariantes: 0, precioVenta: null,
    }

    slot.stock        += stock
    slot.unidadesMes  += uMes
    slot.numVariantes++

    if (coste != null) {
      slot.costeMedio = ((slot.costeMedio ?? 0) * (slot.hasCoste ? 1 : 0) + coste * stock) /
        ((slot.hasCoste ? slot.stock - stock : 0) + stock || 1)
      slot.hasCoste = true
    }

    if (v.es_variante_lider && v.precio_venta != null) {
      slot.precioVenta = v.precio_venta as number
    }

    modelAgg.set(code, slot)
  }

  // ── Compute global KPIs ───────────────────────────────────────
  let totalUnidades    = 0
  let totalModelos     = 0
  let totalVariantes   = 0
  let modelosSinStock  = 0
  let modelosStockBajo = 0
  let capitalInmov     = 0
  let hasCapital       = false
  let coberturaSum     = 0
  let coberturaCount   = 0

  for (const [code, agg] of Array.from(modelAgg.entries())) {
    if (!activeSet.has(code)) continue
    if (agg.stock > 0) {
      totalModelos++
      totalUnidades  += agg.stock
      totalVariantes += agg.numVariantes
    } else {
      modelosSinStock++
    }
    if (agg.stock > 0 && agg.stock <= 3) modelosStockBajo++

    if (agg.hasCoste && agg.costeMedio != null && agg.stock > 0) {
      capitalInmov += agg.costeMedio * agg.stock
      hasCapital = true
    }

    if (agg.stock > 0 && agg.unidadesMes > 0) {
      const dias = Math.round((agg.stock / agg.unidadesMes) * 30)
      coberturaSum += dias
      coberturaCount++
    }
  }

  // ── Distribución por nivel de stock ──────────────────────────
  let sinStock = 0, bajo = 0, medio = 0, alto = 0
  let unSinStock = 0, unBajo = 0, unMedio = 0, unAlto = 0

  for (const [, agg] of Array.from(modelAgg.entries())) {
    if (agg.stock === 0)        { sinStock++;  unSinStock += 0 }
    else if (agg.stock <= 3)    { bajo++;      unBajo     += agg.stock }
    else if (agg.stock <= 10)   { medio++;     unMedio    += agg.stock }
    else                        { alto++;      unAlto     += agg.stock }
  }

  const distribucion = [
    { label: 'Sin stock',       count: sinStock, unidades: unSinStock, color: '#C0392B' },
    { label: 'Stock bajo (≤3)', count: bajo,     unidades: unBajo,     color: '#C8842A' },
    { label: 'Stock normal',    count: medio,    unidades: unMedio,    color: '#3A9E6A' },
    { label: 'Stock alto (>10)',count: alto,      unidades: unAlto,     color: '#00557f' },
  ]

  // ── Alertas de rotura ─────────────────────────────────────────
  // Modelos con stock ≤ 2 Y ventas recientes (unidades_mes > 0)
  const alertas_rotura = Array.from(modelAgg.entries())
    .filter(([code, agg]) => activeSet.has(code) && agg.stock <= 2 && agg.unidadesMes > 0)
    .sort((a, b) => {
      // Priorizar por días de cobertura (más urgente primero)
      const da = a[1].unidadesMes > 0 ? (a[1].stock / a[1].unidadesMes) * 30 : 999
      const db = b[1].unidadesMes > 0 ? (b[1].stock / b[1].unidadesMes) * 30 : 999
      return da - db
    })
    .slice(0, 20)
    .map(([code, agg]) => {
      const coberturaDias = agg.unidadesMes > 0
        ? Math.round((agg.stock / agg.unidadesMes) * 30)
        : null
      return {
        codigo_modelo:  code,
        description:    prodMap[code]?.description ?? null,
        familia:        prodMap[code]?.familia ?? null,
        stock_total:    agg.stock,
        unidades_mes:   agg.unidadesMes,
        cobertura_dias: coberturaDias,
        imagen:         imgMap[code] ?? null,
      }
    })

  // ── Alertas de exceso ─────────────────────────────────────────
  // Stock > 10 unidades y ventas_mes < 1 (posible sobrante)
  const alertas_exceso = Array.from(modelAgg.entries())
    .filter(([code, agg]) => activeSet.has(code) && agg.stock > 10 && agg.unidadesMes === 0)
    .sort((a, b) => b[1].stock - a[1].stock)
    .slice(0, 15)
    .map(([code, agg]) => ({
      codigo_modelo:  code,
      description:    prodMap[code]?.description ?? null,
      familia:        prodMap[code]?.familia ?? null,
      stock_total:    agg.stock,
      unidades_mes:   agg.unidadesMes,
      cobertura_dias: null,
      imagen:         imgMap[code] ?? null,
    }))

  // ── Top 10 por volumen de stock ───────────────────────────────
  const top_stock = Array.from(modelAgg.entries())
    .filter(([code, agg]) => activeSet.has(code) && agg.stock > 0)
    .sort((a, b) => b[1].stock - a[1].stock)
    .slice(0, 10)
    .map(([code, agg]) => ({
      codigo_modelo:  code,
      description:    prodMap[code]?.description ?? null,
      familia:        prodMap[code]?.familia ?? null,
      metal:          (prodMap[code] as { metal?: string })?.metal ?? null,
      stock_total:    agg.stock,
      unidades_mes:   agg.unidadesMes,
      cobertura_dias: agg.unidadesMes > 0
        ? Math.round((agg.stock / agg.unidadesMes) * 30)
        : null,
      precio_venta:   agg.precioVenta,
      imagen:         imgMap[code] ?? null,
    }))

  // ── Por familia ───────────────────────────────────────────────
  const famMap = new Map<string, { stock: number; modelos: number }>()
  for (const [code, agg] of Array.from(modelAgg.entries())) {
    if (!activeSet.has(code) || agg.stock === 0) continue
    const fam = prodMap[code]?.familia ?? 'Sin familia'
    const slot = famMap.get(fam) ?? { stock: 0, modelos: 0 }
    slot.stock  += agg.stock
    slot.modelos++
    famMap.set(fam, slot)
  }

  const por_familia = Array.from(famMap.entries())
    .sort((a, b) => b[1].stock - a[1].stock)
    .slice(0, 8)
    .map(([familia, v]) => ({
      familia,
      stock:   v.stock,
      modelos: v.modelos,
      pct:     totalUnidades > 0 ? Math.round((v.stock / totalUnidades) * 1000) / 10 : 0,
    }))

  const summary: StockSummary = {
    total_unidades:       totalUnidades,
    total_modelos:        totalModelos,
    total_variantes:      totalVariantes,
    modelos_sin_stock:    modelosSinStock,
    modelos_stock_bajo:   modelosStockBajo,
    capital_inmovilizado: hasCapital ? Math.round(capitalInmov) : null,
    cobertura_media_dias: coberturaCount > 0 ? Math.round(coberturaSum / coberturaCount) : null,
    distribucion,
    alertas_rotura,
    alertas_exceso,
    top_stock,
    por_familia,
  }

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' },
  })
}
