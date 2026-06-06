import { PageHeader } from '@/components/ui'

export default function TiendasCatalogoPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        eyebrow="Zona Tiendas"
        title="Catálogo"
        subtitle="Catálogo de productos sin datos financieros para equipos de tienda"
      />
      <div
        className="mt-8 rounded-xl p-10 text-center"
        style={{ background: 'rgba(139,94,26,0.06)', border: '1px solid rgba(139,94,26,0.15)' }}
      >
        <p className="text-3xl mb-3">◻</p>
        <p className="text-sm font-semibold text-[#8B5E1A]">Catálogo Tiendas — próximamente</p>
        <p className="text-xs mt-1 text-[#b2b2b2]">Esta sección se implementará en la siguiente sesión.</p>
      </div>
    </div>
  )
}
