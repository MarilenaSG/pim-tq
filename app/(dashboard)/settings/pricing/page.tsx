import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { PricingPanel } from './PricingPanel'
import type { PricingRule } from '@/types'

export default async function PricingPage() {
  const supabase = createServerClient()

  const [{ data: rules }, { data: products }] = await Promise.all([
    supabase.from('pricing_rules').select('*').order('updated_at', { ascending: false }),
    supabase.from('products').select('familia, metal, karat'),
  ])

  const toList = (field: 'familia' | 'metal' | 'karat') =>
    Array.from(new Set((products ?? []).map(p => p[field]).filter(Boolean))).sort() as string[]

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Configuración"
        title="Reglas de pricing"
        subtitle="Define márgenes objetivo y redondeo de precio por familia, metal y quilataje — la IA usará la regla más específica al sugerir precios"
      />
      <PricingPanel
        rules={(rules ?? []) as PricingRule[]}
        families={toList('familia')}
        metals={toList('metal')}
        karats={toList('karat')}
      />
    </div>
  )
}
