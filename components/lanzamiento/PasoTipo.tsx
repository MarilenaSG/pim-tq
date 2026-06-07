'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import type { Lanzamiento, LanzamientoTipo } from '@/types'

// ── Tipos de lanzamiento ──────────────────────────────────────

const TIPOS: {
  id:          LanzamientoTipo
  icon:        string
  label:       string
  descripcion: string
}[] = [
  {
    id:          'sku',
    icon:        '◻',
    label:       'SKU nuevo',
    descripcion: 'Un producto concreto de una marca existente en catálogo TQ.',
  },
  {
    id:          'marca',
    icon:        '◈',
    label:       'Marca nueva',
    descripcion: 'Una marca que aún no existe en el catálogo. Se usarán referencias análogas.',
  },
  {
    id:          'drop',
    icon:        '▼',
    label:       'Drop / Edición limitada',
    descripcion: 'Ventana temporal corta. El stock no rotado en su ventana es stock muerto.',
  },
]

// ── Componente ────────────────────────────────────────────────

export function PasoTipo({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [tipo,              setTipo]              = useState<LanzamientoTipo | null>(lanzamiento.tipo)
  const [nombre,            setNombre]            = useState(lanzamiento.nombre ?? '')
  const [fechaLanzamiento,  setFechaLanzamiento]  = useState(lanzamiento.fecha_lanzamiento ?? '')
  const [proveedor,         setProveedor]         = useState(lanzamiento.proveedor ?? '')

  function handleTipo(t: LanzamientoTipo) {
    setTipo(t)
    save({ tipo: t, paso_actual: Math.max(lanzamiento.paso_actual, 1) })
  }

  function handleNombre(v: string) {
    setNombre(v)
    save({ nombre: v })
  }

  function handleFecha(v: string) {
    setFechaLanzamiento(v)
    save({ fecha_lanzamiento: v || null })
  }

  function handleProveedor(v: string) {
    setProveedor(v)
    save({ proveedor: v || null })
  }

  async function handleNext() {
    await flush()
    // paso_actual avanza
    await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paso_actual: Math.max(lanzamiento.paso_actual, 2) }),
    })
    router.push(`/lanzamiento/${lanzamiento.id}/paso/2`)
  }

  return (
    <WizardLayout
      step={1}
      lanzamientoId={lanzamiento.id}
      title="Tipo de lanzamiento"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-1"
        concepto="¿Qué tipo de lanzamiento es este? El tipo define el alcance del planning. Un SKU nuevo tiene curva predecible porque hay histórico de esa marca. Una marca nueva no tiene histórico propio — el sistema buscará referencias análogas. Un drop tiene ventana corta: si te quedas sin stock en la semana 3, perdiste la ventana."
        ejemplo="La incorporación de los anillos de Viceroy fue una marca nueva. Partimos de la curva de los anillos de Festina en el mismo rango de precio como base."
        consecuencia="Si lo clasificas mal, el benchmark del paso 4 puede no ser relevante."
      />

      {/* Selector tipo */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        {TIPOS.map(t => {
          const active = tipo === t.id
          return (
            <button
              key={t.id}
              onClick={() => handleTipo(t.id)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background:  active ? 'rgba(0,85,127,0.06)' : 'white',
                border:      `2px solid ${active ? '#00557f' : 'rgba(0,85,127,0.1)'}`,
                boxShadow:   active ? '0 0 0 3px rgba(0,85,127,0.08)' : 'var(--tq-shadow-xs)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-lg"
                  style={{ color: active ? '#00557f' : '#8fa8b8' }}
                >
                  {t.icon}
                </span>
                {active && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: '#00557f', color: 'white' }}
                  >
                    Seleccionado
                  </span>
                )}
              </div>
              <p
                className="text-[13px] font-semibold leading-tight mb-1"
                style={{ color: active ? '#00557f' : '#00264d' }}
              >
                {t.label}
              </p>
              <p className="text-[11px] leading-snug" style={{ color: '#8fa8b8' }}>
                {t.descripcion}
              </p>
            </button>
          )
        })}
      </div>

      {/* Campos */}
      <div className="space-y-4">
        {/* Nombre */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
            Nombre del lanzamiento <span style={{ color: '#C0392B' }}>*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => handleNombre(e.target.value)}
            placeholder="Ej: Colección Verano Oro 2026 — Anillo Solitario"
            className="w-full rounded-lg px-3 py-2.5 text-sm transition-colors"
            style={{
              border:     '1.5px solid rgba(0,85,127,0.15)',
              background: 'white',
              color:      '#00264d',
              outline:    'none',
            }}
            onFocus={e => (e.target.style.borderColor = '#00557f')}
            onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
          />
        </div>

        {/* Fecha + Proveedor en 2 columnas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
              Fecha de lanzamiento prevista
            </label>
            <input
              type="date"
              value={fechaLanzamiento}
              onChange={e => handleFecha(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{
                border:     '1.5px solid rgba(0,85,127,0.15)',
                background: 'white',
                color:      fechaLanzamiento ? '#00264d' : '#b2b2b2',
                outline:    'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#00557f')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
              Proveedor <span className="font-normal" style={{ color: '#c0cfd8' }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={e => handleProveedor(e.target.value)}
              placeholder="Ej: Viceroy, Festina…"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{
                border:     '1.5px solid rgba(0,85,127,0.15)',
                background: 'white',
                color:      '#00264d',
                outline:    'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#00557f')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
            />
          </div>
        </div>
      </div>

      {/* Hint si no hay tipo */}
      {!tipo && (
        <p className="mt-5 text-[12px]" style={{ color: '#C8842A' }}>
          ↑ Selecciona el tipo de lanzamiento para continuar
        </p>
      )}
    </WizardLayout>
  )
}
