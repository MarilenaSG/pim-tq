'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

export async function savePricingRule(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()

  const id                 = (formData.get('id') as string) || null
  const familia            = (formData.get('familia') as string)            || null
  const metal              = (formData.get('metal') as string)              || null
  const karat              = (formData.get('karat') as string)              || null
  const redondeo           = (formData.get('redondeo') as string)           || null
  const margen_raw         = formData.get('margen_objetivo_pct') as string
  const descuento_raw      = formData.get('descuento_minimo_pct') as string

  const margen_objetivo_pct  = parseFloat(margen_raw.replace(',', '.'))
  const descuento_minimo_pct = parseFloat((descuento_raw || '0').replace(',', '.')) || 0

  if (isNaN(margen_objetivo_pct) || margen_objetivo_pct <= 0) {
    return { ok: false, error: 'El margen objetivo es obligatorio y debe ser mayor que 0' }
  }

  const payload = {
    familia,
    metal,
    karat,
    margen_objetivo_pct,
    descuento_minimo_pct,
    redondeo: redondeo || null,
    updated_by: null,
    updated_at: new Date().toISOString(),
  }

  let error
  if (id) {
    ;({ error } = await supabase.from('pricing_rules').update(payload).eq('id', id))
  } else {
    ;({ error } = await supabase.from('pricing_rules').insert(payload))
  }

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/pricing')
  return { ok: true }
}

export async function deletePricingRule(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('pricing_rules').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/pricing')
  return { ok: true }
}
