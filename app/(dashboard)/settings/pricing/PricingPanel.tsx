'use client'

import { useState, useTransition } from 'react'
import { savePricingRule, deletePricingRule } from './actions'
import type { PricingRule } from '@/types'

const REDONDEO_OPTIONS = [
  { value: '',   label: 'Libre',   hint: 'Sin redondeo forzado' },
  { value: '99', label: 'xx,99€',  hint: 'Ej: 149,99 €' },
  { value: '00', label: 'xx,00€',  hint: 'Ej: 150,00 €' },
]

interface Props {
  rules:    PricingRule[]
  families: string[]
  metals:   string[]
  karats:   string[]
}

export function PricingPanel({ rules, families, metals, karats }: Props) {
  const [showForm,     setShowForm]    = useState(false)
  const [editingRule,  setEditingRule] = useState<PricingRule | null>(null)
  const [formError,    setFormError]   = useState<string | null>(null)
  const [deletingId,   setDeletingId]  = useState<string | null>(null)
  const [isPending,    startTrans]     = useTransition()

  function openCreate() { setEditingRule(null); setFormError(null); setShowForm(true) }
  function openEdit(rule: PricingRule) { setEditingRule(rule); setFormError(null); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditingRule(null); setFormError(null) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const formData = new FormData(e.currentTarget)
    startTrans(async () => {
      const result = await savePricingRule(formData)
      if (result.ok) { closeForm() }
      else           { setFormError(result.error ?? 'Error desconocido') }
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTrans(async () => {
      await deletePricingRule(id)
      setDeletingId(null)
    })
  }

  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#b2b2b2' }}>
          {rules.length === 0
            ? 'Sin reglas definidas.'
            : `${rules.length} regla${rules.length !== 1 ? 's' : ''} · el motor IA usará la más específica`}
        </p>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85"
          style={{ background: '#0099f2' }}
        >
          + Nueva regla
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl p-5 space-y-5"
          style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)', border: '1px solid rgba(0,153,242,0.25)' }}
        >
          <p className="font-semibold text-tq-snorkel">
            {editingRule ? 'Editar regla' : 'Nueva regla de pricing'}
          </p>

          {editingRule && <input type="hidden" name="id" value={editingRule.id} />}

          {formError && (
            <div
              className="px-4 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', color: '#992d22' }}
            >
              {formError}
            </div>
          )}

          {/* Scope */}
          <div>
            <p className="text-xs font-semibold text-tq-snorkel mb-2">
              Alcance <span className="font-normal" style={{ color: '#b2b2b2' }}>— deja en blanco para aplicar a todos</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField name="familia" label="Familia" options={families} defaultValue={editingRule?.familia ?? ''} />
              <SelectField name="metal"   label="Metal"   options={metals}   defaultValue={editingRule?.metal   ?? ''} />
              <SelectField name="karat"   label="Quilate" options={karats}   defaultValue={editingRule?.karat   ?? ''} />
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-tq-snorkel">
                Margen objetivo % *
              </label>
              <div className="relative">
                <input
                  name="margen_objetivo_pct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  defaultValue={editingRule?.margen_objetivo_pct ?? ''}
                  placeholder="Ej: 55"
                  className="w-full px-3 py-2 pr-8 rounded-lg text-sm border focus:outline-none focus:ring-2"
                  style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#b2b2b2' }}>%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-tq-snorkel">
                Descuento mínimo %
              </label>
              <div className="relative">
                <input
                  name="descuento_minimo_pct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={editingRule?.descuento_minimo_pct ?? ''}
                  placeholder="Ej: 10"
                  className="w-full px-3 py-2 pr-8 rounded-lg text-sm border focus:outline-none focus:ring-2"
                  style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#b2b2b2' }}>%</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#b2b2b2' }}>
                Descuento mínimo entre precio venta y precio tachado
              </p>
            </div>
          </div>

          {/* Redondeo */}
          <div>
            <p className="text-xs font-semibold mb-2 text-tq-snorkel">Redondeo de precio</p>
            <div className="flex gap-5">
              {REDONDEO_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="redondeo"
                    value={opt.value}
                    defaultChecked={(editingRule?.redondeo ?? '') === opt.value}
                    className="mt-0.5 accent-tq-sky"
                  />
                  <div>
                    <p className="text-sm font-medium text-tq-snorkel">{opt.label}</p>
                    <p className="text-[10px]" style={{ color: '#b2b2b2' }}>{opt.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: '#b2b2b2' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#0099f2' }}
            >
              {isPending ? 'Guardando…' : editingRule ? 'Guardar cambios' : 'Crear regla'}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {rules.length === 0 && !showForm && (
        <div className="text-center py-20" style={{ color: '#b2b2b2' }}>
          <p className="text-3xl mb-3">%</p>
          <p className="text-sm font-medium text-tq-snorkel">Sin reglas de pricing</p>
          <p className="text-xs mt-1">
            Define márgenes objetivo por familia, metal o quilate para que la IA sugiera precios correctos
          </p>
        </div>
      )}

      {/* Table */}
      {rules.length > 0 && (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                {['Alcance', 'Margen obj.', 'Dto. mínimo', 'Redondeo', 'Actualizado', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase"
                    style={{ color: '#b2b2b2' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => (
                <tr
                  key={rule.id}
                  style={{ borderBottom: i < rules.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none' }}
                >
                  <td className="px-4 py-3">
                    <ScopePills rule={rule} />
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#00557f' }}>
                    {rule.margen_objetivo_pct != null ? `${rule.margen_objetivo_pct.toFixed(1)} %` : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#b2b2b2' }}>
                    {rule.descuento_minimo_pct != null && rule.descuento_minimo_pct > 0
                      ? `${rule.descuento_minimo_pct.toFixed(1)} %`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <RedondeoBadge value={rule.redondeo} />
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#b2b2b2' }}>
                    {rule.updated_at
                      ? new Date(rule.updated_at).toLocaleDateString('es-ES')
                      : '—'}
                    {rule.updated_by && (
                      <span className="block">{rule.updated_by}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(rule)}
                        disabled={isPending}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={isPending && deletingId === rule.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(192,57,43,0.08)', color: '#992d22' }}
                      >
                        {isPending && deletingId === rule.id ? '…' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info note */}
      <div
        className="px-4 py-3 rounded-xl text-xs"
        style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)', color: '#b2b2b2' }}
      >
        <span className="font-semibold text-tq-snorkel">Precedencia:</span>{' '}
        La IA aplica la regla más específica. Familia + metal + quilate{' '}
        {'>'} familia + metal {'>'} familia {'>'} metal {'>'} regla global (todos en blanco).
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function SelectField({
  name, label, options, defaultValue,
}: {
  name: string; label: string; options: string[]; defaultValue: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 text-tq-snorkel">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none focus:ring-2"
        style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
      >
        <option value="">— Todos —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function ScopePills({ rule }: { rule: PricingRule }) {
  const pills = [
    rule.familia && { label: rule.familia, color: 'rgba(0,85,127,0.08)' },
    rule.metal   && { label: rule.metal,   color: 'rgba(200,132,42,0.10)' },
    rule.karat   && { label: rule.karat,   color: 'rgba(58,158,106,0.10)' },
  ].filter(Boolean) as { label: string; color: string }[]

  if (pills.length === 0) {
    return (
      <span
        className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
      >
        Global
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map(p => (
        <span
          key={p.label}
          className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: p.color, color: '#00557f' }}
        >
          {p.label}
        </span>
      ))}
    </div>
  )
}

function RedondeoBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: '#b2b2b2' }}>Libre</span>
  const labels: Record<string, string> = { '99': 'xx,99€', '00': 'xx,00€' }
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium font-mono"
      style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
    >
      {labels[value] ?? value}
    </span>
  )
}
