'use client'

import { useCallback } from 'react'

export interface AnalyticsFilterValues {
  category: string
  familia: string
  metal: string
  karat: string
  abc: string
  dateFrom: string
  dateTo: string
}

interface AnalyticsFiltersProps {
  values: AnalyticsFilterValues
  onChange: (values: AnalyticsFilterValues) => void
  // Optional option lists — defaults are built-in
  categories?: string[]
  familias?: string[]
  metals?: string[]
  karats?: string[]
}

const DEFAULT_METALS  = ['Oro', 'Plata', 'Acero', 'Chapado']
const DEFAULT_KARATS  = ['9k', '14k', '18k', '925']
const DEFAULT_ABC     = ['A', 'B', 'C']

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#0099f2' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg outline-none transition-all"
        style={{
          fontFamily: 'inherit',
          background: '#ffffff',
          color: '#00557f',
          border: '1px solid rgba(0,85,127,0.22)',
          minWidth: '120px',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#0099f2'
          e.target.style.boxShadow = '0 0 0 2px rgba(0,153,242,0.2)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(0,85,127,0.22)'
          e.target.style.boxShadow = 'none'
        }}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

export function AnalyticsFilters({
  values,
  onChange,
  categories = [],
  familias = [],
  metals = DEFAULT_METALS,
  karats = DEFAULT_KARATS,
}: AnalyticsFiltersProps) {
  const set = useCallback(
    (key: keyof AnalyticsFilterValues) => (v: string) =>
      onChange({ ...values, [key]: v }),
    [values, onChange]
  )

  const hasActive =
    values.category || values.familia || values.metal ||
    values.karat || values.abc || values.dateFrom || values.dateTo

  const reset = () =>
    onChange({ category: '', familia: '', metal: '', karat: '', abc: '', dateFrom: '', dateTo: '' })

  return (
    <div
      className="flex items-end gap-3 flex-wrap px-5 py-3 rounded-xl mb-6"
      style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)' }}
    >
      {categories.length > 0 && (
        <Select label="Categoría" value={values.category} options={categories} onChange={set('category')} />
      )}
      {familias.length > 0 && (
        <Select label="Familia" value={values.familia} options={familias} onChange={set('familia')} />
      )}
      <Select label="Metal" value={values.metal} options={metals} onChange={set('metal')} />
      <Select label="Karat" value={values.karat} options={karats} onChange={set('karat')} />
      <Select label="ABC" value={values.abc} options={DEFAULT_ABC} onChange={set('abc')} />

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#0099f2' }}>
          Desde
        </label>
        <input
          type="date"
          value={values.dateFrom}
          onChange={(e) => set('dateFrom')(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{
            fontFamily: 'inherit',
            background: '#ffffff',
            color: '#00557f',
            border: '1px solid rgba(0,85,127,0.22)',
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#0099f2' }}>
          Hasta
        </label>
        <input
          type="date"
          value={values.dateTo}
          onChange={(e) => set('dateTo')(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{
            fontFamily: 'inherit',
            background: '#ffffff',
            color: '#00557f',
            border: '1px solid rgba(0,85,127,0.22)',
          }}
        />
      </div>

      {hasActive && (
        <button
          onClick={reset}
          className="self-end text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#C0392B', background: 'rgba(192,57,43,0.08)' }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
