import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerClient } from '@/lib/supabase/server'
import { CatalogPDF, CatalogPDFProduct, CatalogPDFFilters } from '@/lib/catalog-pdf'

export const dynamic = 'force-dynamic'

// Límite de seguridad para evitar timeouts en Vercel (30s)
const MAX_PRODUCTS = 200

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filters: CatalogPDFFilters = {
      search:   searchParams.get('search')   || undefined,
      metal:    searchParams.get('metal')    || undefined,
      familia:  searchParams.get('familia')  || undefined,
      category: searchParams.get('category') || undefined,
      estado:   searchParams.get('estado')   || undefined,
    }

    const supabase = createServerClient()

    // ── Misma query que catalog/page.tsx ──────────────────────────

    let query = supabase
      .from('products')
      .select('codigo_modelo, description, category, familia, metal, karat, is_discontinued')
      .order('familia',     { ascending: true, nullsFirst: false })
      .order('description', { ascending: true, nullsFirst: false })

    if (filters.search)   query = query.or(`description.ilike.%${filters.search}%,codigo_modelo.ilike.%${filters.search}%`)
    if (filters.metal)    query = query.eq('metal',    filters.metal)
    if (filters.familia)  query = query.eq('familia',  filters.familia)
    if (filters.category) query = query.eq('category', filters.category)

    const { data: products, error: productsError } = await query
    if (productsError) throw productsError
    if (!products?.length) {
      return new NextResponse('No hay productos que coincidan con los filtros seleccionados.', { status: 404 })
    }

    const codes = products.map(p => p.codigo_modelo)

    const [imagesRes, variantsRes, shopifyRes] = await Promise.all([
      supabase
        .from('product_images')
        .select('codigo_modelo, url')
        .in('codigo_modelo', codes)
        .eq('is_primary', true)
        .order('source'),
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

    const imageMap = Object.fromEntries(
      (imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url])
    )

    const variantMap = new Map<string, typeof variantsRes.data>()
    for (const v of (variantsRes.data ?? [])) {
      if (!variantMap.has(v.codigo_modelo)) variantMap.set(v.codigo_modelo, [])
      variantMap.get(v.codigo_modelo)!.push(v)
    }

    const shopifyMap = Object.fromEntries(
      (shopifyRes.data ?? []).map(r => [r.codigo_modelo, r])
    )

    // ── Enriquecimiento ───────────────────────────────────────────

    const enriched: CatalogPDFProduct[] = products
      .map(p => {
        const variants = variantMap.get(p.codigo_modelo) ?? []
        const allDiscontinued = variants.length > 0 && variants.every(v => v.is_discontinued)
        const stockTotal      = variants.reduce((acc, v) => acc + (v.stock_variante ?? 0), 0)

        return {
          codigo_modelo:   p.codigo_modelo,
          description:     p.description,
          category:        p.category,
          familia:         p.familia,
          metal:           p.metal,
          karat:           p.karat,
          marca:           shopifyMap[p.codigo_modelo]?.shopify_vendor ?? null,
          image_url:       imageMap[p.codigo_modelo] ?? null,
          is_discontinued: allDiscontinued,
          stock_total:     stockTotal,
          variants: variants.map(v => ({
            variante:        v.variante,
            precio_venta:    v.precio_venta,
            // Solo exponemos disponibilidad, nunca la cantidad exacta de stock
            is_discontinued: v.is_discontinued ?? false,
          })),
        }
      })
      .filter(p => {
        // Igual que catalog/page.tsx: ocultar si todos descatalogados y sin stock
        if (p.is_discontinued && p.stock_total === 0) return false
        if (filters.estado === 'catalogo')      return !p.is_discontinued
        if (filters.estado === 'descatalogado') return p.is_discontinued
        return true
      })
      // stock_total solo se usó para filtrar, no lo exponemos en el tipo final
      .map(({ stock_total: _st, ...p }) => p)

    if (enriched.length === 0) {
      return new NextResponse('No hay productos que coincidan con los filtros seleccionados.', { status: 404 })
    }

    const limited   = enriched.slice(0, MAX_PRODUCTS)
    const truncated = enriched.length > MAX_PRODUCTS

    // ── Generación del PDF ────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CatalogPDF, { products: limited, filters }) as any
    const buffer  = await renderToBuffer(element)

    const slug  = new Date().toISOString().slice(0, 10)
    const fname = `catalogo-tq-${slug}.pdf`
    void truncated  // info: se trunca silenciosamente; no se expone en el nombre del archivo

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[catalog/export-pdf]', err)
    return new NextResponse('Error al generar el PDF. Inténtalo de nuevo.', { status: 500 })
  }
}
