import { createServerClient } from '@/lib/supabase/server'
import { CampaignsClient } from './CampaignsClient'

export type CampaignRow = {
  id: string
  nombre: string
  slug: string
  tipo: string | null
  descripcion: string | null
  narrativa: string | null
  objetivos: string | null
  canales: string | null
  soportes: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string
  color: string | null
  numProductos: number
}

export default async function CampaignsPage() {
  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from('campaigns')
    .select('id, nombre, slug, tipo, descripcion, narrativa, objetivos, canales, soportes, fecha_inicio, fecha_fin, estado, color, campaign_products(codigo_modelo)')
    .order('created_at', { ascending: false })

  const campaigns: CampaignRow[] = ((raw ?? []) as unknown as (CampaignRow & { campaign_products: { codigo_modelo: string }[] })[])
    .map(c => ({
      id:           c.id,
      nombre:       c.nombre,
      slug:         c.slug,
      tipo:         c.tipo,
      descripcion:  c.descripcion,
      narrativa:    c.narrativa,
      objetivos:    c.objetivos,
      canales:      c.canales,
      soportes:     c.soportes,
      fecha_inicio: c.fecha_inicio,
      fecha_fin:    c.fecha_fin,
      estado:       c.estado,
      color:        c.color,
      numProductos: Array.isArray(c.campaign_products) ? c.campaign_products.length : 0,
    }))

  return <CampaignsClient campaigns={campaigns} />
}
