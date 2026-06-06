import { PageHeader } from '@/components/ui'

export default function SellOutPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Ventas"
        title="Sell-out por tienda"
        subtitle="Análisis de ventas por tienda y comparativa entre locales"
      />
      <div
        className="mt-8 rounded-xl p-10 text-center"
        style={{ background: 'rgba(200,132,42,0.06)', border: '1px solid rgba(200,132,42,0.15)' }}
      >
        <p className="text-3xl mb-3">▨</p>
        <p className="text-sm font-semibold text-[#a06818]">Sell-out por tienda — próximamente</p>
        <p className="text-xs mt-1 text-[#b2b2b2]">Esta sección se implementará en la siguiente sesión.</p>
      </div>
    </div>
  )
}
