'use client'

import { useState } from 'react'
import type { AbcCruzado } from '@/types'

export interface MatrizItem {
  codigo:   string
  desc:     string | null
  familia:  string | null
  ingresos: number
  margen:   number | null
  uds:      number | null
}

export interface MatrizCell {
  vol:   'A' | 'B' | 'C'
  mgn:   'A' | 'B' | 'C'
  label: AbcCruzado
  items: MatrizItem[]
}

export interface BorderGroup {
  label: 'Sin venta 12M' | 'Sin dato de margen'
  items: MatrizItem[]
}

// Color por etiqueta (brief: verde Estrella, rojo Candidato, ámbar Revisar/Gancho)
const CELL_STYLE: Record<AbcCruzado, { bg: string; border: string; text: string }> = {
  'Estrella':                 { bg: 'rgba(58,158,106,0.12)', border: 'rgba(58,158,106,0.35)', text: '#2d7a54' },
  'Nicho rentable':           { bg: 'rgba(58,158,106,0.07)', border: 'rgba(58,158,106,0.25)', text: '#2d7a54' },
  'Motor de tráfico':         { bg: 'rgba(0,153,242,0.10)',  border: 'rgba(0,153,242,0.28)',  text: '#006da3' },
  'Joya oculta':              { bg: 'rgba(0,153,242,0.10)',  border: 'rgba(0,153,242,0.28)',  text: '#006da3' },
  'Núcleo estable':           { bg: 'rgba(0,85,127,0.06)',   border: 'rgba(0,85,127,0.18)',   text: '#00557f' },
  'Cola larga aceptable':     { bg: 'rgba(0,85,127,0.04)',   border: 'rgba(0,85,127,0.14)',   text: '#5a7488' },
  'Gancho bajo margen':       { bg: 'rgba(200,132,42,0.13)', border: 'rgba(200,132,42,0.33)', text: '#a06818' },
  'Revisar precio/coste':     { bg: 'rgba(200,132,42,0.13)', border: 'rgba(200,132,42,0.33)', text: '#a06818' },
  'Candidato a descatalogar': { bg: 'rgba(192,57,43,0.12)',  border: 'rgba(192,57,43,0.33)',  text: '#b23528' },
  'Sin venta 12M':            { bg: 'rgba(0,85,127,0.04)',   border: 'rgba(0,85,127,0.12)',   text: '#8fa8b8' },
  'Sin dato de margen':       { bg: 'rgba(0,85,127,0.04)',   border: 'rgba(0,85,127,0.12)',   text: '#8fa8b8' },
}

const VOL_LABEL: Record<'A' | 'B' | 'C', string> = {
  A: 'Volumen A · alta rotación',
  B: 'Volumen B · media',
  C: 'Volumen C · baja',
}
const MGN_LABEL: Record<'A' | 'B' | 'C', string> = {
  A: 'Margen A', B: 'Margen B', C: 'Margen C',
}

export function MatrizSurtido({ cells, borderCases }: { cells: MatrizCell[]; borderCases: BorderGroup[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  const cellByKey = new Map(cells.map(c => [`${c.vol}${c.mgn}`, c]))
  const border = new Map(borderCases.map(b => [b.label, b]))

  const activeCell = cells.find(c => `${c.vol}${c.mgn}` === selected)
  const activeBorder = borderCases.find(b => b.label === selected)
  const activeItems = activeCell?.items ?? activeBorder?.items ?? []
  const activeLabel = activeCell?.label ?? activeBorder?.label ?? null

  return (
    <div className="tq-table-wrap p-5 mb-8">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-[15px] font-semibold text-[#00264d]">ABC Cruzado — Volumen × Margen</h3>
        <span className="text-[11px] text-[#8fa8b8]">Terciles de margen recalculados en cada sync · clic en una celda para ver los modelos</span>
      </div>

      <div className="grid mt-4" style={{ gridTemplateColumns: '120px repeat(3, 1fr)', gap: 8 }}>
        {/* Cabecera columnas */}
        <div />
        {(['A', 'B', 'C'] as const).map(m => (
          <div key={m} className="text-center text-[10px] font-semibold uppercase tracking-[0.11em] text-[#8fa8b8] pb-1">
            {MGN_LABEL[m]}
          </div>
        ))}

        {(['A', 'B', 'C'] as const).map(vol => (
          <div key={vol} className="contents">
            <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.11em] text-[#8fa8b8] pr-2 text-right justify-end">
              {VOL_LABEL[vol]}
            </div>
            {(['A', 'B', 'C'] as const).map(mgn => {
              const cell = cellByKey.get(`${vol}${mgn}`)
              if (!cell) return <div key={mgn} />
              const st = CELL_STYLE[cell.label]
              const key = `${vol}${mgn}`
              const isActive = selected === key
              return (
                <button
                  key={mgn}
                  onClick={() => setSelected(isActive ? null : key)}
                  className="rounded-lg px-3 py-3 text-left transition-all"
                  style={{
                    background: st.bg,
                    border: `1.5px solid ${isActive ? st.text : st.border}`,
                    boxShadow: isActive ? `0 0 0 3px ${st.bg}` : 'none',
                  }}
                >
                  <div className="text-[22px] font-bold leading-none" style={{ color: st.text }}>{cell.items.length}</div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: st.text }}>{cell.label}</div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Casos borde */}
      {borderCases.length > 0 && (
        <div className="flex gap-2 mt-4">
          {borderCases.map(b => {
            const st = CELL_STYLE[b.label]
            const isActive = selected === b.label
            return (
              <button
                key={b.label}
                onClick={() => setSelected(isActive ? null : b.label)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
                style={{
                  background: st.bg,
                  border: `1.5px solid ${isActive ? st.text : st.border}`,
                  color: st.text,
                }}
              >
                {b.label} · {b.items.length}
              </button>
            )
          })}
        </div>
      )}

      {/* Drill */}
      {activeLabel && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-semibold text-[#00264d]">{activeLabel} · {activeItems.length} modelos</h4>
            <button onClick={() => setSelected(null)} className="text-[11px] text-[#0099f2] hover:underline">Cerrar</button>
          </div>
          <div className="tq-table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="tq-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Familia</th>
                  <th className="right">Uds 12M</th>
                  <th className="right">Margen %</th>
                  <th className="right">Ingresos 12M</th>
                </tr>
              </thead>
              <tbody>
                {activeItems
                  .slice()
                  .sort((a, b) => b.ingresos - a.ingresos)
                  .map(it => (
                    <tr key={it.codigo}>
                      <td><a href={`/products/${it.codigo}`} style={{ color: '#0099f2' }}>{it.codigo}</a></td>
                      <td>{it.desc ?? '—'}</td>
                      <td>{it.familia ?? '—'}</td>
                      <td className="right">{it.uds != null ? it.uds.toLocaleString('es-ES') : '—'}</td>
                      <td className="right">{it.margen != null ? `${Math.round(it.margen * 100)}%` : '—'}</td>
                      <td className="right">{it.ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
