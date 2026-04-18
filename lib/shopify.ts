import crypto from 'crypto'
import { createServiceClient } from './supabase/server'

// ── Types ─────────────────────────────────────────────────────

export interface ShopifyVariant {
  id: number
  sku: string | null
  title: string
}

export interface ShopifyImage {
  id: number
  src: string
  alt: string | null
  position: number
  variant_ids: number[]
}

export interface ShopifyProduct {
  id: number
  title: string
  body_html: string | null
  vendor: string | null
  handle: string
  status: string
  tags: string         // comma-separated
  variants: ShopifyVariant[]
  images: ShopifyImage[]
}

export interface ShopifySyncResult {
  productsProcessed: number
  shopifyDataUpserted: number
  imagesUpserted: number
  skippedNoMatch: number
  errors: string[]
}

// ── Domain helpers ────────────────────────────────────────────

export function getShopDomain(): string {
  const d = (process.env.SHOPIFY_SHOP_DOMAIN ?? '').trim()
  if (!d) throw new Error('SHOPIFY_SHOP_DOMAIN no está configurada')
  // Shopify Admin API requires the .myshopify.com domain
  if (!d.endsWith('.myshopify.com')) {
    // Common case: store provided custom domain instead of myshopify subdomain
    throw new Error(
      `SHOPIFY_SHOP_DOMAIN debe ser el dominio .myshopify.com (ej: "mi-tienda.myshopify.com"). ` +
      `Valor actual: "${d}"`
    )
  }
  return d
}

export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// ── Token storage ─────────────────────────────────────────────

const SETTINGS_KEY = 'shopify_access_token'
const SETTINGS_SHOP_KEY = 'shopify_connected_shop'

export async function getStoredShopifyToken(): Promise<string | null> {
  // Env var takes precedence (useful for manual setup or legacy tokens)
  if (process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  return data?.value ?? null
}

export async function storeShopifyToken(token: string, shop: string): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  await Promise.all([
    supabase.from('settings').upsert(
      { key: SETTINGS_KEY, value: token, updated_at: now },
      { onConflict: 'key' }
    ),
    supabase.from('settings').upsert(
      { key: SETTINGS_SHOP_KEY, value: shop, updated_at: now },
      { onConflict: 'key' }
    ),
  ])
}

export async function getConnectedShop(): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_SHOP_KEY)
    .single()
  return data?.value ?? null
}

// ── OAuth helpers ─────────────────────────────────────────────

const OAUTH_SCOPES = 'read_products'

export function buildOAuthUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id:    process.env.SHOPIFY_CLIENT_ID!,
    scope:        OAUTH_SCOPES,
    redirect_uri: `${getAppUrl()}/api/shopify/oauth/callback`,
    state,
    'grant_options[]': 'per-user',
  })
  return `https://${shop}/admin/oauth/authorize?${params}`
}

export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OAuth token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json() as { access_token: string }
  if (!data.access_token) throw new Error('OAuth response missing access_token')
  return data.access_token
}

/** Verify the HMAC sent by Shopify in the OAuth callback */
export function verifyShopifyHmac(
  query: Record<string, string>,
  secret: string
): boolean {
  const { hmac, ...rest } = query
  if (!hmac) return false

  const message = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const digest = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(hmac, 'hex')
    )
  } catch {
    return false
  }
}

// ── Shopify API fetch ─────────────────────────────────────────

/** Parse the Link header from Shopify to get the next page URL */
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  // Format: <https://...?page_info=xxx&limit=250>; rel="next"
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}

export async function fetchAllShopifyProducts(
  token: string,
  shop: string
): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = []
  let url: string | null =
    `https://${shop}/admin/api/2024-01/products.json?limit=250&status=any`

  while (url) {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Shopify API error ${response.status}: ${text}`)
    }

    const data = await response.json() as { products: ShopifyProduct[] }
    products.push(...data.products)

    url = parseNextLink(response.headers.get('Link'))

    // Respect Shopify rate limits (2 req/s for standard plans)
    if (url) await new Promise(r => setTimeout(r, 500))
  }

  return products
}

// ── Main sync function ────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

export async function syncShopify(): Promise<ShopifySyncResult> {
  const token = await getStoredShopifyToken()
  if (!token) {
    throw new Error('No hay access token de Shopify. Conecta la tienda primero en /settings/sync.')
  }

  const shop = getShopDomain()
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const errors: string[] = []

  // 1 · Fetch all products from Shopify
  const shopifyProducts = await fetchAllShopifyProducts(token, shop)
  if (shopifyProducts.length === 0) {
    return { productsProcessed: 0, shopifyDataUpserted: 0, imagesUpserted: 0, skippedNoMatch: 0, errors: ['Shopify devolvió 0 productos'] }
  }

  // 2 · Collect all SKUs to match against product_variants
  const allSkus = shopifyProducts.flatMap(p =>
    p.variants.map(v => v.sku).filter((s): s is string => !!s && s.trim() !== '')
  )
  const uniqueSkus = Array.from(new Set(allSkus))

  // 3 · Batch query product_variants to get codigo_modelo for each SKU
  const skuToModel = new Map<string, string>()
  for (const batch of chunk(uniqueSkus, 500)) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('codigo_interno, codigo_modelo')
      .in('codigo_interno', batch)

    if (variants) {
      for (const v of variants) {
        skuToModel.set(v.codigo_interno, v.codigo_modelo)
      }
    }
  }

  // 4 · Build upsert rows
  type ShopifyDataRow = {
    codigo_modelo: string; shopify_product_id: string; shopify_title: string | null
    shopify_description: string | null; shopify_tags: string[]; shopify_status: string | null
    shopify_handle: string | null; shopify_vendor: string | null
    shopify_seo_title: null; shopify_seo_desc: null; synced_at: string
  }
  type ImageRow = {
    codigo_modelo: string; url: string; source: 'shopify'
    variante: string | null; alt_text: string | null; orden: number; is_primary: boolean
  }
  const shopifyDataRows: ShopifyDataRow[] = []
  const imageRows: ImageRow[] = []
  let skippedNoMatch = 0

  for (const product of shopifyProducts) {
    // Find codigo_modelo: check all variant SKUs, take first match
    let codigoModelo: string | null = null
    for (const variant of product.variants) {
      if (variant.sku && skuToModel.has(variant.sku)) {
        codigoModelo = skuToModel.get(variant.sku)!
        break
      }
    }

    if (!codigoModelo) {
      skippedNoMatch++
      continue
    }

    // Shopify data row
    shopifyDataRows.push({
      codigo_modelo:       codigoModelo,
      shopify_product_id:  String(product.id),
      shopify_title:       product.title || null,
      shopify_description: product.body_html || null,
      shopify_tags:        product.tags
                             ? product.tags.split(',').map(t => t.trim()).filter(t => t !== '')
                             : [],
      shopify_status:      product.status || null,
      shopify_handle:      product.handle || null,
      shopify_vendor:      product.vendor || null,
      shopify_seo_title:   null,   // metafields API — Sesión futura
      shopify_seo_desc:    null,
      synced_at:           now,
    })

    // Images
    for (const img of product.images) {
      const firstVariantId = img.variant_ids[0]
      const linkedVariant = firstVariantId
        ? product.variants.find(v => v.id === firstVariantId)
        : undefined

      imageRows.push({
        codigo_modelo: codigoModelo,
        url:           img.src,
        source:        'shopify' as const,
        variante:      linkedVariant?.title ?? null,
        alt_text:      img.alt || null,
        orden:         img.position,
        is_primary:    img.position === 1,
      })
    }
  }

  // 5 · Upsert product_shopify_data
  let shopifyDataUpserted = 0
  for (const batch of chunk(shopifyDataRows, 100)) {
    const { error } = await supabase
      .from('product_shopify_data')
      .upsert(batch, { onConflict: 'codigo_modelo' })

    if (error) {
      errors.push(`product_shopify_data batch error: ${error.message}`)
    } else {
      shopifyDataUpserted += batch.length
    }
  }

  // 6 · Replace Shopify images for matched models
  const matchedModels = Array.from(new Set(shopifyDataRows.map(r => r.codigo_modelo as string)))
  for (const batch of chunk(matchedModels, 250)) {
    await supabase
      .from('product_images')
      .delete()
      .in('codigo_modelo', batch)
      .eq('source', 'shopify')
  }

  let imagesUpserted = 0
  if (imageRows.length > 0) {
    for (const batch of chunk(imageRows, 250)) {
      const { error } = await supabase
        .from('product_images')
        .insert(batch)
      if (error) {
        errors.push(`Images batch error: ${error.message}`)
      } else {
        imagesUpserted += batch.length
      }
    }
  }

  // 7 · Update shopify_synced_at on products
  for (const batch of chunk(matchedModels, 250)) {
    await supabase
      .from('products')
      .update({ shopify_synced_at: now, updated_at: now })
      .in('codigo_modelo', batch)
  }

  return {
    productsProcessed:   shopifyProducts.length,
    shopifyDataUpserted,
    imagesUpserted,
    skippedNoMatch,
    errors,
  }
}
