import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const IA_FIELD_KEYS = ['shopify_title_ia', 'shopify_description_ia', 'seo_title_ia', 'seo_desc_ia', 'tags_ia', 'precio_sugerido_ia', 'precio_tachado_sugerido_ia']

function sanitizeHtml(html: string): string {
  // Keep safe tags, strip scripts and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function normalizeTags(val: string): string {
  // Handle JSON array or comma-separated string
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed.join(',')
  } catch {}
  return val.split(',').map(t => t.trim()).filter(Boolean).join(',')
}

function fmtPrice(val: string): string {
  // Convert European format to Shopify format (no € symbol, dot decimal)
  const cleaned = val.replace(/[€\s]/g, '').replace('.', '').replace(',', '.')
  const n = parseFloat(cleaned)
  if (isNaN(n)) return ''
  return n.toFixed(2)
}

function csvRow(cells: (string | null | undefined)[]): string {
  return cells.map(c => {
    const s = c ?? ''
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }).join(',')
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const soloIa    = sp.get('solo_ia') !== 'false'
  const campos    = (sp.get('campos') ?? 'title,description,seo_title,seo_desc,tags').split(',')
  const conPrecios = campos.includes('precio')
  const familia   = sp.get('familia') ?? ''
  const metal     = sp.get('metal') ?? ''
  const abc       = sp.get('abc') ?? ''
  const campaignId = sp.get('campaign_id') ?? ''

  const supabase = createServiceClient()

  let codigosFilter: string[] | null = null
  if (campaignId) {
    const { data: cp } = await supabase
      .from('campaign_products')
      .select('codigo_modelo')
      .eq('campaign_id', campaignId)
    codigosFilter = (cp ?? []).map(r => r.codigo_modelo)
    if (codigosFilter.length === 0) {
      return new NextResponse('Handle,Title,Body (HTML),Tags,SEO Title,SEO Description\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="shopify-import-empty.csv"`,
        },
      })
    }
  }

  // Build products query
  let q = supabase
    .from('products')
    .select(`
      codigo_modelo,
      description,
      product_shopify_data(shopify_handle),
      product_custom_fields(field_key, field_value),
      product_variants(slug, codigo_interno, variante)
    `)

  if (familia)         q = q.eq('familia', familia)
  if (metal)           q = q.eq('metal', metal)
  if (abc)             q = q.eq('abc_ventas', abc)
  if (codigosFilter)   q = q.in('codigo_modelo', codigosFilter)

  const { data: rawProducts } = await q

  type RawProduct = {
    codigo_modelo: string
    description: string | null
    product_shopify_data: { shopify_handle: string | null } | null
    product_custom_fields: { field_key: string; field_value: string | null }[]
    product_variants: { slug: string; codigo_interno: string; variante: string | null }[]
  }

  let products = (rawProducts ?? []) as unknown as RawProduct[]

  if (soloIa) {
    products = products.filter(p =>
      p.product_custom_fields?.some(f => IA_FIELD_KEYS.includes(f.field_key) && f.field_value)
    )
  }

  const warnings: string[] = []
  const rows: string[] = []

  // Headers
  if (conPrecios) {
    rows.push('Handle,Title,Body (HTML),Tags,SEO Title,SEO Description,Variant SKU,Variant Price,Variant Compare At Price')
  } else {
    rows.push('Handle,Title,Body (HTML),Tags,SEO Title,SEO Description')
  }

  for (const product of products) {
    const handle = (product.product_shopify_data as { shopify_handle: string | null } | null)?.shopify_handle
    if (!handle) {
      warnings.push(product.codigo_modelo)
      continue
    }

    const fields = Object.fromEntries(
      (product.product_custom_fields ?? []).map(f => [f.field_key, f.field_value ?? ''])
    )

    const title    = campos.includes('title')       ? (fields['shopify_title_ia'] ?? '')       : ''
    const body     = campos.includes('description') ? sanitizeHtml(fields['shopify_description_ia'] ?? '') : ''
    const tags     = campos.includes('tags')        ? normalizeTags(fields['tags_ia'] ?? '')   : ''
    const seoTitle = campos.includes('seo_title')   ? truncate(fields['seo_title_ia'] ?? '', 70)  : ''
    const seoDesc  = campos.includes('seo_desc')    ? truncate(fields['seo_desc_ia'] ?? '', 160) : ''

    if (!conPrecios) {
      rows.push(csvRow([handle, title, body, tags, seoTitle, seoDesc]))
    } else {
      const precio        = campos.includes('precio') ? fmtPrice(fields['precio_sugerido_ia'] ?? '') : ''
      const precioTachado = campos.includes('precio') ? fmtPrice(fields['precio_tachado_sugerido_ia'] ?? '') : ''
      const variants = product.product_variants ?? []

      if (variants.length === 0) {
        rows.push(csvRow([handle, title, body, tags, seoTitle, seoDesc, '', precio, precioTachado]))
      } else {
        // First variant row: includes text fields
        const [first, ...rest] = variants
        rows.push(csvRow([handle, title, body, tags, seoTitle, seoDesc, first.slug, precio, precioTachado]))
        // Additional variant rows: empty text fields
        for (const v of rest) {
          rows.push(csvRow([handle, '', '', '', '', '', v.slug, precio, precioTachado]))
        }
      }
    }
  }

  // Append warnings as comment at the end
  if (warnings.length > 0) {
    rows.push(`# ${warnings.length} producto(s) omitidos por falta de Shopify handle: ${warnings.join(', ')}`)
  }

  const fecha = new Date().toISOString().slice(0, 10)
  const csv = rows.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shopify-import-${fecha}.csv"`,
    },
  })
}
