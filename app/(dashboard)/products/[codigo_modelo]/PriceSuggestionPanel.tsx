'use client'

import { useState } from 'react'
import type { PriceSuggestion } from '@/app/api/ai/price-suggestion/route'

interface Props { codigoModelo: string }

export function PriceSuggestionPanel({ codigoModelo }: Props) {
  const [result,  setResult]  = useState<PriceSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function suggest() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/ai/price-suggestion', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo_modelo: codigoModelo }),
      })
      const data = await res.json() as PriceSuggestion & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error desconocido')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0ece8]">
        <div className="flex items-center gap-2.5">
          <span style={{ color: '#C8842A' }}>⊞</span>
          <div>
            <p className="text-sm font-semibold text-[#00557f]">Sugerencia de precio</p>
            <p className="text-xs" style={{ color: '#b2b2b2' }}>
              Basada en coste, reglas de pricing y clasificación ABC · claude-sonnet-4-6
            </p>
          </div>
        </div>
        <button
          onClick={suggest}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: loading ? '#f0ece8' : '#C8842A', color: loading ? '#b2b2b2' : '#fff' }}
        >
          {loading ? <><span className="animate-spin inline-block text-xs">◌</span> Calculando…</> : result ? '↻ Recalcular' : '⊞ Sugerir precio'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-3 text-sm" style={{ color: '#C0392B', background: 'rgba(192,57,43,0.04)' }}>
          Error: {error}
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div className="px-5 py-5 space-y-4">
          {/* Price cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.1)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#b2b2b2' }}>Precio sugerido</p>
              <p className="text-2xl font-bold text-[#00557f]">
                {result.precio_venta_sugerido.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(200,132,42,0.04)', border: '1px solid rgba(200,132,42,0.1)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#b2b2b2' }}>Precio tachado</p>
              <p className="text-2xl font-bold text-[#C8842A]">
                {result.precio_tachado_sugerido
                  ? result.precio_tachado_sugerido.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                  : <span className="text-base font-normal" style={{ color: '#b2b2b2' }}>Sin descuento</span>
                }
              </p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{
              background: result.margen_resultante >= 45 ? 'rgba(58,158,106,0.06)' : 'rgba(192,57,43,0.06)',
              border: `1px solid ${result.margen_resultante >= 45 ? 'rgba(58,158,106,0.2)' : 'rgba(192,57,43,0.2)'}`,
            }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#b2b2b2' }}>Margen resultante</p>
              <p className="text-2xl font-bold" style={{ color: result.margen_resultante >= 45 ? '#3A9E6A' : '#C0392B' }}>
                {result.margen_resultante.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Razonamiento */}
          <div className="rounded-xl px-4 py-3" style={{ background: '#fdf3e4', border: '1px solid rgba(200,132,42,0.15)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#C8842A' }}>Razonamiento</p>
            <p className="text-sm text-[#1d1d1b]" style={{ lineHeight: 1.6 }}>{result.razonamiento}</p>
          </div>

          {/* Alertas */}
          {result.alertas.length > 0 && (
            <div className="space-y-1.5">
              {result.alertas.map((alerta, i) => (
                <div key={i} className="flex items-start gap-2 text-sm rounded-lg px-3 py-2"
                  style={{ background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.12)' }}>
                  <span style={{ color: '#C0392B' }}>⚠</span>
                  <span style={{ color: '#C0392B' }}>{alerta}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px]" style={{ color: '#b2b2b2' }}>
            Sugerencia orientativa · No sobreescribe precios de Metabase · Revisa antes de aplicar
          </p>
        </div>
      )}

      {!result && !error && !loading && (
        <div className="px-5 py-4 text-xs" style={{ color: '#b2b2b2' }}>
          Haz clic en &quot;Sugerir precio&quot; para calcular el PVP óptimo con IA
        </div>
      )}
    </div>
  )
}
