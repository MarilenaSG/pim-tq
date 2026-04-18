import { NextRequest, NextResponse } from 'next/server'
import { buildOAuthUrl } from '@/lib/shopify'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET(_req: NextRequest) {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'SHOPIFY_CLIENT_ID no configurado' }, { status: 500 })
  }

  const shop = process.env.SHOPIFY_SHOP_DOMAIN?.trim()
  if (!shop) {
    return NextResponse.json({ error: 'SHOPIFY_SHOP_DOMAIN no configurado' }, { status: 500 })
  }
  if (!shop.endsWith('.myshopify.com')) {
    return NextResponse.json(
      {
        error: `SHOPIFY_SHOP_DOMAIN debe terminar en .myshopify.com. Valor actual: "${shop}"`,
        hint:  'Ejemplo: mi-tienda.myshopify.com',
      },
      { status: 400 }
    )
  }

  // Generate CSRF state nonce
  const state = crypto.randomBytes(16).toString('hex')

  // Store nonce in a short-lived cookie (5 min)
  const cookieStore = await cookies()
  cookieStore.set('shopify_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   300,
    path:     '/',
  })

  const authUrl = buildOAuthUrl(shop, state)
  return NextResponse.redirect(authUrl)
}
