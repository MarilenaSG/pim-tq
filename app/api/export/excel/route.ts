import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'

interface ExportBody {
  metals?:            string[]
  familias?:          string[]
  categories?:        string[]
  abcs?:              string[]
  manualCodes?:       string[]
  includeFinancials?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExportBody
    const supabase = createServiceClient()

    const hasManual  = (body.manualCodes ?? []).length > 0
    const hasFilters = (body.metals?.length ?? 0) > 0     ||
                       (body.familias?.length ?? 0) > 0   ||
                       (body.categories?.length ?? 0) > 0 ||
                       (body.abcs?.length ?? 0) > 0

    let finalCodes: string[] | null = null

    if (hasManual && hasFilters) {
      let filterQuery = supabase.from('products').select('codigo_modelo')
      if (body.metals && body.metals.length > 0)
        filterQuery = filterQuery.in('metal', body.metals)
      if (body.familias && body.familias.length > 0)
        filterQuery = filterQuery.in('familia', body.familias)
      if (body.categories && body.categories.length > 0)
        filterQuery = filterQuery.in('category', body.categories)
      if (body.abcs && body.abcs.length > 0)
        filterQuery = filterQuery.in('abc_ventas', body.abcs)

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
    }

    const { data: products, error } = await query
    if (error) throw new Error(error.message)
    if (!products?.length) throw new Error('No hay productos con los filtros seleccionados')

    const codes = products.map(p => p.codigo_modelo as string)

    const { data: imagesData } = await supabase
      .from('product_images')
      .select('codigo_modelo, url')
      .in('codigo_modelo', codes)
      .eq('is_primary', true)

    const imageMap = Object.fromEntries((imagesData ?? []).map(r => [r.codigo_modelo, r.url as string]))

    const headers = [
      'Código', 'Descripción', 'Categoría', 'Familia', 'Metal', 'Quilates',
      'Proveedor', 'Variantes', 'ABC',
      ...(body.includeFinancials ? ['Ingresos 12m (€)'] : []),
      'Imagen URL',
    ]

    const rows = products.map(p => [
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
      imageMap[p.codigo_modelo as string] ?? '',
    ])

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
