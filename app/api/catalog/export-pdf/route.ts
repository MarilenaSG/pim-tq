import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import path from 'path'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerClient } from '@/lib/supabase/server'
import { CatalogPDF, CatalogPDFProduct, CatalogPDFFilters } from '@/lib/catalog-pdf'

const LOGO_PATH = path.join(process.cwd(), 'public/brand/icon_cream.png')

const MAX_PRODUCTS = 200

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filters: CatalogPDFFilters = {
    search:   searchParams.get('search')   || undefined,
    metal:    searchParams.get('metal')    || undefined,
    familia:  searchParams.get('familia')  || undefined,
    category: searchParams.get('category') || undefined,
    estado:   (searchParams.get('estado') ?? '') as CatalogPDFFilters['estado'],
  }

  const supabase = createServerClient()

  let query = supabase
    .from('products')
    .select('codigo_modelo, description, category, familia, metal, karat, is_discontinued')
    .order('familia',     { ascending: true, nullsFirst: false })
    .order('description', { ascending: true, nullsFirst: false })
    .limit(MAX_PRODUCTS)

  if (filters.search)   query = query.or(`description.ilike.%${filters.search}%,codigo_modelo.ilike.%${filters.search}%`)
  if (filters.metal)    query = query.eq('metal',    filters.metal)
  if (filters.familia)  query = query.eq('familia',  filters.familia)
  if (filters.category) query = query.eq('category', filters.category)

  const { data: products } = await query
  if (!products?.length) return NextResponse.json({ error: 'No se encontraron productos' }, { status: 404 })

  const codes = products.map(p => p.codigo_modelo)

  const [imagesRes, variantsRes, shopifyRes] = await Promise.all([
    supabase
      .from('product_images')
      .select('codigo_modelo, url')
      .in('codigo_modelo', codes)
      .eq('is_primary', true),
    supabase
      .from('product_variants')
      .select('codigo_modelo, variante, precio_venta, stock_variante, es_variante_lider, is_discontinued')
      .in('codigo_modelo', codes)
      .order('es_variante_lider', { ascending: false }),
    supabase
      .from('product_shopify_data')
      .select('codigo_modelo, shopify_vendor')
      .in('codigo_modelo', codes),
  ])

  const imageMap   = Object.fromEntries((imagesRes.data ?? []).map(r => [r.codigo_modelo as string, r.url as string]))
  const shopifyMap = Object.fromEntries((shopifyRes.data ?? []).map(r => [r.codigo_modelo as string, r.shopify_vendor as string | null]))

  const variantMap = new Map<string, typeof variantsRes.data>()
  for (const v of variantsRes.data ?? []) {
    if (!variantMap.has(v.codigo_modelo)) variantMap.set(v.codigo_modelo, [])
    variantMap.get(v.codigo_modelo)!.push(v)
  }

  const enriched: CatalogPDFProduct[] = products
    .map(p => {
      const variants   = variantMap.get(p.codigo_modelo) ?? []
      const allDisc    = variants.length > 0 && variants.every(v => v.is_discontinued)
      const stockTotal = variants.reduce((s, v) => s + (v.stock_variante ?? 0), 0)

      return {
        codigo_modelo:   p.codigo_modelo,
        description:     p.description   ?? null,
        category:        p.category      ?? null,
        familia:         p.familia       ?? null,
        metal:           p.metal         ?? null,
        karat:           p.karat         ?? null,
        marca:           shopifyMap[p.codigo_modelo] ?? null,
        image_url:       imageMap[p.codigo_modelo]   ?? null,
        is_discontinued: allDisc,
        stock_total:     stockTotal,
        variants: variants.map(v => ({
          variante:        v.variante     ?? null,
          precio_venta:    v.precio_venta ?? null,
          is_discontinued: v.is_discontinued ?? false,
        })),
      }
    })
    .filter(p => {
      if (p.is_discontinued && p.stock_total === 0) return false
      if (filters.estado === 'catalogo')      return !p.is_discontinued
      if (filters.estado === 'descatalogado') return p.is_discontinued
      return true
    })

  if (!enriched.length) return NextResponse.json({ error: 'Sin resultados' }, { status: 404 })

  try {
    const element = React.createElement(CatalogPDF, { products: enriched, filters, options: { logoSrc: LOGO_PATH } })
    const buffer  = await renderToBuffer(element as React.ReactElement)
    const date    = new Date().toISOString().slice(0, 10)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="catalogo-tq-${date}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[catalog/export-pdf]', err)
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 })
  }
}
