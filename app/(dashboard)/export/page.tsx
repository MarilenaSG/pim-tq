import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { ShopifyCsvTab } from './ShopifyCsvTab'

async function getFilterOptions() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('products')
    .select('familia, metal, abc_ventas')
    .eq('is_discontinued', false)

  const rows = data ?? []
  const uniq = (key: 'familia' | 'metal' | 'abc_ventas') =>
    Array.from(new Set(rows.map(r => r[key]).filter((v): v is string => !!v))).sort()

  return {
    familias: uniq('familia'),
    metals:   uniq('metal'),
    abcs:     uniq('abc_ventas'),
  }
}

async function getShopifySummary() {
  const supabase = createServerClient()
  const [totalRes, syncedRes, warningsRes] = await Promise.all([
    supabase.from('products').select('codigo_modelo', { count: 'exact', head: true }).eq('is_discontinued', false),
    supabase.from('product_shopify_data').select('codigo_modelo', { count: 'exact', head: true }),
    supabase.from('product_shopify_data').select('shopify_description, shopify_seo_title, shopify_tags').is('shopify_description', null),
  ])

  return {
    totalProducts:       totalRes.count ?? 0,
    syncedProducts:      syncedRes.count ?? 0,
    sinDescripcion:      warningsRes.count ?? 0,
  }
}

export default async function ExportPage() {
  const [opts, summary] = await Promise.all([getFilterOptions(), getShopifySummary()])

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Exportación"
        title="Shopify CSV"
        subtitle="Genera el CSV de importación de productos para Shopify"
      />
      <ShopifyCsvTab
        familias={opts.familias}
        metals={opts.metals}
        abcs={opts.abcs}
        totalProducts={summary.totalProducts}
        syncedProducts={summary.syncedProducts}
        sinDescripcion={summary.sinDescripcion}
      />
    </div>
  )
}
