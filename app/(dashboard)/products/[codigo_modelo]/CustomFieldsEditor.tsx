'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui'
import { saveCustomField } from './actions'
import type { CustomFieldDefinition, ProductCustomField } from '@/types'

interface Props {
  fieldDefs:    CustomFieldDefinition[]
  customFields: ProductCustomField[]
  codigo:       string
}

export function CustomFieldsEditor({ fieldDefs, customFields, codigo }: Props) {
  const { toast }               = useToast()
  const [isPending, startTrans] = useTransition()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  // Local copy of saved values — updated optimistically on save
  const savedMap = Object.fromEntries(customFields.map(f => [f.field_key, f.field_value ?? '']))
  const [localValues, setLocalValues] = useState<Record<string, string>>(savedMap)

  // Track last-saved metadata for the "edited by / when" footer
  const metaMap = Object.fromEntries(
    customFields.map(f => [f.field_key, { updated_by: f.updated_by, updated_at: f.updated_at }])
  )

  if (fieldDefs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-3xl mb-3" style={{ color: '#e8e3df' }}>≡</p>
        <p className="text-sm font-medium text-tq-snorkel">Sin campos custom definidos</p>
        <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>
          Crea campos en{' '}
          <Link href="/settings/fields" className="text-tq-sky hover:underline">
            Campos del equipo
          </Link>
          .
        </p>
      </div>
    )
  }

  function save(def: CustomFieldDefinition, newValue: string) {
    const current = savedMap[def.field_key] ?? ''
    if (newValue === current) return  // no change, skip

    setPendingKey(def.field_key)
    startTrans(async () => {
      const result = await saveCustomField(codigo, def.field_key, newValue, def.field_type)
      setPendingKey(null)
      if (result.ok) {
        savedMap[def.field_key] = newValue  // keep ref in sync
        toast('Campo guardado', 'success')
      } else {
        // Revert local value
        setLocalValues(prev => ({ ...prev, [def.field_key]: current }))
        toast(result.error ?? 'Error al guardar', 'error')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div
        className="bg-white rounded-xl px-5 py-1"
        style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
      >
        {fieldDefs.map((def, i) => {
          const value    = localValues[def.field_key] ?? ''
          const isSaving = isPending && pendingKey === def.field_key
          const meta     = metaMap[def.field_key]

          return (
            <div
              key={def.field_key}
              className="flex gap-4 py-4 items-start"
              style={{
                borderBottom: i < fieldDefs.length - 1 ? '1px solid rgba(0,85,127,0.06)' : 'none',
              }}
            >
              {/* Label */}
              <div className="w-44 shrink-0 pt-2">
                <p className="text-xs font-semibold text-tq-snorkel">{def.label}</p>
                <TypePill type={def.field_type} />
                {isSaving && (
                  <p className="text-[10px] mt-1" style={{ color: '#0099f2' }}>Guardando…</p>
                )}
              </div>

              {/* Input */}
              <div className="flex-1">
                <FieldInput
                  def={def}
                  value={value}
                  isSaving={isSaving}
                  onChange={v => setLocalValues(prev => ({ ...prev, [def.field_key]: v }))}
                  onSave={v => save(def, v)}
                />
                {meta?.updated_by && (
                  <p className="text-[10px] mt-1.5" style={{ color: '#b2b2b2' }}>
                    {new Date(meta.updated_at).toLocaleDateString('es-ES')} · {meta.updated_by}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Field input by type ────────────────────────────────────────────

function FieldInput({
  def, value, isSaving, onChange, onSave,
}: {
  def: CustomFieldDefinition
  value: string
  isSaving: boolean
  onChange: (v: string) => void
  onSave: (v: string) => void
}) {
  const base = 'px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-colors w-full'
  const style = {
    borderColor: 'rgba(0,85,127,0.2)',
    color: '#00557f',
    background: isSaving ? 'rgba(0,153,242,0.03)' : 'white',
  }

  if (def.field_type === 'boolean') {
    return (
      <div className="flex gap-4 pt-1.5">
        {(['', 'true', 'false'] as const).map(opt => (
          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`bool_${def.field_key}`}
              value={opt}
              checked={value === opt}
              disabled={isSaving}
              onChange={() => { onChange(opt); onSave(opt) }}
              className="accent-tq-sky"
            />
            <span className="text-sm text-tq-snorkel">
              {opt === '' ? '—' : opt === 'true' ? 'Sí' : 'No'}
            </span>
          </label>
        ))}
      </div>
    )
  }

  if (def.field_type === 'select') {
    return (
      <select
        value={value}
        disabled={isSaving}
        onChange={e => { onChange(e.target.value); onSave(e.target.value) }}
        className={base}
        style={style}
      >
        <option value="">— Sin valor —</option>
        {(def.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (def.field_type === 'textarea') {
    return (
      <textarea
        value={value}
        rows={3}
        disabled={isSaving}
        placeholder="Sin valor"
        onChange={e => onChange(e.target.value)}
        onBlur={e => onSave(e.target.value)}
        className={base}
        style={style}
      />
    )
  }

  return (
    <input
      type={def.field_type === 'date' ? 'date' : 'text'}
      value={value}
      disabled={isSaving}
      placeholder="Sin valor"
      onChange={e => onChange(e.target.value)}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onSave((e.target as HTMLInputElement).value)}
      className={base}
      style={style}
    />
  )
}

function TypePill({ type }: { type: string }) {
  const labels: Record<string, string> = {
    text: 'Texto', textarea: 'Texto largo', date: 'Fecha', boolean: 'Sí/No', select: 'Lista',
  }
  return (
    <span className="text-[10px] font-mono mt-0.5" style={{ color: '#d0cdc9' }}>
      {labels[type] ?? type}
    </span>
  )
}
