import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'

interface ExportBody {
  metals?:            string[]
  familias?:          string[]
  categories?:        string[]
  abcs?:              string[]
  marcas?:            string[]
  manualCodes?:       string[]
  includeFinancials?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExportBody
    const supabase = createServiceClient()

    // Resolve marcas → codigo_modelo
    let marcaCodes: string[] | null = null
    if (body.marcas && body.marcas.length > 0) {
      const { data: marcaRows, error: marcaErr } = await supabase
        .from('product_shopify_data')
        .select('codigo_modelo')
        .in('shopify_vendor', body.marcas)
      if (marcaErr) throw new Error(marcaErr.message)
      marcaCodes = (marcaRows ?? []).map(r => r.codigo_modelo as string)
    }

    // Determine final set of codes when manualCodes + filter codes are both present
    let finalCodes: string[] | null = null

    const hasManual  = (body.manualCodes ?? []).length > 0
    const hasFilters = (body.metals?.length ?? 0) > 0      ||
                       (body.familias?.length ?? 0) > 0    ||
                       (body.categories?.length ?? 0) > 0  ||
                       (body.abcs?.length ?? 0) > 0        ||
                       marcaCodes !== null

    if (hasManual && hasFilters) {
      // We need the filter-matched codes first so we can union them
      let filterQuery = supabase
        .from('products')
        .select('codigo_modelo')

      if (body.metals && body.metals.length > 0)
        filterQuery = filterQuery.in('metal', body.metals)
      if (body.familias && body.familias.length > 0)
        filterQuery = filterQuery.in('familia', body.familias)
      if (body.categories && body.categories.length > 0)
        filterQuery = filterQuery.in('category', body.categories)
      if (body.abcs && body.abcs.length > 0)
        filterQuery = filterQuery.in('abc_ventas', body.abcs)
      if (marcaCodes !== null)
        filterQuery = filterQuery.in('codigo_modelo', marcaCodes)

      const { data: filterRows, error: filterErr } = await filterQuery
      if (filterErr) throw new Error(filterErr.message)

      const union = new Set<string>([
        ...(body.manualCodes ?? []),
        ...(filterRows ?? []).map(r => r.codigo_modelo as string),
      ])
      finalCodes = Array.from(union)
    } else if (hasManual) {
      finalCodes = body.manualCodes!
    }
    // If only filters, finalCodes stays null and we apply filters below

    // Main product query
    let query = supabase
      .from('products')
      .select(`
        codigo_modelo, description, category, familia, metal, karat,
        supplier_name, num_variantes, abc_ventas, ingresos_12m
      `)
      .order('abc_ventas', { ascending: true, nullsFirst: false })
      .order('ingresos_12m', { ascending: false, nullsFirst: false })

    if (finalCodes !== null) {
      query = query.in('codigo_modelo', finalCodes)
    } else {
      if (body.metals && body.metals.length > 0)
        query = query.in('metal', body.metals)
      if (body.familias && body.familias.length > 0)
        query = query.in('familia', body.familias)
      if (body.categories && body.categories.length > 0)
        query = query.in('category', body.categories)
      if (body.abcs && body.abcs.length > 0)
        query = query.in('abc_ventas', body.abcs)
      if (marcaCodes !== null)
        query = query.in('codigo_modelo', marcaCodes)
    }

    const { data: products, error } = await query
    if (error) throw new Error(error.message)
    if (!products?.length) throw new Error('No hay productos con los filtros seleccionados')

    const codes = products.map(p => p.codigo_modelo as string)

    const [imagesRes, shopifyRes] = await Promise.all([
      supabase
        .from('product_images')
        .select('codigo_modelo, url')
        .in('codigo_modelo', codes)
        .eq('is_primary', true),
      supabase
        .from('product_shopify_data')
        .select('codigo_modelo, shopify_title, shopify_tags, shopify_status, shopify_vendor')
        .in('codigo_modelo', codes),
    ])

    const imageMap   = Object.fromEntries((imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url as string]))
    const shopifyMap = Object.fromEntries((shopifyRes.data ?? []).map(r => [r.codigo_modelo, r]))

    // Build rows
    const headers = [
      'Código', 'Descripción', 'Categoría', 'Familia', 'Metal', 'Quilates',
      'Proveedor', 'Variantes', 'ABC',
      ...(body.includeFinancials ? ['Ingresos 12m (€)'] : []),
      'Imagen URL', 'Título Shopify', 'Tags Shopify', 'Estado Shopify', 'Marca',
    ]

    const rows = products.map(p => {
      const shopify = shopifyMap[p.codigo_modelo as string]
      return [
        p.codigo_modelo,
        p.description   ?? '',
        p.category      ?? '',
        p.familia       ?? '',
        p.metal         ?? '',
        p.karat         ?? '',
        p.supplier_name ?? '',
        p.num_variantes ?? '',
        p.abc_ventas    ?? '',
        ...(body.includeFinancials ? [p.ingresos_12m ?? ''] : []),
        imageMap[p.codigo_modelo as string]           ?? '',
        shopify?.shopify_title                        ?? '',
        (shopify?.shopify_tags as string[] | null)?.join(', ') ?? '',
        shopify?.shopify_status                       ?? '',
        shopify?.shopify_vendor                       ?? '',
      ]
    })

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    ws['!cols'] = [
      { wch: 10 },  // Código
      { wch: 45 },  // Descripción
      { wch: 12 },  // Categoría
      { wch: 14 },  // Familia
      { wch: 8  },  // Metal
      { wch: 8  },  // Quilates
      { wch: 20 },  // Proveedor
      { wch: 8  },  // Variantes
      { wch: 5  },  // ABC
      ...(body.includeFinancials ? [{ wch: 14 }] : []),
      { wch: 80 },  // Imagen URL
      { wch: 35 },  // Título Shopify
      { wch: 40 },  // Tags
      { wch: 10 },  // Estado
      { wch: 20 },  // Marca
    ]

    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo')

    const dateStr  = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    const filename = `Catalogo-TQ-${dateStr}.xlsx`
    const buffer   = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[export/excel]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
