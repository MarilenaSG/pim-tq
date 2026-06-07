'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardStepper } from './WizardStepper'
import { totalSteps } from '@/lib/wizardFlows'

// ── Auto-save hook ─────────────────────────────────────────────

export function useAutoSave(lanzamientoId: string, delay = 800) {
  const [status, setStatus]  = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const pendingRef           = useRef<Record<string, unknown> | null>(null)
  const timerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((updates: Record<string, unknown>) => {
    pendingRef.current = { ...(pendingRef.current ?? {}), ...updates }
    if (timerRef.current)    clearTimeout(timerRef.current)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setStatus('saving')

    timerRef.current = setTimeout(async () => {
      const data = pendingRef.current
      pendingRef.current = null
      try {
        const res = await fetch(`/api/lanzamiento/${lanzamientoId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Error al guardar')
        setStatus('saved')
        idleTimerRef.current = setTimeout(() => setStatus('idle'), 2000)
      } catch {
        setStatus('error')
      }
    }, delay)
  }, [lanzamientoId, delay])

  // flush inmediato (antes de navegar)
  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!pendingRef.current) return
    const data = pendingRef.current
    pendingRef.current = null
    await fetch(`/api/lanzamiento/${lanzamientoId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    }).catch(() => null)
  }, [lanzamientoId])

  return { save, flush, status }
}

// ── Indicador de guardado ──────────────────────────────────────

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  const cfg = {
    saving: { label: 'Guardando…', color: '#8fa8b8'  },
    saved:  { label: '✓ Guardado', color: '#3A9E6A'  },
    error:  { label: '⚠ Error al guardar', color: '#C0392B' },
  }[status]
  return (
    <span className="text-[11px] font-medium" style={{ color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

// ── WizardLayout ───────────────────────────────────────────────

interface WizardLayoutProps {
  step:           number
  tipo:           string | null
  lanzamientoId: string
  title:          string
  saveStatus:     'idle' | 'saving' | 'saved' | 'error'
  onNext?:        () => Promise<void> | void
  children:       React.ReactNode
}

export function WizardLayout({
  step, tipo, lanzamientoId, title, saveStatus, onNext, children,
}: WizardLayoutProps) {
  const router  = useRouter()
  const nSteps  = totalSteps(tipo)
  const isFirst = step === 1
  const isLast  = step === nSteps

  async function handleNext() {
    await onNext?.()
    if (isLast) return   // el paso final maneja su propia confirmación
    router.push(`/lanzamiento/${lanzamientoId}/paso/${step + 1}`)
  }

  function handleBack() {
    if (isFirst) {
      router.push('/lanzamiento')
    } else {
      router.push(`/lanzamiento/${lanzamientoId}/paso/${step - 1}`)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stepper — tipo-aware */}
      <WizardStepper currentStep={step} lanzamientoId={lanzamientoId} tipo={tipo} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {/* Paso header */}
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#0099f2' }}>
              Paso {step} de {nSteps}
            </p>
            <h1 className="text-xl font-bold" style={{ color: '#00557f', fontFamily: 'inherit' }}>
              {title}
            </h1>
          </div>

          {children}
        </div>
      </div>

      {/* Footer navigation */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background: 'white', borderTop: '1px solid rgba(0,85,127,0.08)' }}
      >
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[rgba(0,85,127,0.05)]"
          style={{ color: '#00557f' }}
        >
          ← {isFirst ? 'Volver al listado' : 'Anterior'}
        </button>

        <SaveIndicator status={saveStatus} />

        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#00557f' }}
        >
          {isLast ? 'Confirmar lanzamiento ✓' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}
