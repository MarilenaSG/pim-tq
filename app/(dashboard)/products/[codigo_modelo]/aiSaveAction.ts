'use server'

import { createServiceClient } from '@/lib/supabase/server'

type GenerationType = 'shopify_description' | 'seo_title' | 'tags' | 'catalog_description'

export async function saveAiContent(
  codigoModelo: string,
  type: GenerationType,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()

  try {
    if (type === 'catalog_description') {
      const { error } = await supabase.from('product_custom_fields').upsert({
        codigo_modelo: codigoModelo,
        field_key:     'catalog_description',
        field_value:   content,
        field_type:    'textarea',
        updated_by:    'ia',
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'codigo_modelo,field_key' })
      if (error) throw error
    } else {
      const fieldMap: Record<string, string> = {
        shopify_description: 'shopify_description',
        seo_title:           'shopify_seo_title',
        tags:                'shopify_tags',
      }
      const field = fieldMap[type]
      const value = type === 'tags'
        ? content.split(',').map(t => t.trim()).filter(Boolean)
        : content

      const { data: existing } = await supabase
        .from('product_shopify_data')
        .select('codigo_modelo')
        .eq('codigo_modelo', codigoModelo)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('product_shopify_data')
          .update({ [field]: value, synced_at: new Date().toISOString() })
          .eq('codigo_modelo', codigoModelo)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_shopify_data')
          .insert({ codigo_modelo: codigoModelo, [field]: value, synced_at: new Date().toISOString() })
        if (error) throw error
      }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
