import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { LanzamientoListado } from './LanzamientoListado'

export default async function LanzamientoPage() {
  const supabase = createServerClient()

  const [borrRes, confRes] = await Promise.all([
    supabase
      .from('lanzamientos')
      .select('id, tipo, nombre, familia, metal, precio_venta, paso_actual, created_at, updated_at')
      .eq('estado', 'borrador')
      .order('updated_at', { ascending: false }),
    supabase
      .from('lanzamientos')
      .select('id, tipo, nombre, familia, metal, precio_venta, n_tiendas, output_unidades_total, output_presupuesto_compra, output_margen_proyectado, output_breakeven_semanas, fecha_lanzamiento, updated_at')
      .eq('estado', 'confirmado')
      .gte('created_at', new Date(Date.now() - 180 * 86400 * 1000).toISOString())
      .order('updated_at', { ascending: false }),
  ])

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        eyebrow="Gestión"
        title="Lanzamientos"
        subtitle="Planifica la distribución, demanda y rentabilidad de nuevos productos"
      />
      <LanzamientoListado
        borradores={borrRes.data ?? []}
        confirmados={confRes.data ?? []}
      />
    </div>
  )
}
