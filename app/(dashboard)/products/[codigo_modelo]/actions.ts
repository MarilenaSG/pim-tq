'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { CustomFieldType } from '@/types'

export async function saveCustomField(
  codigo_modelo: string,
  field_key: string,
  field_value: string,
  field_type: CustomFieldType,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('product_custom_fields')
    .upsert(
      {
        codigo_modelo,
        field_key,
        field_value: field_value.trim() || null,
        field_type,
        updated_by: null,
      },
      { onConflict: 'codigo_modelo,field_key' }
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/products/${codigo_modelo}`)
  return { ok: true }
}
