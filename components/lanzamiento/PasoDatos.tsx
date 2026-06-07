'use client'

import { useState, useEffect, useCallback } from 'react'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { ValidacionRango } from './ValidacionRango'
import { calcularMb, mbColor } from '@/lib/lanzamiento'
import type { Lanzamiento, MbBenchmark } from '@/types'

const METALES = ['Oro', 'Plata', 'Acero', 'Otro']

// ── MB display en tiempo real ──────────────────────────────────

function MbDisplay({ mb, umbral = 40 }: { mb: number | null; umbral?: number }) {
  if (mb == null) return null
  const color = mbColor(mb, umbral)
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: `${color}15`, border: `1px solid ${color}30` }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
        Margen bruto
      </span>
      <span className="text-xl font-bold" style={{ color }}>
        {mb.toFixed(1)}%
      </span>
      {mb >= umbral && <span style={{ color }}>✓</span>}
      {mb < umbral - 5 && <span style={{ color }}>⚠</span>}
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────

interface PasoDatosProps {
  lanzamiento: Lanzamiento
  familias:    string[]
}

export function PasoDatos({ lanzamiento, familias }: PasoDatosProps) {
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [familia,      setFamilia]      = useState(lanzamiento.familia ?? '')
  const [metal,        setMetal]        = useState(lanzamiento.metal ?? '')
  const [marca,        setMarca]        = useState(lanzamiento.marca ?? '')
  const [pvp,          setPvp]          = useState<string>(lanzamiento.precio_venta?.toString() ?? '')
  const [coste,        setCoste]        = useState<string>(lanzamiento.coste?.toString() ?? '')
  const [benchmark,    setBenchmark]    = useState<MbBenchmark | null>(null)
  const [loadingBench, setLoadingBench] = useState(false)

  const pvpNum   = parseFloat(pvp)   || null
  const costeNum = parseFloat(coste) || null
  const mb       = calcularMb(pvpNum, costeNum)

  // Fetch benchmark cuando cambian familia o pvp
  const fetchBenchmark = useCallback(async (fam: string, precio: number) => {
    if (!fam || precio <= 0) { setBenchmark(null); return }
    setLoadingBench(true)
    try {
      const res  = await fetch(`/api/lanzamiento/mb-benchmark?familia=${encodeURIComponent(fam)}&pvp=${precio}`)
      const data = await res.json() as MbBenchmark
      setBenchmark(data.n > 0 ? data : null)
    } catch {
      setBenchmark(null)
    } finally {
      setLoadingBench(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (familia && pvpNum && pvpNum > 0) fetchBenchmark(familia, pvpNum)
    }, 600)
    return () => clearTimeout(t)
  }, [familia, pvpNum, fetchBenchmark])

  // Handlers con auto-save
  function handleFamilia(v: string) {
    setFamilia(v); save({ familia: v || null })
  }
  function handleMetal(v: string) {
    setMetal(v); save({ metal: v || null })
  }
  function handleMarca(v: string) {
    setMarca(v); save({ marca: v || null })
  }
  function handlePvp(v: string) {
    setPvp(v)
    const n = parseFloat(v)
    if (!isNaN(n)) save({ precio_venta: n })
  }
  function handleCoste(v: string) {
    setCoste(v)
    const n = parseFloat(v)
    if (!isNaN(n)) save({ coste: n })
  }

  async function handleNext() {
    await flush()
    await fetch(`/api/lanzamiento/${lanzamiento.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paso_actual: Math.max(lanzamiento.paso_actual, 3) }),
    })
  }

  const inputStyle = {
    border:     '1.5px solid rgba(0,85,127,0.15)',
    background: 'white',
    color:      '#00264d',
    outline:    'none',
  }

  return (
    <WizardLayout
      step={2}
      lanzamientoId={lanzamiento.id}
      title="Datos del producto"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-paso-2"
        concepto="El precio comunica antes que la pieza. MB = (PVP − Coste) / PVP × 100. Un MB bajo implica menos margen para promoción sin entrar en pérdidas."
        ejemplo="Colgantes de plata 40–60€ tienen MB medio del 58%. Por debajo del 50%, el producto compite con marcas que tienen más presupuesto de marketing."
        consecuencia="Fijar el precio sin revisar el MB de referencias similares es el error más frecuente al lanzar."
      />

      <div className="space-y-5">
        {/* Familia */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
            Familia <span style={{ color: '#C0392B' }}>*</span>
          </label>
          <select
            value={familia}
            onChange={e => handleFamilia(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ ...inputStyle, color: familia ? '#00264d' : '#8fa8b8' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#00557f')}
            onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(0,85,127,0.15)')}
          >
            <option value="">Selecciona una familia…</option>
            {familias.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Metal + Marca */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
              Metal
            </label>
            <div className="flex gap-2 flex-wrap">
              {METALES.map(m => (
                <button
                  key={m}
                  onClick={() => handleMetal(metal === m ? '' : m)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                  style={{
                    background: metal === m ? '#00557f' : 'rgba(0,85,127,0.06)',
                    color:      metal === m ? 'white'  : '#00557f',
                    border:     `1px solid ${metal === m ? '#00557f' : 'transparent'}`,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
              Marca <span className="font-normal" style={{ color: '#c0cfd8' }}>(texto libre)</span>
            </label>
            <input
              type="text"
              value={marca}
              onChange={e => handleMarca(e.target.value)}
              placeholder="Ej: Viceroy, TQ Collection…"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#00557f')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
            />
          </div>
        </div>

        {/* PVP + Coste + MB */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
            Precio de venta (PVP) y coste unitario
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: '#8fa8b8' }}
              >€</span>
              <input
                type="number"
                value={pvp}
                onChange={e => handlePvp(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#00557f')}
                onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: '#8fa8b8' }}
              >PVP</span>
            </div>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: '#8fa8b8' }}
              >€</span>
              <input
                type="number"
                value={coste}
                onChange={e => handleCoste(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#00557f')}
                onBlur={e  => (e.target.style.borderColor = 'rgba(0,85,127,0.15)')}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: '#8fa8b8' }}
              >Coste</span>
            </div>
          </div>

          {/* MB display en tiempo real */}
          {mb != null && (
            <div className="mt-3">
              <MbDisplay mb={mb} />
            </div>
          )}
        </div>

        {/* Validación benchmark */}
        {loadingBench && (
          <p className="text-[11px]" style={{ color: '#8fa8b8' }}>Cargando benchmark histórico…</p>
        )}
        {benchmark && mb != null && (
          <ValidacionRango
            valor={mb}
            min={benchmark.mb_min}
            media={benchmark.mb_medio}
            max={benchmark.mb_max}
            label={`MB — ${familia} · ${pvpNum ? `${pvpNum}€ ±30%` : ''}`}
            unidad="%"
            n={benchmark.n}
            alerta={`El MB introducido (${mb.toFixed(1)}%) está más de 10pp por debajo de la media histórica para esta familia/precio (${benchmark.mb_medio?.toFixed(1)}%). Revisa el coste o el precio antes de continuar.`}
          />
        )}
      </div>
    </WizardLayout>
  )
}
