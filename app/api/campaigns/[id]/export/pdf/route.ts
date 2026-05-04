import { NextRequest } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServiceClient } from '@/lib/supabase/server'
import { CampaignPDF, type CampaignPDFData, type ProductPDFRow } from '@/lib/campaign-pdf'

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  // ── 1. Campaign ────────────────────────────────────────────────
  const { data: raw, error: campErr } = await supabase
    .from('campaigns')
    .select('id, nombre, tipo, descripcion, narrativa, objetivos, canales, soportes, fecha_inicio, fecha_fin, color')
    .eq('id', params.id)
    .single()

  if (campErr || !raw) return new Response('Campaña no encontrada', { status: 404 })

  const campaign: CampaignPDFData = {
    nombre:       raw.nombre,
    tipo:         raw.tipo,
    narrativa:    raw.narrativa,
    descripcion:  raw.descripcion,
    objetivos:    raw.objetivos,
    canales:      raw.canales,
    soportes:     raw.soportes,
    fecha_inicio: raw.fecha_inicio,
    fecha_fin:    raw.fecha_fin,
    color:        raw.color,
  }

  // ── 2. Products in campaign ─────────────────────────────────────
  const { data: campaignProducts } = await supabase
    .from('campaign_products')
    .select('codigo_modelo')
    .eq('campaign_id', params.id)
    .order('added_at', { ascending: true })

  const codes = (campaignProducts ?? []).map(cp => cp.codigo_modelo as string)
  if (!codes.length) return new Response('La campaña no tiene productos', { status: 404 })

  // ── 3. Product data ─────────────────────────────────────────────
  const [productsRes, shopifyRes, variantsRes, imagesRes] = await Promise.all([
    supabase
      .from('products')
      .select('codigo_modelo, familia, metal, karat')
      .in('codigo_modelo', codes),
    supabase
      .from('product_shopify_data')
      .select('codigo_modelo, shopify_title, shopify_description, shopify_vendor, shopify_handle, shopify_tags')
      .in('codigo_modelo', codes),
    supabase
      .from('product_variants')
      .select('codigo_modelo, variante, precio_venta, precio_tachado, descuento_aplicado, es_variante_lider')
      .in('codigo_modelo', codes)
      .eq('is_discontinued', false),
    supabase
      .from('product_images')
      .select('codigo_modelo, url, is_primary, orden')
      .in('codigo_modelo', codes)
      .order('is_primary', { ascending: false })
      .order('orden',      { ascending: true }),
  ])

  const productMap = Object.fromEntries((productsRes.data ?? []).map(p => [p.codigo_modelo, p]))
  const shopifyMap = Object.fromEntries((shopifyRes.data ?? []).map(p => [p.codigo_modelo, p]))

  const leaderMap: Record<string, { precio_venta: number | null; precio_tachado: number | null; descuento_aplicado: number | null }> = {}
  const variantsByModel: Record<string, string[]> = {}
  for (const v of variantsRes.data ?? []) {
    const code = v.codigo_modelo as string
    if (v.es_variante_lider || !leaderMap[code]) {
      leaderMap[code] = { precio_venta: v.precio_venta, precio_tachado: v.precio_tachado, descuento_aplicado: v.descuento_aplicado }
    }
    if (v.variante) {
      if (!variantsByModel[code]) variantsByModel[code] = []
      variantsByModel[code].push(v.variante)
    }
  }

  const imagesByModel: Record<string, string[]> = {}
  for (const img of imagesRes.data ?? []) {
    const code = img.codigo_modelo as string
    if (!imagesByModel[code]) imagesByModel[code] = []
    if (imagesByModel[code].length < 3) imagesByModel[code].push(img.url as string)
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN ?? ''

  const products: ProductPDFRow[] = codes.map(code => {
    const p  = productMap[code]
    const sh = shopifyMap[code]
    const lv = leaderMap[code]
    const vars = variantsByModel[code] ?? []
    const sortedVars = [...vars].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b)
      return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b, 'es')
    })
    return {
      codigo:      code,
      nombre:      sh?.shopify_title      ?? '',
      marca:       sh?.shopify_vendor      ?? null,
      metal:       p?.metal               ?? null,
      karat:       p?.karat               ?? null,
      familia:     p?.familia             ?? null,
      precio:      lv?.precio_venta       ?? null,
      precioAntes: lv?.precio_tachado     ?? null,
      descuento:   lv?.descuento_aplicado ?? null,
      descripcion: stripHtml(sh?.shopify_description),
      tags:        Array.isArray(sh?.shopify_tags) ? (sh.shopify_tags as string[]).join(', ') : '',
      url:         sh?.shopify_handle ? `https://${shopDomain}/products/${sh.shopify_handle}` : '',
      tallas:      sortedVars.join(', '),
      imagenes:    imagesByModel[code] ?? [],
    }
  })

  // ── 4. Render PDF ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CampaignPDF, { campaign, products }) as any
  const nodeBuffer = await renderToBuffer(element)
  // Convert Node Buffer → Uint8Array for Web Response API
  const buffer = new Uint8Array(nodeBuffer)

  const fecha = new Date().toISOString().slice(0, 10)
  const safeName = campaign.nombre.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

  return new Response(buffer, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="TQ-Jewels-${safeName}-${fecha}.pdf"`,
    },
  })
}
