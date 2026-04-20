import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { ExportPanel } from './ExportPanel'

export const dynamic = 'force-dynamic'

interface ProductPickerItem {
  codigo_modelo: string
  description:   string | null
  metal:         string | null
  familia:       string | null
}

async function loadFilterOptions() {
  const supabase = createServerClient()

  const [
    metalsRes,
    familiasRes,
    categoriesRes,
    abcRes,
    marcasRes,
    productsRes,
  ] = await Promise.all([
    supabase.from('products').select('metal').not('metal', 'is', null),
    supabase.from('products').select('familia').not('familia', 'is', null),
    supabase.from('products').select('category').not('category', 'is', null),
    supabase.from('products').select('abc_ventas').not('abc_ventas', 'is', null),
    supabase.from('product_shopify_data').select('shopify_vendor').not('shopify_vendor', 'is', null),
    supabase.from('products').select('codigo_modelo, description, metal, familia').order('codigo_modelo'),
  ])

  const distinct = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T): string[] =>
    Array.from(new Set((rows ?? []).map(r => r[key] as string).filter(Boolean))).sort()

  return {
    metals:     distinct(metalsRes.data,    'metal'),
    familias:   distinct(familiasRes.data,  'familia'),
    categories: distinct(categoriesRes.data,'category'),
    abcs:       ['A', 'B', 'C'].filter(v =>
      (abcRes.data ?? []).some(r => r.abc_ventas === v)
    ),
    marcas:     distinct(marcasRes.data,    'shopify_vendor'),
    products:   (productsRes.data ?? []) as ProductPickerItem[],
  }
}

export default async function ExportPage() {
  const opts = await loadFilterOptions()

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        eyebrow="Herramientas"
        title="Exportar catálogo"
        subtitle="Descarga el catálogo como Excel o actualiza campos en lote con un CSV"
      />
      <ExportPanel
        metals={opts.metals}
        familias={opts.familias}
        categories={opts.categories}
        abcs={opts.abcs}
        marcas={opts.marcas}
        products={opts.products}
      />
    </div>
  )
}
