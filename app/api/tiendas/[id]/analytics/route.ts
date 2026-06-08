import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { TiendaTendencia, TiendaFamilia, TiendaMetal, TiendaTopProducto } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { id } = params

  // 1. Fetch tienda by id
  const { data: tienda, error: tiendaError } = await supabase
    .from('tiendas')
    .select('id, nombre, nombre_corto, zona, tipo, cluster, isla, activo, es_almacen')
    .eq('id', id)
    .single()

  if (tiendaError || !tienda) {
    return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
  }

  // 2. Call 4 RPC functions in parallel using tienda.nombre (join key for ventas_mensuales)
  const nombre = tienda.nombre

  const [tendenciaRes, familiasRes, metalesRes, topProductosRes] = await Promise.all([
    supabase.rpc('tienda_tendencia',      { p_tienda: nombre }),
    supabase.rpc('tienda_familias',       { p_tienda: nombre }),
    supabase.rpc('tienda_metales',        { p_tienda: nombre }),
    supabase.rpc('tienda_top_productos',  { p_tienda: nombre, p_limit: 15 }),
  ])

  if (tendenciaRes.error)     console.error('tienda_tendencia error:', tendenciaRes.error)
  if (familiasRes.error)      console.error('tienda_familias error:', familiasRes.error)
  if (metalesRes.error)       console.error('tienda_metales error:', metalesRes.error)
  if (topProductosRes.error)  console.error('tienda_top_productos error:', topProductosRes.error)

  return NextResponse.json({
    tienda,
    tendencia:    (tendenciaRes.data   ?? []) as TiendaTendencia[],
    familias:     (familiasRes.data    ?? []) as TiendaFamilia[],
    metales:      (metalesRes.data     ?? []) as TiendaMetal[],
    topProductos: (topProductosRes.data ?? []) as TiendaTopProducto[],
  })
}
