'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import type { Lanzamiento } from '@/types'

export function PasoMarcaDrop({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [marcaAsociada,    setMarcaAsociada]    = useState(lanzamiento.marca ?? '')
  const [fechaLanzamiento, setFechaLanzamiento] = useState(lanzamiento.fecha_lanzamiento ?? '')
  const [marcasOpciones,   setMarcasOpciones]   = useState<string[]>([])

  // Cargar marcas existentes (shopify_vendor)
  useEffect(() => {
    fetch('/api/products/filter-options')
      .then(r => r.json())
      .then((d: { marcas?: string[] }) => {
        if (Array.isArray(d.marcas)) setMarcasOpciones(d.marcas.filter(Boolean))
      })
      .catch(() => null)
  }, [])

  function handleMarca(v: string) {
    setMarcaAsociada(v)
    save({ marca: v })
  }

  function handleFecha(v: string) {
    setFechaLanzamiento(v)
    save({ fecha_lanzamiento: v || null })
  }

  async function handleNext() {
    await flush()
    router.push(`/lanzamiento/${lanzamiento.id}/paso/3`)
  }

  return (
    <WizardLayout
      step={2}
      tipo="drop"
      lanzamientoId={lanzamiento.id}
      title="Marca del drop"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-drop-marca"
        concepto="Un drop es un lanzamiento coordinado de varias familias dentro de una marca ya posicionada en el catálogo. La marca del drop determina el contexto de precio, el cliente objetivo y la comunicación en tienda. El drop hereda el territorio de su marca: un cliente que conoce la marca ya sabe qué esperar en precio y estilo."
        ejemplo="El Drop de San Valentín de plata sería un drop bajo la marca correspondiente — anillos, pendientes y pulseras en una ventana de 2-3 semanas. Todo el planning (stock, escaparate, RRSS) se hace bajo el umbrella de esa marca para mantener la coherencia."
        consecuencia="Si el drop mezcla marcas distintas, pierde coherencia de comunicación en tienda y en RRSS. Asocia siempre a una sola marca aunque las familias sean mixtas."
      />

      {/* ── Nombre del drop (readonly, viene de paso 1) ── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Nombre del drop
        </label>
        <p className="text-[16px] font-bold" style={{ color: '#00264d' }}>
          {lanzamiento.nombre ?? <span style={{ color: '#8fa8b8' }}>Sin nombre — vuelve al paso 1</span>}
        </p>
      </div>

      {/* ── Marca asociada ────────────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Marca asociada
        </label>
        {marcasOpciones.length > 0 ? (
          <select
            value={marcaAsociada}
            onChange={e => handleMarca(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[14px] font-medium focus:outline-none"
            style={{
              border:  '1.5px solid rgba(0,85,127,0.18)',
              color:   marcaAsociada ? '#00264d' : '#b2b2b2',
              background: 'white',
            }}
          >
            <option value="">— Selecciona una marca —</option>
            {marcasOpciones.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Escribe el nombre de la marca"
            value={marcaAsociada}
            onChange={e => handleMarca(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[14px] focus:outline-none"
            style={{ border: '1.5px solid rgba(0,85,127,0.18)', color: '#00264d' }}
          />
        )}
        {!marcaAsociada && (
          <p className="mt-1.5 text-[11px]" style={{ color: '#C8842A' }}>
            Es obligatorio asociar el drop a una marca
          </p>
        )}
      </div>

      {/* ── Fecha de activación ───────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Fecha de activación del drop
        </label>
        <input
          type="date"
          value={fechaLanzamiento}
          onChange={e => handleFecha(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-[14px] focus:outline-none"
          style={{
            border:     '1.5px solid rgba(0,85,127,0.18)',
            color:      fechaLanzamiento ? '#00264d' : '#b2b2b2',
            background: 'white',
          }}
        />
        <p className="mt-1.5 text-[11px]" style={{ color: '#6b8a9a' }}>
          Define cuándo arrancan las ventas en tienda. Necesaria para calcular el lead-time de compra.
        </p>
      </div>

      {/* ── Resumen ───────────────────────────────────── */}
      {marcaAsociada && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black shrink-0"
            style={{ background: 'rgba(0,85,127,0.12)', color: '#00557f' }}
          >
            💥
          </div>
          <div>
            <p className="text-[12px] font-bold" style={{ color: '#00264d' }}>
              Drop de <span style={{ color: '#00557f' }}>{marcaAsociada}</span>
              {fechaLanzamiento && (
                <span className="font-normal" style={{ color: '#8fa8b8' }}>
                  {' '}— {new Date(fechaLanzamiento + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              )}
            </p>
            <p className="text-[11px]" style={{ color: '#8fa8b8' }}>
              Paso siguiente: selecciona las familias del drop
            </p>
          </div>
        </div>
      )}
    </WizardLayout>
  )
}
