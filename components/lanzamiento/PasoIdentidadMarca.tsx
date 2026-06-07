'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import type { Lanzamiento } from '@/types'

const POSICIONAMIENTOS = [
  {
    id:          'accesible' as const,
    label:       'Accesible',
    rango:       '20 – 80 €',
    descripcion: 'Plata, acero o chapados. Alta rotación, amplia distribución.',
    color:       '#C8842A',
  },
  {
    id:          'media' as const,
    label:       'Media',
    rango:       '80 – 300 €',
    descripcion: 'Plata de ley, oro 9k–14k. Producto con historia de precio.',
    color:       '#0099f2',
  },
  {
    id:          'premium' as const,
    label:       'Premium',
    rango:       '300 €+',
    descripcion: 'Oro 18k, piedras preciosas. Ticket alto, distribución selectiva.',
    color:       '#3A9E6A',
  },
]

export function PasoIdentidadMarca({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [posicionamiento,  setPosicionamiento]  = useState<'premium' | 'media' | 'accesible' | null>(
    lanzamiento.posicionamiento_marca ?? null,
  )
  const [descripcion,      setDescripcion]      = useState(lanzamiento.descripcion_marca ?? '')
  const [fecha,            setFecha]            = useState(lanzamiento.fecha_lanzamiento ?? '')

  function handlePosicionamiento(v: 'premium' | 'media' | 'accesible') {
    setPosicionamiento(v)
    save({ posicionamiento_marca: v })
  }

  function handleDescripcion(v: string) {
    setDescripcion(v)
    save({ descripcion_marca: v || null })
  }

  function handleFecha(v: string) {
    setFecha(v)
    save({ fecha_lanzamiento: v || null })
  }

  async function handleNext() {
    await flush()
    router.push(`/lanzamiento/${lanzamiento.id}/paso/3`)
  }

  return (
    <WizardLayout
      step={2}
      tipo="marca"
      lanzamientoId={lanzamiento.id}
      title="Identidad de marca"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-marca-identidad"
        concepto="Una nueva marca en el catálogo de Te Quiero define un universo de producto propio: qué familias la componen, dónde se sitúa en precio y cómo se comunica en tienda. Las marcas TQ deben posicionarse más accesibles que las marcas de referencia del mercado — esa es la ventaja competitiva. El posicionamiento que eliges aquí condiciona el rango de precios y la distribución."
        ejemplo="TQ Jewels District será la primera marca urbana de Te Quiero — sale el mes que viene y es la primera de las 7 marcas planificadas. El posicionamiento urbano y accesible define desde aquí el rango de precios, las familias y el tipo de expositor en tienda."
        consecuencia="Una marca lanzada en 19 tiendas sin una identidad clara confunde al equipo de tienda y al cliente. Mejor empezar con distribución controlada (Flagship+Estándar) y ampliar cuando confirmes la aceptación."
      />

      {/* ── Nombre de la marca (from paso 1) ─────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Nombre de la marca
        </label>
        <p className="text-[20px] font-black" style={{ color: '#00264d' }}>
          {lanzamiento.nombre ?? <span className="text-[14px] font-normal" style={{ color: '#c0cfd8' }}>Sin nombre — vuelve al paso 1</span>}
        </p>
      </div>

      {/* ── Posicionamiento ───────────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          Posicionamiento de precio
        </label>
        <div className="grid grid-cols-3 gap-3">
          {POSICIONAMIENTOS.map(p => {
            const active = posicionamiento === p.id
            return (
              <button
                key={p.id}
                onClick={() => handlePosicionamiento(p.id)}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  background: active ? `${p.color}10` : 'white',
                  border:     `2px solid ${active ? p.color : 'rgba(0,85,127,0.1)'}`,
                  boxShadow:  active ? `0 0 0 3px ${p.color}20` : 'var(--tq-shadow-xs)',
                }}
              >
                <p className="text-[13px] font-black mb-0.5" style={{ color: active ? p.color : '#8fa8b8' }}>
                  {p.label}
                </p>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: active ? '#00264d' : '#c0cfd8' }}>
                  {p.rango}
                </p>
                <p className="text-[10px] leading-snug" style={{ color: '#b2b2b2' }}>
                  {p.descripcion}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Concepto / descripción ────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Concepto de marca <span style={{ color: '#c0cfd8' }}>(opcional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="Describe el universo de la marca: a quién apunta, qué la diferencia, qué mensaje quiere transmitir…"
          value={descripcion}
          onChange={e => handleDescripcion(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-[13px] leading-relaxed resize-none focus:outline-none"
          style={{
            border:  '1.5px solid rgba(0,85,127,0.15)',
            color:   '#00264d',
          }}
        />
      </div>

      {/* ── Fecha de lanzamiento ──────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Fecha de lanzamiento prevista
        </label>
        <input
          type="date"
          value={fecha}
          onChange={e => handleFecha(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-[14px] focus:outline-none"
          style={{ border: '1.5px solid rgba(0,85,127,0.18)', color: fecha ? '#00264d' : '#b2b2b2', background: 'white' }}
        />
      </div>
    </WizardLayout>
  )
}
