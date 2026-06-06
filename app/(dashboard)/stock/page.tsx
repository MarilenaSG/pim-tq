import { PageHeader } from '@/components/ui'

export default function StockDashboardPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Zona Stock y Compras"
        title="Dashboard Stock"
        subtitle="Cobertura, rotación y alertas de rotura y exceso"
      />
      <div
        className="mt-8 rounded-xl p-10 text-center"
        style={{ background: 'rgba(58,158,106,0.06)', border: '1px solid rgba(58,158,106,0.15)' }}
      >
        <p className="text-3xl mb-3">▥</p>
        <p className="text-sm font-semibold text-[#2d7a54]">Dashboard Stock — próximamente</p>
        <p className="text-xs mt-1 text-[#b2b2b2]">Esta sección se implementará en la siguiente sesión.</p>
      </div>
    </div>
  )
}
