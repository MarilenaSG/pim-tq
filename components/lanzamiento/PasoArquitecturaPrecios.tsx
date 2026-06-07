'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { mbColor } from '@/lib/lanzamiento'
import type { Lanzamiento, ArquitecturaPreciosFamilia } from '@/types'

// ── Fila de arquitectura de una familia ───────────────────────

function FilaFamilia({
  familia,
  data,
  color,
  onChange,
}: {
  familia:  string
  data:     ArquitecturaPreciosFamilia
  color:    string
  onChange: (next: ArquitecturaPreciosFamilia) => void
}) {
  const ambito = data.min != null && data.max != null
    ? `${data.min}€ – ${data.max}€`
    : null

  return (
    <div
      className="rounded-xl p-4"
      style={{ border: `1.5px solid ${color}25`, background: 'white' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-black" style={{ color }}>{familia}</span>
        {ambito && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}12`, color }}>
            {ambito}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'min' as const,   label: 'Precio mínimo', hint: 'ticket más bajo de la familia' },
          { key: 'medio' as const, label: 'Precio medio',  hint: 'referencia para la proyección' },
          { key: 'max' as const,   label: 'Precio máximo', hint: 'ticket más alto' },
        ] as { key: keyof ArquitecturaPreciosFamilia; label: string; hint: string }[]).map(({ key, label, hint }) => (
          <div key={key}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8fa8b8' }}>{label}</p>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={5}
                placeholder="—"
                value={data[key] ?? ''}
                onChange={e => onChange({ ...data, [key]: parseFloat(e.target.value) || null })}
                className="w-full rounded-lg pl-5 pr-2 py-1.5 text-[13px] font-bold focus:outline-none"
                style={{ border: '1.5px solid rgba(0,85,127,0.15)', color: '#00264d' }}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: '#8fa8b8' }}>€</span>
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: '#8fa8b8' }}>{hint}</p>
          </div>
        ))}
      </div>

      {/* Indicador de amplitud del rango */}
      {data.min != null && data.max != null && data.min < data.max && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${color}18` }}>
          <div className="relative h-1.5 rounded-full" style={{ background: `${color}18` }}>
            <div
              className="absolute h-full rounded-full"
              style={{ background: color, width: '100%' }}
            />
            {data.medio != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
                style={{
                  background: color,
                  left: `${Math.min(100, Math.max(0, ((data.medio - data.min) / (data.max - data.min)) * 100))}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px]" style={{ color: '#8fa8b8' }}>{data.min}€</span>
            {data.medio != null && (
              <span className="text-[9px] font-bold" style={{ color }}>med. {data.medio}€</span>
            )}
            <span className="text-[9px]" style={{ color: '#8fa8b8' }}>{data.max}€</span>
          </div>
        </div>
      )}
    </div>
  )
}

const FAM_COLORS = ['#3A9E6A', '#0099f2', '#C8842A', '#9B59B6', '#00557f', '#C0392B']

// ── Componente principal ──────────────────────────────────────

export function PasoArquitecturaPrecios({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const familias = lanzamiento.familias_marca ?? []
  const [arquitectura, setArquitectura] = useState<Record<string, ArquitecturaPreciosFamilia>>(
    (lanzamiento.arquitectura_precios as Record<string, ArquitecturaPreciosFamilia> | null) ?? {},
  )

  function updateFamilia(fam: string, data: ArquitecturaPreciosFamilia) {
    const next = { ...arquitectura, [fam]: data }
    setArquitectura(next)
    // precio_venta = media de todos los precios medios definidos (determinista)
    const medios = Object.values(next).map(v => v.medio).filter((v): v is number => v != null)
    const pMedio = medios.length > 0 ? Math.round(medios.reduce((a, b) => a + b, 0) / medios.length) : null
    save({ arquitectura_precios: next, precio_venta: pMedio })
  }

  async function handleNext() {
    await flush()
    router.push(`/lanzamiento/${lanzamiento.id}/paso/5`)
  }

  // Chequeo de completitud
  const familiasCompletas = familias.filter(f => {
    const d = arquitectura[f]
    return d && d.min != null && d.medio != null && d.max != null
  })

  return (
    <WizardLayout
      step={4}
      tipo="marca"
      lanzamientoId={lanzamiento.id}
      title="Arquitectura de precios"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-marca-precios"
        concepto="Define el rango de precios de cada familia: mínimo (el ticket más bajo), precio medio (referencia para la proyección financiera) y máximo (el producto más caro). Las marcas TQ deben ser más accesibles que las marcas de referencia del mercado — se fijan en el margen objetivo y en la competencia, con la ventaja de precio como diferenciador. El precio medio es el que usa el simulador para calcular ingresos."
        ejemplo="Para una marca urbana de posicionamiento 'accesible': Anillos 35€–65€–120€ · Pendientes 25€–50€–90€ · Pulseras 30€–60€–110€. Comparando con la marca de referencia del mercado en ese estilo, TQ ofrece mejor accesibilidad manteniendo el MB objetivo (45-65%)."
        consecuencia="Si los rangos de distintas familias se solapan mucho, la marca pierde coherencia en tienda. Cada familia debe tener su territorio de precio claro para que el equipo de ventas pueda orientar al cliente."
      />

      {familias.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px]" style={{ color: '#6b8a9a' }}>
            No hay familias seleccionadas. Vuelve al paso anterior.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-5">
            {familias.map((fam, idx) => (
              <FilaFamilia
                key={fam}
                familia={fam}
                data={arquitectura[fam] ?? { min: null, medio: null, max: null }}
                color={FAM_COLORS[idx % FAM_COLORS.length]}
                onChange={data => updateFamilia(fam, data)}
              />
            ))}
          </div>

          {/* Progreso */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.08)' }}
          >
            <span className="text-[11px]" style={{ color: '#8fa8b8' }}>
              {familiasCompletas.length}/{familias.length} familias con precios definidos
            </span>
            <div className="flex gap-1">
              {familias.map((fam, idx) => {
                const completa = familiasCompletas.includes(fam)
                return (
                  <div
                    key={fam}
                    className="w-2 h-2 rounded-full"
                    style={{ background: completa ? FAM_COLORS[idx % FAM_COLORS.length] : 'rgba(0,85,127,0.1)' }}
                  />
                )
              })}
            </div>
          </div>
        </>
      )}
    </WizardLayout>
  )
}
