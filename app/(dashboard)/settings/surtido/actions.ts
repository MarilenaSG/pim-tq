'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

const ROLES = ['Destino', 'Rutina', 'Ocasional', 'Conveniencia']
const CLUSTERS = ['A', 'B', 'C']

export async function saveRolCategoria(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const familia       = (formData.get('familia') as string) || ''
  const rol_categoria = (formData.get('rol_categoria') as string) || null
  const justificacion = (formData.get('justificacion') as string) || null

  if (!familia) return { ok: false, error: 'Familia obligatoria' }
  if (rol_categoria && !ROLES.includes(rol_categoria)) {
    return { ok: false, error: 'Rol de categoría no válido' }
  }

  const { error } = await supabase
    .from('rol_categoria_familia')
    .upsert(
      { familia, rol_categoria, justificacion, updated_at: new Date().toISOString() },
      { onConflict: 'familia' },
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/surtido')
  return { ok: true }
}

export async function saveStoreCluster(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const tienda  = (formData.get('tienda') as string) || ''
  const cluster = (formData.get('cluster') as string) || null

  if (!tienda) return { ok: false, error: 'Tienda obligatoria' }
  if (cluster && !CLUSTERS.includes(cluster)) {
    return { ok: false, error: 'Cluster no válido (A/B/C)' }
  }

  const { error } = await supabase
    .from('stores')
    .update({ cluster, updated_at: new Date().toISOString() })
    .eq('tienda', tienda)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/surtido')
  return { ok: true }
}
