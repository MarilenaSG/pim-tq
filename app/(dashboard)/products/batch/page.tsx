import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { BatchCustomFieldsTable } from './BatchCustomFieldsTable'
import type { CustomFieldDefinition } from '@/types'

export const dynamic = 'force-dynamic'

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr)).filter(Boolean).sort() as T[]
}

export default async function BatchCustomFieldsPage() {
  const supabase = createServerClient()

  const [fieldDefsRes, productsRes] = await Promise.all([
    supabase
      .from('custom_field_definitions')
      .select('id, field_key, label, field_type, options, is_active, created_at')
      .eq('is_active', true)
      .order('field_key'),
    supabase
      .from('products')
      .select('codigo_modelo, description, supplier_name, metal, familia, category, is_discontinued')
      .order('codigo_modelo'),
  ])

  const fieldDefs = (fieldDefsRes.data ?? []) as CustomFieldDefinition[]
  const products  = productsRes.data ?? []
  const codes     = products.map(p => p.codigo_modelo)

  const { data: customFields } = codes.length
    ? await supabase
        .from('product_custom_fields')
        .select('codigo_modelo, field_key, field_value')
        .in('codigo_modelo', codes)
    : { data: [] }

  const valueMap: Record<string, Record<string, string>> = {}
  for (const cf of customFields ?? []) {
    if (!valueMap[cf.codigo_modelo]) valueMap[cf.codigo_modelo] = {}
    valueMap[cf.codigo_modelo][cf.field_key] = cf.field_value ?? ''
  }

  const initialRows = products.map(p => ({
    codigo_modelo:   p.codigo_modelo,
    description:     p.description ?? '',
    supplier_name:   p.supplier_name ?? '',
    metal:           p.metal ?? '',
    familia:         p.familia ?? '',
    category:        p.category ?? '',
    is_discontinued: p.is_discontinued ? '1' : '0',
    ...(valueMap[p.codigo_modelo] ?? {}),
  }))

  // Filter options
  const suppliers  = uniq(products.map(p => p.supplier_name as string))
  const metals     = uniq(products.map(p => p.metal as string))
  const familias   = uniq(products.map(p => p.familia as string))
  const categories = uniq(products.map(p => p.category as string))

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <PageHeader
          eyebrow="Productos"
          title="Campos del equipo — edición en lote"
          subtitle={`${products.length} modelos · ${fieldDefs.length} campos activos`}
        />
      </div>
      <BatchCustomFieldsTable
        fieldDefs={fieldDefs}
        initialRows={initialRows}
        filterOptions={{ suppliers, metals, familias, categories }}
      />
    </div>
  )
}
