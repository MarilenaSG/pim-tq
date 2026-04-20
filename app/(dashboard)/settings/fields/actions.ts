'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { CustomFieldType } from '@/types'

function labelToKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function createField(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const label      = (formData.get('label') as string)?.trim()
  const field_type = formData.get('field_type') as CustomFieldType
  const optionsRaw = (formData.get('options') as string)?.trim()

  if (!label)      return { ok: false, error: 'El nombre es obligatorio' }
  if (!field_type) return { ok: false, error: 'El tipo es obligatorio' }

  const field_key = labelToKey(label)
  if (!field_key)  return { ok: false, error: 'El nombre no genera una clave válida (usa letras o números)' }

  const options =
    field_type === 'select' && optionsRaw
      ? optionsRaw.split('\n').map(o => o.trim()).filter(Boolean)
      : null

  if (field_type === 'select' && (!options || options.length === 0)) {
    return { ok: false, error: 'Los campos de tipo lista requieren al menos una opción' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('custom_field_definitions')
    .insert({ field_key, label, field_type, options, is_active: true })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: `Ya existe un campo con la clave "${field_key}"` }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/settings/fields')
  revalidatePath('/products', 'layout')
  return { ok: true }
}

export async function toggleField(
  id: string,
  is_active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('custom_field_definitions')
    .update({ is_active })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings/fields')
  revalidatePath('/products', 'layout')
  return { ok: true }
}
