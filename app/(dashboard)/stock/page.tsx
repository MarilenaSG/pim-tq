import { PageHeader } from '@/components/ui'
import StockDashboardClient from './StockDashboardClient'

export default function StockDashboardPage() {
  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        eyebrow="Zona Stock y Compras"
        title="Dashboard Stock"
        subtitle="Cobertura, rotación y alertas de rotura y exceso"
      />
      <StockDashboardClient />
    </div>
  )
}
