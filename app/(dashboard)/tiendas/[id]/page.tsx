import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TiendaDetailClient } from './TiendaDetailClient'
import type { Tienda, TiendaTendencia, TiendaFamilia, TiendaMetal, TiendaTopPorMetal } from '@/types'

interface Props {
  params: { id: string }
}

export default async function TiendaPage({ params }: Props) {
  const supabase = createServerClient()
  const { id } = params

  // 1. Fetch tienda by id
  const { data: tienda, error: tiendaError } = await supabase
    .from('tiendas')
    .select('id, nombre, nombre_corto, zona, tipo, cluster, isla, activo, es_almacen, created_at')
    .eq('id', id)
    .single()

  if (tiendaError || !tienda) {
    notFound()
  }

  const t = tienda as Tienda
  const nombre = t.nombre

  // 2. Call all RPC functions in parallel
  const [tendenciaRes, familiasRes, metalesRes, topOroRes, topPlataRes] = await Promise.all([
    supabase.rpc('tienda_tendencia',      { p_tienda: nombre }),
    supabase.rpc('tienda_familias',       { p_tienda: nombre }),
    supabase.rpc('tienda_metales',        { p_tienda: nombre }),
    supabase.rpc('tienda_top_por_metal',  { p_tienda: nombre, p_metal: 'Oro',   p_limit: 10 }),
    supabase.rpc('tienda_top_por_metal',  { p_tienda: nombre, p_metal: 'Plata', p_limit: 10 }),
  ])

  return (
    <TiendaDetailClient
      tienda={t}
      tendencia={(tendenciaRes.data  ?? []) as TiendaTendencia[]}
      familias={(familiasRes.data    ?? []) as TiendaFamilia[]}
      metales={(metalesRes.data      ?? []) as TiendaMetal[]}
      topOro={(topOroRes.data        ?? []) as TiendaTopPorMetal[]}
      topPlata={(topPlataRes.data    ?? []) as TiendaTopPorMetal[]}
    />
  )
}
