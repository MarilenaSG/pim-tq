'use client'

/**
 * FilterSelect — compact select sin etiqueta externa.
 * El placeholder actúa de label; cuando hay valor activo se resalta en azul.
 * Altura fija h-8 (32px) para consistencia en todas las barras de filtros.
 */
export function FilterSelect({
  placeholder,
  value,
  options,
  onChange,
  maxWidth = 160,
}: {
  placeholder: string
  value: string
  options: string[]
  onChange: (v: string) => void
  maxWidth?: number | string
}) {
  const active = !!value
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-8 px-2.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#00557f] shrink-0 cursor-pointer"
      style={{
        borderColor: active ? '#00557f' : 'rgba(0,85,127,0.18)',
        color:       active ? '#00557f' : '#8fa8b8',
        background:  active ? 'rgba(0,85,127,0.05)' : 'white',
        fontWeight:  active ? 500 : 400,
        maxWidth,
        minWidth: 80,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
