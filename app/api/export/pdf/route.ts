import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { CatalogDocument, type PdfProduct } from '@/lib/pdf-catalog'
import { createServiceClient } from '@/lib/supabase/server'

interface ExportBody {
  metals?:          string[]
  familias?:        string[]
  categories?:      string[]
  abcs?:            string[]
  marcas?:          string[]
  manualCodes?:     string[]
}

export async function POST(req: NextRequest) {
  try {
    const body      = await req.json() as ExportBody
    const supabase  = createServiceClient()

    // Resolve marcas → codes
    let marcaCodes: string[] | null = null
    if (body.marcas && body.marcas.length > 0) {
      const { data } = await supabase
        .from('product_shopify_data')
        .select('codigo_modelo')
        .in('shopify_vendor', body.marcas)
      marcaCodes = (data ?? []).map(r => r.codigo_modelo as string)
    }

    // Determine final codes (same logic as excel route)
    const hasManual  = (body.manualCodes ?? []).length > 0
    const hasFilters = (body.metals?.length ?? 0) > 0   ||
                       (body.familias?.length ?? 0) > 0 ||
                       (body.categories?.length ?? 0) > 0 ||
                       (body.abcs?.length ?? 0) > 0     ||
                       marcaCodes !== null

    let finalCodes: string[] | null = null

    if (hasManual && hasFilters) {
      let fq = supabase.from('products').select('codigo_modelo')
      if (body.metals?.length)      fq = fq.in('metal',      body.metals)
      if (body.familias?.length)    fq = fq.in('familia',    body.familias)
      if (body.categories?.length)  fq = fq.in('category',   body.categories)
      if (body.abcs?.length)        fq = fq.in('abc_ventas', body.abcs)
      if (marcaCodes)               fq = fq.in('codigo_modelo', marcaCodes)
      const { data: fRows } = await fq
      finalCodes = Array.from(new Set([...body.manualCodes!, ...(fRows ?? []).map(r => r.codigo_modelo as string)]))
    } else if (hasManual) {
      finalCodes = body.manualCodes!
    }

    // Main product query
    let query = supabase
      .from('products')
      .select('codigo_modelo, description, metal, karat, familia, num_variantes')
      .order('familia',     { ascending: true, nullsFirst: false })
      .order('description', { ascending: true, nullsFirst: false })

    if (finalCodes) {
      query = query.in('codigo_modelo', finalCodes)
    } else {
      if (body.metals?.length)      query = query.in('metal',      body.metals)
      if (body.familias?.length)    query = query.in('familia',    body.familias)
      if (body.categories?.length)  query = query.in('category',   body.categories)
      if (body.abcs?.length)        query = query.in('abc_ventas', body.abcs)
      if (marcaCodes)               query = query.in('codigo_modelo', marcaCodes)
    }

    const { data: products, error } = await query
    if (error) throw new Error(error.message)
    if (!products?.length) throw new Error('No hay productos con los filtros seleccionados')

    const codes = products.map(p => p.codigo_modelo as string)

    // Fetch supplementary data
    const [imagesRes, shopifyRes, variantsRes] = await Promise.all([
      supabase.from('product_images')
        .select('codigo_modelo, url, source')
        .in('codigo_modelo', codes)
        .eq('is_primary', true),
      supabase.from('product_shopify_data')
        .select('codigo_modelo, shopify_vendor, shopify_description, shopify_tags, shopify_status')
        .in('codigo_modelo', codes),
      supabase.from('product_variants')
        .select('codigo_modelo, precio_venta, es_variante_lider')
        .in('codigo_modelo', codes)
        .eq('es_variante_lider', true),
    ])

    const imageMap   = Object.fromEntries(
      (imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url as string])
    )
    const shopifyMap = Object.fromEntries(
      (shopifyRes.data ?? []).map(r => [r.codigo_modelo, r])
    )
    const priceMap   = Object.fromEntries(
      (variantsRes.data ?? []).map(r => [r.codigo_modelo, r.precio_venta as number | null])
    )

    const pdfProducts: PdfProduct[] = products.map(p => {
      const shopify = shopifyMap[p.codigo_modelo as string]
      return {
        codigo_modelo:       p.codigo_modelo as string,
        description:         p.description as string | null,
        metal:               p.metal as string | null,
        karat:               p.karat as string | null,
        familia:             p.familia as string | null,
        precio_venta:        priceMap[p.codigo_modelo as string] ?? null,
        image_url:           imageMap[p.codigo_modelo as string] ?? null,
        marca:               shopify?.shopify_vendor        ?? null,
        shopify_description: shopify?.shopify_description   ?? null,
        shopify_tags:        (shopify?.shopify_tags as string[] | null) ?? null,
        shopify_status:      shopify?.shopify_status        ?? null,
      }
    })

    const dateStr  = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    const filename = `Catalogo-TQ-${dateStr}.pdf`

    const buffer = await renderToBuffer(
      React.createElement(CatalogDocument, { products: pdfProducts })
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[export/pdf]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
