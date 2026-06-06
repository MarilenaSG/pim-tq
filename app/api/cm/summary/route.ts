import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface CMSummary {
  // Surtido
  total_modelos:       number
  total_familias:      number
  total_variantes:     number
  modelos_nuevos_60d:  number    // < 60 días en catálogo

  // Ventas
  ingresos_12m:        number
  modelos_abc_a:       number
  modelos_sin_ventas:  number    // sin abc, sin ingresos

  // Lifecycle
  activos:             number
  en_revision:         number
  a_discontinuar:      number
  descatalogados:      number    // is_discontinued = true

  // Alertas
  alertas_criticas:    number

  // Precio
  modelos_con_descuento: number
  descuento_medio:       number | null
}

export async function GET() {
  const supabase = createServerClient()

  const now     = new Date()
  const hace60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    productsRes,
    variantsRes,
    alertasRes,
    descuentosRes,
  ] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, familia, abc_ventas, ingresos_12m, primera_entrada, lifecycle_status, is_discontinued'),
    supabase
      .from('product_variants')
      .select('codigo_interno', { count: 'exact', head: true }),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('severidad', 'critica')
      .eq('activa', true),
    supabase
      .from('product_variants')
      .select('descuento_aplicado')
      .gt('descuento_aplicado', 0)
      .not('descuento_aplicado', 'is', null),
  ])

  const rows = productsRes.data ?? []

  const familias       = new Set(rows.map(r => r.familia as string).filter(Boolean))
  const modelos_nuevos = rows.filter(r => {
    const pe = r.primera_entrada as string | null
    return pe && pe >= hace60d
  }).length

  let activos = 0, en_revision = 0, a_discontinuar = 0
  let ingresos12m = 0, modelosAbcA = 0, modelosSinVentas = 0
  let discontinuados = 0

  for (const r of rows) {
    if (r.is_discontinued) { discontinuados++; continue }

    const ls = r.lifecycle_status as string | null
    if (ls === 'en_revision')    en_revision++
    else if (ls === 'a_discontinuar') a_discontinuar++
    else activos++

    ingresos12m += Number(r.ingresos_12m ?? 0)
    if (r.abc_ventas === 'A') modelosAbcA++
    if (!r.abc_ventas && !r.ingresos_12m) modelosSinVentas++
  }

  const descuentos = (descuentosRes.data ?? []).map(v => Number(v.descuento_aplicado))
  const descuentoMedio = descuentos.length > 0
    ? Math.round(descuentos.reduce((s, d) => s + d, 0) / descuentos.length * 10) / 10
    : null

  const summary: CMSummary = {
    total_modelos:        rows.filter(r => !r.is_discontinued).length,
    total_familias:       familias.size,
    total_variantes:      variantsRes.count ?? 0,
    modelos_nuevos_60d:   modelos_nuevos,
    ingresos_12m:         Math.round(ingresos12m),
    modelos_abc_a:        modelosAbcA,
    modelos_sin_ventas:   modelosSinVentas,
    activos,
    en_revision,
    a_discontinuar,
    descatalogados:       discontinuados,
    alertas_criticas:     alertasRes.count ?? 0,
    modelos_con_descuento: descuentos.length,
    descuento_medio:       descuentoMedio,
  }

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
