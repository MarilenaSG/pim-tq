'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout, useAutoSave } from './WizardLayout'
import { CoachingPanel } from './CoachingPanel'
import { fmtEur } from '@/lib/lanzamiento'
import type { Lanzamiento, FamiliaDropItem } from '@/types'

// ── Familia card dentro del drop ──────────────────────────────

function FamiliaCard({
  item,
  color,
  onChange,
  onRemove,
}: {
  item:     FamiliaDropItem
  color:    string
  onChange: (next: FamiliaDropItem) => void
  onRemove: () => void
}) {
  const margen = item.precio_medio && item.coste_medio
    ? ((item.precio_medio - item.coste_medio) / item.precio_medio) * 100
    : null

  return (
    <div
      className="rounded-xl p-4"
      style={{ border: `1.5px solid ${color}30`, background: `${color}06` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-black" style={{ color }}>
          {item.familia}
        </span>
        <button
          onClick={onRemove}
          className="text-[11px] font-medium hover:opacity-70"
          style={{ color: '#b2b2b2' }}
        >
          × quitar
        </button>
      </div>

      {/* Inputs en grid */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Uds.</p>
          <input
            type="number"
            min={1}
            value={item.uds}
            onChange={e => onChange({ ...item, uds: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full rounded-lg px-2 py-1.5 text-[13px] font-bold text-center focus:outline-none"
            style={{ border: '1.5px solid rgba(0,85,127,0.15)', color: '#00264d' }}
          />
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>PVP medio</p>
          <input
            type="number"
            min={0}
            step={5}
            placeholder="€"
            value={item.precio_medio ?? ''}
            onChange={e => onChange({ ...item, precio_medio: parseFloat(e.target.value) || null })}
            className="w-full rounded-lg px-2 py-1.5 text-[13px] font-bold text-center focus:outline-none"
            style={{ border: '1.5px solid rgba(0,85,127,0.15)', color: '#00264d' }}
          />
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#b2b2b2' }}>Coste medio</p>
          <input
            type="number"
            min={0}
            step={5}
            placeholder="€"
            value={item.coste_medio ?? ''}
            onChange={e => onChange({ ...item, coste_medio: parseFloat(e.target.value) || null })}
            className="w-full rounded-lg px-2 py-1.5 text-[13px] font-bold text-center focus:outline-none"
            style={{ border: '1.5px solid rgba(0,85,127,0.15)', color: '#00264d' }}
          />
        </div>
      </div>

      {/* Mini resumen */}
      <div className="flex items-center gap-4 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${color}20` }}>
        <span className="text-[10px]" style={{ color: '#b2b2b2' }}>
          Coste total: <strong style={{ color: '#00264d' }}>
            {item.coste_medio ? fmtEur(item.uds * item.coste_medio) : '—'}
          </strong>
        </span>
        {margen != null && (
          <span className="text-[10px]" style={{ color: margen >= 40 ? '#3A9E6A' : '#C8842A' }}>
            MB estimado: <strong>{Math.round(margen)}%</strong>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Colores por familia (cycling) ─────────────────────────────
const FAM_COLORS = ['#3A9E6A', '#0099f2', '#C8842A', '#9B59B6', '#00557f', '#C0392B']

// ── Componente principal ──────────────────────────────────────

export function PasoFamiliasDrop({ lanzamiento }: { lanzamiento: Lanzamiento }) {
  const router             = useRouter()
  const { save, flush, status } = useAutoSave(lanzamiento.id)

  const [familias,        setFamilias]        = useState<FamiliaDropItem[]>(
    (lanzamiento.familias_drop as FamiliaDropItem[] | null) ?? [],
  )
  const [familiasOpciones, setFamiliasOpciones] = useState<string[]>([])

  // Cargar familias disponibles del catálogo
  useEffect(() => {
    fetch('/api/products/filter-options')
      .then(r => r.json())
      .then((d: { familias?: string[] }) => {
        if (Array.isArray(d.familias)) setFamiliasOpciones(d.familias.filter(Boolean))
      })
      .catch(() => null)
  }, [])

  // ── Totales del drop ─────────────────────────────────────────
  const totalUds          = familias.reduce((s, f) => s + f.uds, 0)
  const totalCoste        = familias.reduce((s, f) => s + (f.coste_medio ? f.uds * f.coste_medio : 0), 0)
  const totalIngresos     = familias.reduce((s, f) => s + (f.precio_medio ? f.uds * f.precio_medio : 0), 0)
  const mbAgregado        = totalIngresos > 0 ? ((totalIngresos - totalCoste) / totalIngresos) * 100 : null

  function addFamilia(nombre: string) {
    if (familias.some(f => f.familia === nombre)) return
    const next: FamiliaDropItem[] = [...familias, {
      familia:      nombre,
      uds:          20,
      precio_medio: null,
      coste_medio:  null,
    }]
    setFamilias(next)
    save({
      familias_drop:        next,
      unidades_compra_total: next.reduce((s, f) => s + f.uds, 0),
    })
  }

  function updateFamilia(idx: number, next: FamiliaDropItem) {
    const arr = familias.map((f, i) => i === idx ? next : f)
    setFamilias(arr)
    save({
      familias_drop:         arr,
      unidades_compra_total: arr.reduce((s, f) => s + f.uds, 0),
      coste:                 arr.reduce((s, f) => s + (f.coste_medio ?? 0), 0) / Math.max(arr.length, 1) || null,
      precio_venta:          arr.reduce((s, f) => s + (f.precio_medio ?? 0), 0) / Math.max(arr.length, 1) || null,
    })
  }

  function removeFamilia(idx: number) {
    const arr = familias.filter((_, i) => i !== idx)
    setFamilias(arr)
    save({
      familias_drop:         arr,
      unidades_compra_total: arr.reduce((s, f) => s + f.uds, 0) || null,
    })
  }

  const familiasDisponibles = familiasOpciones.filter(f => !familias.some(ff => ff.familia === f))

  async function handleNext() {
    await flush()
    router.push(`/lanzamiento/${lanzamiento.id}/paso/4`)
  }

  return (
    <WizardLayout
      step={3}
      tipo="drop"
      lanzamientoId={lanzamiento.id}
      title="Familias del drop"
      saveStatus={status}
      onNext={handleNext}
    >
      <CoachingPanel
        storageKey="wizard-coaching-drop-familias"
        concepto="Define qué familias componen este drop y cuántas unidades de cada una. No hay una regla fija — varía según la campaña y la época del año. Esta app va a ayudar a crear las estrategias de forma sistemática por primera vez, documentando qué mix funcionó y qué no para el año siguiente."
        ejemplo="Un drop de San Valentín podría ser: 30 uds pendientes (PVP 65€, coste 22€) + 20 uds anillos (PVP 90€, coste 30€) + 15 uds pulseras (PVP 55€, coste 18€) = 65 uds totales, MB ponderado ~65%. Black Friday puede tener un mix más amplio. La ventaja de planificarlo aquí: el año que viene tendrás el dato real para comparar."
        consecuencia="Si el margen bruto agregado del drop está por debajo del 50%, revisa el mix de familias o los precios antes de confirmar."
      />

      {/* ── Familias añadidas ─────────────────────────── */}
      {familias.length > 0 && (
        <div className="space-y-3 mb-5">
          {familias.map((fam, idx) => (
            <FamiliaCard
              key={fam.familia}
              item={fam}
              color={FAM_COLORS[idx % FAM_COLORS.length]}
              onChange={next => updateFamilia(idx, next)}
              onRemove={() => removeFamilia(idx)}
            />
          ))}
        </div>
      )}

      {/* ── Añadir familia ────────────────────────────── */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8fa8b8' }}>
          Añadir familia al drop
        </label>
        {familiasDisponibles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {familiasDisponibles.map(f => (
              <button
                key={f}
                onClick={() => addFamilia(f)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
                style={{ background: 'rgba(0,85,127,0.07)', color: '#00557f', border: '1px solid rgba(0,85,127,0.15)' }}
              >
                + {f}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: '#b2b2b2' }}>
            Todas las familias disponibles ya están en el drop.
          </p>
        )}
      </div>

      {/* ── Resumen del drop ──────────────────────────── */}
      {familias.length > 0 && (
        <div
          className="rounded-xl grid grid-cols-4 gap-px overflow-hidden"
          style={{ border: '1px solid rgba(0,85,127,0.1)', background: 'rgba(0,85,127,0.04)' }}
        >
          {[
            { label: 'Familias',   value: familias.length.toString() },
            { label: 'Uds. totales', value: totalUds.toLocaleString('es-ES') },
            { label: 'Coste pedido', value: totalCoste > 0 ? fmtEur(totalCoste) : '—' },
            { label: 'MB estimado', value: mbAgregado != null ? `${Math.round(mbAgregado)}%` : '—' },
          ].map(kpi => (
            <div key={kpi.label} className="text-center px-3 py-3 bg-white first:rounded-tl-xl first:rounded-bl-xl last:rounded-tr-xl last:rounded-br-xl">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8fa8b8' }}>{kpi.label}</p>
              <p className="text-[16px] font-black" style={{ color: '#00264d' }}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {familias.length === 0 && (
        <p className="text-[12px] text-center py-6" style={{ color: '#c0cfd8' }}>
          Añade al menos una familia para continuar
        </p>
      )}
    </WizardLayout>
  )
}
