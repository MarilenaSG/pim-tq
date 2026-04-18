import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifyShopifyHmac,
  exchangeCodeForToken,
  storeShopifyToken,
  getAppUrl,
} from '@/lib/shopify'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })

  const { code, shop, state, hmac } = params

  // 1 · Validate required params
  if (!code || !shop || !hmac) {
    return NextResponse.redirect(`${getAppUrl()}/settings/sync?shopify=error&reason=missing_params`)
  }

  // 2 · Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('shopify_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${getAppUrl()}/settings/sync?shopify=error&reason=invalid_state`)
  }
  cookieStore.delete('shopify_oauth_state')

  // 3 · Verify HMAC signature
  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (!secret) {
    return NextResponse.redirect(`${getAppUrl()}/settings/sync?shopify=error&reason=no_secret`)
  }

  if (!verifyShopifyHmac(params, secret)) {
    return NextResponse.redirect(`${getAppUrl()}/settings/sync?shopify=error&reason=invalid_hmac`)
  }

  // 4 · Exchange code for access token
  try {
    const accessToken = await exchangeCodeForToken(shop, code)
    await storeShopifyToken(accessToken, shop)

    return NextResponse.redirect(`${getAppUrl()}/settings/sync?shopify=connected`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[Shopify OAuth] Error:', msg)
    return NextResponse.redirect(
      `${getAppUrl()}/settings/sync?shopify=error&reason=${encodeURIComponent(msg)}`
    )
  }
}
