'use client'

import { useState } from 'react'

interface ValidacionRangoProps {
  valor:    number | null
  min:      number | null
  media:    number | null
  max:      number | null
  label:    string
  unidad?:  string
  alerta:   string
  onOverride?: (nota: string) => void
  n?:       number   // nº de referencias históricas
}

export function ValidacionRango({
  valor, min, media, max, label, unidad = '%', alerta, onOverride, n,
}: ValidacionRangoProps) {
  const [showNote, setShowNote] = useState(false)
  const [nota,    setNota]      = useState('')

  if (media == null || min == null || max == null) return null

  // Determinar si el valor está fuera de rango (más de 10pp por debajo de la media)
  const UMBRAL_ALERTA = 10
  const fueraDeRango  = valor != null && valor < media - UMBRAL_ALERTA
  const enRango       = valor != null && !fueraDeRango

  // Posición del valor en la barra (0–100%)
  const range     = max - min || 1
  const valorPct  = valor != null ? Math.max(0, Math.min(100, ((valor - min) / range) * 100)) : null
  const mediaPct  = Math.max(0, Math.min(100, ((media - min) / range) * 100))

  function fmt(n: number) { return n.toFixed(1) + unidad }

  return (
    <div
      className="rounded-xl p-4 mt-3"
      style={{
        background: fueraDeRango ? 'rgba(192,57,43,0.04)' : 'rgba(0,85,127,0.03)',
        border:     `1px solid ${fueraDeRango ? 'rgba(192,57,43,0.2)' : 'rgba(0,85,127,0.1)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8fa8b8' }}>
          {label} histórico
          {n != null && n > 0 && (
            <span className="ml-1 font-normal" style={{ color: '#c0cfd8' }}>· {n} refs.</span>
          )}
        </p>
        {fueraDeRango && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}
          >
            ⚠ Fuera de rango
          </span>
        )}
        {enRango && valor != null && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(58,158,106,0.1)', color: '#3A9E6A' }}
          >
            ✓ En rango
          </span>
        )}
      </div>

      {/* Barra de rango */}
      <div className="relative h-2 rounded-full mb-1" style={{ background: 'rgba(0,85,127,0.1)' }}>
        {/* Zona normal */}
        <div
          className="absolute h-2 rounded-full"
          style={{
            left:       `${mediaPct - 15}%`,
            width:      '30%',
            background: 'rgba(58,158,106,0.2)',
          }}
        />
        {/* Marcador media */}
        <div
          className="absolute w-0.5 h-2"
          style={{ left: `${mediaPct}%`, background: '#3A9E6A', borderRadius: 1 }}
        />
        {/* Marcador valor actual */}
        {valorPct != null && (
          <div
            className="absolute w-2.5 h-2.5 rounded-full -top-0.5"
            style={{
              left:        `calc(${valorPct}% - 5px)`,
              background:  fueraDeRango ? '#C0392B' : '#00557f',
              border:      '2px solid white',
              boxShadow:   '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        )}
      </div>

      {/* Etiquetas min / media / max */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: '#8fa8b8' }}>{fmt(min)}</span>
        <span className="text-[10px] font-semibold" style={{ color: '#3A9E6A' }}>
          media {fmt(media)}
        </span>
        <span className="text-[10px]" style={{ color: '#8fa8b8' }}>{fmt(max)}</span>
      </div>

      {/* Alerta y justificación */}
      {fueraDeRango && (
        <div className="mt-3">
          <p className="text-[12px]" style={{ color: '#C0392B' }}>{alerta}</p>
          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              className="mt-1.5 text-[11px] font-medium underline"
              style={{ color: '#C0392B' }}
            >
              Justificar motivo y continuar →
            </button>
          ) : (
            <div className="mt-2">
              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Ej: producto premium con coste estructural diferente al histórico…"
                className="w-full border border-red-200 rounded-lg p-2 text-[12px] resize-none"
                rows={2}
                style={{ background: 'rgba(192,57,43,0.02)' }}
              />
              <button
                onClick={() => { onOverride?.(nota); setShowNote(false) }}
                disabled={!nota.trim()}
                className="mt-1.5 text-[11px] font-semibold px-3 py-1 rounded-lg disabled:opacity-40 transition-opacity"
                style={{ background: 'rgba(192,57,43,0.12)', color: '#C0392B' }}
              >
                Guardar justificación
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
