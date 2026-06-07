'use client'

import Link from 'next/link'
import { getFlow } from '@/lib/wizardFlows'
import type { WizardStepDef } from '@/lib/wizardFlows'

interface WizardStepperProps {
  currentStep:    number
  lanzamientoId: string
  tipo:           string | null
}

export function WizardStepper({ currentStep, lanzamientoId, tipo }: WizardStepperProps) {
  const steps: WizardStepDef[] = getFlow(tipo)

  return (
    <div
      className="flex items-center gap-0 px-4 py-3 shrink-0 overflow-x-auto"
      style={{ background: 'white', borderBottom: '1px solid rgba(0,85,127,0.08)' }}
    >
      {steps.map((step, i) => {
        const done    = step.step < currentStep
        const active  = step.step === currentStep
        const future  = step.step > currentStep

        return (
          <div key={step.step} className="flex items-center shrink-0">
            {/* Step bubble */}
            <Link
              href={done ? `/lanzamiento/${lanzamientoId}/paso/${step.step}` : '#'}
              onClick={e => { if (!done && !active) e.preventDefault() }}
              className="flex flex-col items-center gap-1 group"
              style={{ minWidth: 68, textDecoration: 'none' }}
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
                {done ? '✓' : step.step}
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
            {i < steps.length - 1 && (
              <div
                className="h-px flex-1 mx-1"
                style={{
                  background: done ? '#3A9E6A' : 'rgba(0,85,127,0.1)',
                  minWidth: 12,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
