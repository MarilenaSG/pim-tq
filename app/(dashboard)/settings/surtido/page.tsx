import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { SurtidoRefPanel } from './SurtidoRefPanel'
import type { RolCategoriaFamilia, Store } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SurtidoRefPage() {
  const supabase = createServerClient()

  const [{ data: roles }, { data: stores }] = await Promise.all([
    supabase.from('rol_categoria_familia').select('*').order('familia'),
    supabase.from('stores').select('*').order('ingresos_12m', { ascending: false }),
  ])

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Configuración"
        title="Ejes de surtido"
        subtitle="Tablas de referencia de la matriz de surtido — rol de categoría por familia y cluster de tienda"
      />
      <SurtidoRefPanel
        roles={(roles ?? []) as RolCategoriaFamilia[]}
        stores={(stores ?? []) as Store[]}
      />
    </div>
  )
}
