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

// ── GraphQL query for product sync ───────────────────────────

const PRODUCTS_GQL = `
  query GetProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title bodyHtml handle status vendor tags
          images(first: 30) {
            edges { node { id url altText } }
          }
          variants(first: 100) {
            edges { node { id sku title position image { url } } }
          }
        }
      }
    }
  }
`

interface GqlNode {
  id: string; title: string; bodyHtml: string | null
  handle: string; status: string; vendor: string | null; tags: string[]
  images:   { edges: { node: { id: string; url: string; altText: string | null } }[] }
  variants: { edges: { node: { id: string; sku: string | null; title: string; position: number; image: { url: string } | null } }[] }
}

interface GqlResponse {
  data?: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: GqlNode }[] } }
  errors?: { message: string }[]
}

function gidToInt(gid: string): number {
  return parseInt(gid.split('/').pop() ?? '0', 10)
}

export async function fetchAllShopifyProducts(
  token: string,
  shop: string
): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = []
  let cursor: string | null = null

  while (true) {
    const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PRODUCTS_GQL, variables: { cursor } }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Shopify GraphQL error ${response.status}: ${text}`)
    }

    const json = await response.json() as GqlResponse
    if (json.errors?.length) {
      throw new Error(`Shopify GraphQL: ${json.errors.map(e => e.message).join(', ')}`)
    }
    if (!json.data) throw new Error('Shopify GraphQL: respuesta sin data')

    const { edges, pageInfo } = json.data.products

    for (const { node } of edges) {
      const variantNodes = node.variants.edges.map(e => e.node)

      // Build image-url → variantId[] map for linking images to variants
      const imgVariantMap = new Map<string, number[]>()
      for (const v of variantNodes) {
        if (v.image?.url) {
          const list = imgVariantMap.get(v.image.url) ?? []
          list.push(gidToInt(v.id))
          imgVariantMap.set(v.image.url, list)
        }
      }

      products.push({
        id:        gidToInt(node.id),
        title:     node.title,
        body_html: node.bodyHtml,
        vendor:    node.vendor,
        handle:    node.handle,
        status:    node.status.toLowerCase(),
        tags:      node.tags.join(','),
        variants:  variantNodes.map(v => ({ id: gidToInt(v.id), sku: v.sku, title: v.title })),
        images:    node.images.edges.map(({ node: img }, i) => ({
          id:          gidToInt(img.id),
          src:         img.url,
          alt:         img.altText,
          position:    i + 1,
          variant_ids: imgVariantMap.get(img.url) ?? [],
        })),
      })
    }

    if (!pageInfo.hasNextPage) break
    cursor = pageInfo.endCursor
    await new Promise(r => setTimeout(r, 500))
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

  // Use the shop stored during OAuth (the real .myshopify.com domain),
  // falling back to SHOPIFY_SHOP_DOMAIN env var for manual token setups
  const storedShop = await getConnectedShop()
  const shop = storedShop ?? getShopDomain()
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

  // 3 · Batch query product_variants to get codigo_modelo for each SKU (matched by slug)
  const skuToModel = new Map<string, string>()
  for (const batch of chunk(uniqueSkus, 500)) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('slug, codigo_modelo')
      .in('slug', batch)

    if (variants) {
      for (const v of variants) {
        skuToModel.set(v.slug, v.codigo_modelo)
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
    // Collect ALL unique codigo_modelo values from this product's variants.
    // A single Shopify product can group variants from different PIM models
    // (e.g. gold collar + silver collar = same Shopify product, different codigo_modelo).
    const modelosForProduct = new Set<string>()
    for (const variant of product.variants) {
      if (variant.sku && skuToModel.has(variant.sku)) {
        modelosForProduct.add(skuToModel.get(variant.sku)!)
      }
    }

    if (modelosForProduct.size === 0) {
      skippedNoMatch++
      continue
    }

    const tags = product.tags
      ? product.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      : []

    // One shopify_data row + images per matched codigo_modelo
    for (const codigoModelo of Array.from(modelosForProduct)) {
      shopifyDataRows.push({
        codigo_modelo:       codigoModelo,
        shopify_product_id:  String(product.id),
        shopify_title:       product.title || null,
        shopify_description: product.body_html || null,
        shopify_tags:        tags,
        shopify_status:      product.status || null,
        shopify_handle:      product.handle || null,
        shopify_vendor:      product.vendor || null,
        shopify_seo_title:   null,
        shopify_seo_desc:    null,
        synced_at:           now,
      })

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
  }

  // 5 · Upsert product_shopify_data — deduplicate by codigo_modelo
  // (two different Shopify products could both match the same codigo_modelo)
  const seenModels = new Set<string>()
  const uniqueShopifyDataRows = shopifyDataRows.filter(r => {
    if (seenModels.has(r.codigo_modelo)) return false
    seenModels.add(r.codigo_modelo)
    return true
  })

  let shopifyDataUpserted = 0
  for (const batch of chunk(uniqueShopifyDataRows, 100)) {
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
  const matchedModels = Array.from(seenModels)
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
