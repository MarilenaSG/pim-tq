'use client'

import Link from 'next/link'

const STEPS = [
  { n: 1, label: 'Tipo'         },
  { n: 2, label: 'Producto'     },
  { n: 3, label: 'Distribución' },
  { n: 4, label: 'Referencia'   },
  { n: 5, label: 'Demanda'      },
  { n: 6, label: 'Promoción'    },
  { n: 7, label: 'Simulador'    },
]

interface WizardStepperProps {
  currentStep:    number
  lanzamientoId: string
}

export function WizardStepper({ currentStep, lanzamientoId }: WizardStepperProps) {
  return (
    <div
      className="flex items-center gap-0 px-6 py-3 shrink-0"
      style={{ background: 'white', borderBottom: '1px solid rgba(0,85,127,0.08)' }}
    >
      {STEPS.map((step, i) => {
        const done    = step.n < currentStep
        const active  = step.n === currentStep
        const future  = step.n > currentStep

        return (
          <div key={step.n} className="flex items-center">
            {/* Step bubble */}
            <Link
              href={done ? `/lanzamiento/${lanzamientoId}/paso/${step.n}` : '#'}
              onClick={e => { if (!done) e.preventDefault() }}
              className="flex flex-col items-center gap-1 group"
              style={{ minWidth: 72, textDecoration: 'none' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors"
                style={{
                  background: active ? '#00557f'
                             : done  ? '#3A9E6A'
                             :         'rgba(0,85,127,0.08)',
                  color:      active || done ? 'white' : '#8fa8b8',
                  cursor:     done ? 'pointer' : 'default',
                }}
              >
                {done ? '✓' : step.n}
              </div>
              <span
                className="text-[9px] font-semibold uppercase tracking-wide text-center leading-none whitespace-nowrap"
                style={{
                  color: active ? '#00557f' : done ? '#3A9E6A' : '#b2c4cf',
                }}
              >
                {step.label}
              </span>
            </Link>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className="h-px flex-1 mx-1"
                style={{
                  background: done ? '#3A9E6A' : 'rgba(0,85,127,0.1)',
                  minWidth: 16,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
