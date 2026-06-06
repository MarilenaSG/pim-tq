import { PageHeader } from '@/components/ui'
import VentasDashboardClient from './VentasDashboardClient'

export default function VentasDashboardPage() {
  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        eyebrow="Zona Ventas"
        title="Dashboard Ventas"
        subtitle="Sell-out por modelo, evolución mensual y contribución por familia"
      />
      <VentasDashboardClient />
    </div>
  )
}
