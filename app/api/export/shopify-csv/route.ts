import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function csvCell(value: string | null | undefined): string {
  const s = value ?? ''
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells: (string | null | undefined)[]): string {
  return cells.map(csvCell).join(',')
}

function toHandle(description: string | null): string {
  return (description ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 255)
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const filterNoSync   = sp.get('no_sync') === 'true'
  const filterDraft    = sp.get('draft') === 'true'
  const familia        = sp.get('familia') ?? ''
  const metal          = sp.get('metal') ?? ''
  const abc            = sp.get('abc') ?? ''

  const supabase = createServiceClient()

  // Products with variants, shopify data and images
  let q = supabase
    .from('products')
    .select(`
      codigo_modelo,
      description,
      supplier_name,
      category,
      product_variants(codigo_interno, variante, precio_venta, precio_tachado, es_variante_lider),
      product_shopify_data(shopify_handle, shopify_title, shopify_description, shopify_tags, shopify_status, shopify_seo_title, shopify_seo_desc, synced_at),
      product_images(url, is_primary, orden)
    `)
    .eq('is_discontinued', false)
    .order('abc_ventas', { ascending: true, nullsFirst: false })

  if (familia) q = q.eq('familia', familia)
  if (metal)   q = q.eq('metal', metal)
  if (abc)     q = q.eq('abc_ventas', abc)

  const { data: rawProducts, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type ShopifyRow = { shopify_handle: string | null; shopify_title: string | null; shopify_description: string | null; shopify_tags: string[] | null; shopify_status: string | null; shopify_seo_title: string | null; shopify_seo_desc: string | null; synced_at: string | null } | null
  type VariantRow = { codigo_interno: string; variante: string | null; precio_venta: number | null; precio_tachado: number | null; es_variante_lider: boolean }
  type ImageRow = { url: string; is_primary: boolean; orden: number | null }

  type Product = {
    codigo_modelo: string
    description: string | null
    supplier_name: string | null
    category: string | null
    product_variants: VariantRow[]
    product_shopify_data: ShopifyRow
    product_images: ImageRow[]
  }

  let products = (rawProducts ?? []) as unknown as Product[]

  // Apply filters
  if (filterNoSync) {
    products = products.filter(p => !p.product_shopify_data)
  }
  if (filterDraft) {
    products = products.filter(p => p.product_shopify_data?.shopify_status === 'draft')
  }

  // Build summary warning counts
  let sinDescripcion = 0
  let sinSeoTitle    = 0
  let sinTags        = 0

  const headerRow = 'Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Price,Variant Compare At Price,Image Src,Image Position,SEO Title,SEO Description'
  const rows: string[] = [headerRow]

  for (const product of products) {
    const sd       = product.product_shopify_data
    const variants = (product.product_variants ?? []).sort((a, b) => (a.es_variante_lider ? -1 : 1))
    const images   = (product.product_images ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    const primaryImg = images.find(i => i.is_primary) ?? images[0] ?? null

    const handle      = sd?.shopify_handle ?? toHandle(product.description)
    const title       = sd?.shopify_title ?? product.description ?? ''
    const bodyHtml    = sd?.shopify_description ?? ''
    const vendor      = product.supplier_name ?? ''
    const type        = product.category ?? ''
    const tags        = Array.isArray(sd?.shopify_tags) ? sd!.shopify_tags.join(',') : ''
    const seoTitle    = sd?.shopify_seo_title ?? ''
    const seoDesc     = sd?.shopify_seo_desc ?? ''

    if (!bodyHtml)  sinDescripcion++
    if (!seoTitle)  sinSeoTitle++
    if (!tags)      sinTags++

    if (variants.length === 0) {
      rows.push(csvRow([
        handle, title, bodyHtml, vendor, type, tags, 'true',
        'Title', 'Default Title', product.codigo_modelo, '', '',
        primaryImg?.url ?? '', primaryImg ? '1' : '',
        seoTitle, seoDesc,
      ]))
      continue
    }

    for (let i = 0; i < variants.length; i++) {
      const v      = variants[i]
      const isFirst = i === 0
      const img    = images[i] ?? null

      rows.push(csvRow([
        handle,
        isFirst ? title : '',
        isFirst ? bodyHtml : '',
        isFirst ? vendor : '',
        isFirst ? type : '',
        isFirst ? tags : '',
        isFirst ? 'true' : '',
        isFirst ? 'Talla' : '',
        v.variante ?? 'Default',
        v.codigo_interno,
        v.precio_venta != null ? v.precio_venta.toFixed(2) : '',
        v.precio_tachado != null ? v.precio_tachado.toFixed(2) : '',
        img?.url ?? '',
        img ? String(i + 1) : '',
        isFirst ? seoTitle : '',
        isFirst ? seoDesc : '',
      ]))
    }
  }

  // Add warning comment at end
  const warnings = []
  if (sinDescripcion > 0) warnings.push(`${sinDescripcion} sin descripción Shopify`)
  if (sinSeoTitle > 0)    warnings.push(`${sinSeoTitle} sin SEO title`)
  if (sinTags > 0)        warnings.push(`${sinTags} sin tags`)
  if (warnings.length > 0) {
    rows.push(`# Resumen: ${warnings.join(' · ')} — genera contenido con IA desde la ficha antes de exportar`)
  }

  const fecha = new Date().toISOString().slice(0, 10)
  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shopify-import-${fecha}.csv"`,
    },
  })
}
