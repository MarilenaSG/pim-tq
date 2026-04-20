import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { FieldsPanel } from './FieldsPanel'
import type { CustomFieldDefinition } from '@/types'

export default async function FieldsPage() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .order('created_at', { ascending: false })

  const fields = (data ?? []) as CustomFieldDefinition[]

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Configuración"
        title="Campos del equipo"
        subtitle="Define los campos propios que el equipo puede rellenar en cada ficha de producto"
      />
      <FieldsPanel fields={fields} />
    </div>
  )
}
