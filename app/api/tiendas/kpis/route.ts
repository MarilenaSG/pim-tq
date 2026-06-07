import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { Tienda, TiendaKpi } from '@/types'

export interface TiendaWithKpi extends Tienda {
  kpi: TiendaKpi | null
}

export async function GET() {
  const supabase = createServerClient()

  // 1. Fetch active, non-almacen tiendas
  const { data: tiendas, error: tiendaError } = await supabase
    .from('tiendas')
    .select('id, nombre, nombre_corto, zona, tipo, cluster, isla, activo, es_almacen, created_at')
    .eq('activo', true)
    .eq('es_almacen', false)
    .order('nombre', { ascending: true })

  if (tiendaError) {
    console.error('tiendas fetch error:', tiendaError)
    return NextResponse.json({ error: 'Error fetching tiendas' }, { status: 500 })
  }

  // 2. Call tiendas_kpis_listing() RPC
  const { data: kpis, error: kpiError } = await supabase
    .rpc('tiendas_kpis_listing')

  if (kpiError) {
    console.error('tiendas_kpis_listing error:', kpiError)
    return NextResponse.json({ error: 'Error fetching KPIs' }, { status: 500 })
  }

  // 3. Join results by tienda.nombre === kpi.tienda_nombre
  const kpiMap = new Map<string, TiendaKpi>()
  for (const kpi of (kpis ?? []) as TiendaKpi[]) {
    kpiMap.set(kpi.tienda_nombre, kpi)
  }

  const result: TiendaWithKpi[] = ((tiendas ?? []) as Tienda[]).map(t => ({
    ...t,
    kpi: kpiMap.get(t.nombre) ?? null,
  }))

  return NextResponse.json(result)
}
