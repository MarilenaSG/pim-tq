'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import type { Lanzamiento } from '@/types'

const FAM_COLORS: Record<string, string> = {
  anillos:    '#3A9E6A',
  pendientes: '#0099f2',
  pulseras:   '#C8842A',
  collares:   '#9B59B6',
  colgantes:  '#00557f',
}

function colorFamilia(nombre: string, idx: number): string {
  const colores = ['#3A9E6A', '#0099f2', '#C8842A', '#9B59B6', '#00557f', '#C0392B', '#16A085']
  return FAM_COLORS[nombre.toLowerCase()] ?? colores[idx % colores.length]
}

export function PasoFamiliasMarca({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [familiasSeleccionadas, setFamiliasSeleccionadas] = useState<string[]>(
    lanzamiento.familias_marca ?? [],
  )
  const [familiasOpciones, setFamiliasOpciones] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/products/filter-options')
      .then(r => r.json())
      .then((d: { familias?: string[] }) => {
        if (Array.isArray(d.familias)) setFamiliasOpciones(d.familias.filter(Boolean))
      })
      .catch(() => null)
  }, [])

  function toggleFamilia(nombre: string) {
    const next = familiasSeleccionadas.includes(nombre)
      ? familiasSeleccionadas.filter(f => f !== nombre)
      : [...familiasSeleccionadas, nombre]
    setFamiliasSeleccionadas(next)
    save({ familias_marca: next })
  }

  async function handleNext() {
    await flush()
    router.push(`/lanzamiento/${lanzamiento.id}/paso/4`)
  }

  const posLabel = {
    premium:   'Premium · 300€+',
    media:     'Media · 80–300€',
    accesible: 'Accesible · 20–80€',
  }[lanzamiento.posicionamiento_marca ?? ''] ?? null

  return (
    <WizardLayout
      step={3}
      tipo="marca"
      lanzamientoId={lanzamiento.id}
      title="Familias de la marca"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-marca-familias"
        concepto="¿Qué familias de producto va a tener esta marca en el catálogo de Te Quiero? Las marcas completas suelen arrancar con 6-7 familias. Las marcas en fase inicial o más pequeñas empiezan con 3-4. En el paso siguiente definirás los rangos de precio de cada familia."
        ejemplo="Para TQ Jewels District — marca urbana — probablemente arrancaréis con 3-4 familias que mejor representen el estilo urbano: las que tengan más claridad de producto y más facilidad de comunicar en escaparate. El resto de familias se pueden añadir en el segundo año."
        consecuencia="Más familias = más complejidad de planning y más inversión inicial en stock. Empieza con pocas familias bien abastecidas antes que con muchas a medias."
      />

      {/* ── Contexto de la marca ──────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
        style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)' }}
      >
        <span className="text-[20px]">✨</span>
        <div>
          <p className="text-[13px] font-black" style={{ color: '#00264d' }}>
            {lanzamiento.nombre ?? '—'}
          </p>
          {posLabel && (
            <p className="text-[11px]" style={{ color: '#8fa8b8' }}>{posLabel}</p>
          )}
        </div>
      </div>

      {/* ── Selector de familias ──────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8fa8b8' }}>
          Familias del catálogo
        </label>

        {familiasOpciones.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {familiasOpciones.map((fam, idx) => {
              const sel   = familiasSeleccionadas.includes(fam)
              const color = colorFamilia(fam, idx)
              return (
                <button
                  key={fam}
                  onClick={() => toggleFamilia(fam)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={{
                    background: sel ? `${color}14` : 'white',
                    border:     `2px solid ${sel ? color : 'rgba(0,85,127,0.1)'}`,
                    color:      sel ? color : '#8fa8b8',
                    boxShadow:  sel ? `0 0 0 2px ${color}18` : 'var(--tq-shadow-xs)',
                  }}
                >
                  {sel && <span>✓</span>}
                  {fam}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: '#b2b2b2' }}>Cargando familias…</p>
        )}
      </div>

      {/* ── Resumen ───────────────────────────────────── */}
      {familiasSeleccionadas.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.08)' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8fa8b8' }}>
            {familiasSeleccionadas.length} familia{familiasSeleccionadas.length > 1 ? 's' : ''} seleccionada{familiasSeleccionadas.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {familiasSeleccionadas.map((fam, idx) => (
              <span
                key={fam}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${colorFamilia(fam, idx)}18`, color: colorFamilia(fam, idx) }}
              >
                {fam}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: '#b2b2b2' }}>
            Siguiente: define la arquitectura de precios para cada familia
          </p>
        </div>
      )}

      {familiasSeleccionadas.length === 0 && (
        <p className="text-center text-[12px] py-4" style={{ color: '#c0cfd8' }}>
          Selecciona al menos una familia para continuar
        </p>
      )}
    </WizardLayout>
  )
}
