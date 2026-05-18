'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { SinRotacionRow, Diagnosis } from './page'
import { ProductActionList } from '@/components/products/ProductActionList'

const DIAGNOSIS_CONFIG: Record<Diagnosis, { label: string; color: string; bg: string }> = {
  exposicion_o_precio: { label: 'Exposición/Precio',  color: '#00557f', bg: 'rgba(0,85,127,0.1)'    },
  distribucion:        { label: 'Distribución',        color: '#C8842A', bg: 'rgba(200,132,42,0.1)'  },
  margen_comprimido:   { label: 'Margen comprimido',   color: '#C0392B', bg: 'rgba(192,57,43,0.1)'   },
  liquidacion:         { label: 'Liquidación',          color: '#7B3F00', bg: 'rgba(123,63,0,0.1)'   },
  revisar_manualmente: { label: 'Revisar',              color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

const DIAGNOSIS_ORDER: Diagnosis[] = [
  'exposicion_o_precio', 'distribucion', 'margen_comprimido', 'liquidacion', 'revisar_manualmente',
]

const ABC_CLS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-red-100 text-red-700',
}

interface Config {
  abc:               string[]
  stock_min:         number
  solo_sin_decision: boolean
  diagnosis:         string[]
}

const DEFAULT_CONFIG: Config = {
  abc: ['A', 'B', 'C'],
  stock_min: 1,
  solo_sin_decision: false,
  diagnosis: [],
}

export function SinRotacionClient({
  rows,
  byDiagnosis,
}: {
  rows:        SinRotacionRow[]
  byDiagnosis: Record<string, number>
}) {
  const [config, setConfig]         = useState<Config>(DEFAULT_CONFIG)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [actionCodes, setActionCodes] = useState<string[]>([])
  const [actionTitle, setActionTitle] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sinRotacion_config')
      if (raw) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) as Partial<Config> })
    } catch { /* ignore */ }
  }, [])

  function updateConfig(partial: Partial<Config>) {
    const next = { ...config, ...partial }
    setConfig(next)
    try { localStorage.setItem('sinRotacion_config', JSON.stringify(next)) } catch { /* ignore */ }
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (r.abc !== null && !config.abc.includes(r.abc))            return false
    if (r.stockTotal < config.stock_min)                          return false
    if (config.solo_sin_decision && r.hasDecision)                return false
    if (config.diagnosis.length > 0 && !config.diagnosis.includes(r.diagnosis)) return false
    return true
  }), [rows, config])

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.codigo))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(r => r.codigo)))
  }

  function toggleOne(code: string) {
    const next = new Set(selected)
    next.has(code) ? next.delete(code) : next.add(code)
    setSelected(next)
  }

  const selectedCodes = Array.from(selected).filter(c => filtered.some(r => r.codigo === c))

  function openAction() {
    if (selectedCodes.length === 0) return
    setActionCodes(selectedCodes)
    setActionTitle(`${selectedCodes.length} productos sin rotación`)
  }

  function openSingle(row: SinRotacionRow) {
    setActionCodes([row.codigo])
    setActionTitle(`${row.codigo} — ${row.desc}`)
  }

  return (
    <div className="space-y-5">
      {/* Config panel */}
      <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <div className="flex items-center gap-5 flex-wrap">
          <span className="text-[11px] font-bold text-[#00557f] uppercase tracking-wider">Filtros</span>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#b2b2b2]">ABC:</span>
            {['A', 'B', 'C'].map(abc => (
              <button
                key={abc}
                onClick={() => {
                  const next = config.abc.includes(abc)
                    ? config.abc.filter(x => x !== abc)
                    : [...config.abc, abc]
                  updateConfig({ abc: next.length > 0 ? next : ['A', 'B', 'C'] })
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                  config.abc.includes(abc)
                    ? ABC_CLS[abc] + ' border-current'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}
              >
                {abc}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#b2b2b2]">Stock mín:</span>
            <input
              type="number"
              min={1}
              value={config.stock_min}
              onChange={e => updateConfig({ stock_min: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-16 px-2 py-0.5 text-xs border border-[#e2ddd9] rounded focus:outline-none focus:ring-1 focus:ring-[#00557f]"
            />
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.solo_sin_decision}
              onChange={e => updateConfig({ solo_sin_decision: e.target.checked })}
              className="accent-[#00557f]"
            />
            <span className="text-xs text-[#b2b2b2]">Solo sin decisión</span>
          </label>

          <span className="ml-auto text-xs text-[#b2b2b2]">
            {filtered.length} de {rows.length} modelos
          </span>
        </div>
      </div>

      {/* Diagnosis chips */}
      <div className="flex gap-2 flex-wrap">
        {DIAGNOSIS_ORDER.filter(d => byDiagnosis[d]).map(diag => {
          const cfg    = DIAGNOSIS_CONFIG[diag]
          const active = config.diagnosis.length === 0 || config.diagnosis.includes(diag)
          return (
            <button
              key={diag}
              onClick={() => {
                const next = config.diagnosis.includes(diag)
                  ? config.diagnosis.filter(d => d !== diag)
                  : [...config.diagnosis, diag]
                updateConfig({ diagnosis: next })
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={{
                background:  active ? cfg.bg    : '#f8f8f8',
                color:       active ? cfg.color : '#b2b2b2',
                borderColor: active ? cfg.color : '#e2ddd9',
              }}
            >
              <span className="font-bold text-sm">{byDiagnosis[diag]}</span>
              <span>{cfg.label}</span>
            </button>
          )
        })}
        {config.diagnosis.length > 0 && (
          <button
            onClick={() => updateConfig({ diagnosis: [] })}
            className="px-3 py-1.5 rounded-lg border border-[#e2ddd9] text-xs text-[#b2b2b2] hover:text-[#00557f]"
          >
            Ver todos
          </button>
        )}
      </div>

      {/* Selection bar */}
      {selectedCodes.length > 0 && (
        <div className="flex items-center gap-3 bg-[#f0ece8] rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-[#00557f]">
            {selectedCodes.length} {selectedCodes.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
          </span>
          <button
            onClick={openAction}
            className="ml-auto px-4 py-1.5 bg-[#00557f] text-white text-sm font-semibold rounded-lg hover:bg-[#00446a] transition-colors"
          >
            Ver y gestionar →
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#b2b2b2]">No hay productos que cumplan los filtros seleccionados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e2ddd9] bg-[#fafaf9]">
                  <th className="w-8 pl-4 pr-2 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-[#00557f]"
                    />
                  </th>
                  {['Código', 'Descripción', 'Familia', 'ABC', 'Stock', 'Capital', 'Precio', 'Margen', 'Tiendas', 'Diagnóstico', 'Decisión'].map(h => (
                    <th key={h} className="text-left py-3 pr-3 font-bold text-[#00557f] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const diagCfg    = DIAGNOSIS_CONFIG[r.diagnosis]
                  const isSelected = selected.has(r.codigo)
                  return (
                    <tr
                      key={r.codigo}
                      className={`border-b border-[#f0ece8] transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/40' : 'hover:bg-[#fafaf9]'
                      }`}
                      onClick={() => openSingle(r)}
                    >
                      <td
                        className="pl-4 pr-2 py-2"
                        onClick={e => { e.stopPropagation(); toggleOne(r.codigo) }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(r.codigo)}
                          className="accent-[#00557f]"
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Link
                          href={`/products/${r.codigo}`}
                          className="font-mono text-[#b2b2b2] hover:text-[#00557f]"
                          onClick={e => e.stopPropagation()}
                        >
                          {r.codigo}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 max-w-[180px] truncate text-[#1d1d1b]">{r.desc}</td>
                      <td className="py-2 pr-3 text-[#b2b2b2]">{r.familia ?? '—'}</td>
                      <td className="py-2 pr-3">
                        {r.abc
                          ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ABC_CLS[r.abc] ?? 'bg-gray-100 text-gray-500'}`}>{r.abc}</span>
                          : <span className="text-[#b2b2b2]">—</span>
                        }
                      </td>
                      <td className="py-2 pr-3 font-semibold text-[#1d1d1b]">
                        {r.stockTotal.toLocaleString('es-ES')}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-[#C0392B]">
                        {r.capitalInmovilizado > 0
                          ? r.capitalInmovilizado >= 1000
                            ? `${Math.round(r.capitalInmovilizado / 1000)}k€`
                            : `${r.capitalInmovilizado.toLocaleString('es-ES')}€`
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-[#00557f]">
                        {r.precioVenta != null
                          ? r.precioVenta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-[#b2b2b2]">
                        {r.pctMargen != null ? `${r.pctMargen}%` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-[#b2b2b2]">
                        {r.numTiendas ?? '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{ background: diagCfg.bg, color: diagCfg.color }}
                        >
                          {diagCfg.label}
                        </span>
                      </td>
                      <td className="py-2">
                        {r.hasDecision
                          ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-semibold">✓ Activa</span>
                          : <span className="text-[#b2b2b2]">Pendiente</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionCodes.length > 0 && (
        <ProductActionList
          codigosModelo={actionCodes}
          titulo={actionTitle}
          onClose={() => { setActionCodes([]); setSelected(new Set()) }}
          context="sin-rotacion"
        />
      )}
    </div>
  )
}
