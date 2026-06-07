'use client'

import { useState } from 'react'

interface Props {
  lanzamientoId: string
  paso:           number
  contexto:       Record<string, unknown>
  label?:         string
  /** Desactivar si aún no hay suficiente contexto para pedir sugerencia */
  disabled?:      boolean
  disabledReason?: string
}

/**
 * Panel reutilizable de sugerencia IA.
 * Se usa en pasos del wizard donde un análisis de IA aporta valor.
 * Llama a POST /api/lanzamiento/[id]/sugerencia con el paso y contexto.
 */
export function SugerenciaIA({
  lanzamientoId,
  paso,
  contexto,
  label           = 'Analizar con IA',
  disabled        = false,
  disabledReason  = 'Completa los campos anteriores primero',
}: Props) {
  const [loading,    setLoading]    = useState(false)
  const [resultado,  setResultado]  = useState<string | null>(null)
  const [hasError,   setHasError]   = useState(false)

  async function analizar() {
    if (disabled || loading) return
    setLoading(true)
    setHasError(false)

    try {
      const res = await fetch(`/api/lanzamiento/${lanzamientoId}/sugerencia`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paso, contexto }),
      })
      if (!res.ok) throw new Error('Error de red')
      const data = await res.json()
      setResultado(data.sugerencia ?? null)
    } catch {
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(200,132,42,0.05)',
        border:     '1px solid rgba(200,132,42,0.15)',
      }}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14 }}>💡</span>
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#a06818' }}
          >
            Análisis IA
          </span>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(200,132,42,0.12)', color: '#c8a164' }}
          >
            claude-haiku
          </span>
        </div>

        <div className="flex items-center gap-2">
          {resultado && (
            <button
              onClick={() => setResultado(null)}
              className="text-[10px] font-medium hover:underline"
              style={{ color: '#c0cfd8' }}
            >
              Reiniciar
            </button>
          )}
          {!resultado && (
            <button
              onClick={analizar}
              disabled={disabled || loading}
              title={disabled ? disabledReason : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: 'rgba(200,132,42,0.12)',
                color:      '#a06818',
                cursor:     disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <span
                    className="inline-block w-3 h-3 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(160,104,24,0.25)', borderTopColor: '#a06818' }}
                  />
                  Analizando…
                </>
              ) : (
                label
              )}
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      {!resultado && !loading && !hasError && (
        <p className="text-[11px] leading-relaxed" style={{ color: '#c8a164' }}>
          {disabled
            ? disabledReason
            : 'Pulsa para recibir una recomendación basada en los datos del catálogo.'}
        </p>
      )}

      {resultado && (
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: '#5c4019' }}
        >
          {resultado}
        </p>
      )}

      {hasError && (
        <p className="text-[11px]" style={{ color: '#C0392B' }}>
          Error al conectar con la IA. Comprueba la API key o inténtalo de nuevo.
        </p>
      )}
    </div>
  )
}
