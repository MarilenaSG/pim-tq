import { ReactNode, Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { AnalyticsTabs } from './AnalyticsTabs'
import { FilterBar } from './FilterBar'

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  const supabase = createServerClient()

  const { data: products } = await supabase
    .from('products')
    .select('familia, metal, shopify_vendor')
    .not('familia', 'is', null)

  const familias   = Array.from(new Set((products ?? []).map(p => p.familia       as string).filter(Boolean))).sort()
  const metales    = Array.from(new Set((products ?? []).map(p => p.metal         as string).filter(Boolean))).sort()
  const suppliers  = Array.from(new Set((products ?? []).map(p => p.shopify_vendor as string).filter(Boolean))).sort()

  return (
    <div className="min-h-screen bg-[var(--tq-bg)]">
      <div className="bg-white border-b border-[#e2ddd9] px-8 overflow-x-auto">
        <Suspense fallback={<div className="h-[52px]" />}>
          <AnalyticsTabs />
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-[44px] border-b border-[#e2ddd9] bg-[#faf8f6]" />}>
        <FilterBar familias={familias} metales={metales} suppliers={suppliers} />
      </Suspense>
      <div className="p-8 max-w-7xl">
        {children}
      </div>
    </div>
  )
}
