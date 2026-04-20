'use client'

import { useState, useTransition } from 'react'
import { createField, toggleField } from './actions'
import type { CustomFieldDefinition, CustomFieldType } from '@/types'

const FIELD_TYPES: { value: CustomFieldType; label: string; hint: string }[] = [
  { value: 'text',     label: 'Texto corto',       hint: 'Una línea de texto libre' },
  { value: 'textarea', label: 'Texto largo',        hint: 'Párrafo o anotación' },
  { value: 'date',     label: 'Fecha',              hint: 'Selector de fecha' },
  { value: 'boolean',  label: 'Sí / No',            hint: 'Casilla de verificación' },
  { value: 'select',   label: 'Lista de opciones',  hint: 'Menú desplegable' },
]

interface Props { fields: CustomFieldDefinition[] }

export function FieldsPanel({ fields }: Props) {
  const [showForm,    setShowForm]   = useState(false)
  const [fieldType,   setFieldType]  = useState<CustomFieldType>('text')
  const [formError,   setFormError]  = useState<string | null>(null)
  const [isPending,   startTrans]    = useTransition()

  function openForm() { setShowForm(true); setFormError(null) }
  function closeForm() { setShowForm(false); setFormError(null); setFieldType('text') }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const formData = new FormData(e.currentTarget)
    startTrans(async () => {
      const result = await createField(formData)
      if (result.ok) {
        closeForm()
      } else {
        setFormError(result.error ?? 'Error desconocido')
      }
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTrans(async () => { await toggleField(id, !current) })
  }

  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#b2b2b2' }}>
          {fields.length === 0
            ? 'Sin campos definidos.'
            : `${fields.filter(f => f.is_active).length} activos · ${fields.length} total`}
        </p>
        <button
          onClick={openForm}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85"
          style={{ background: '#0099f2' }}
        >
          + Crear campo
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-5 space-y-4"
          style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)', border: '1px solid rgba(0,153,242,0.25)' }}
        >
          <p className="font-semibold text-tq-snorkel">Nuevo campo</p>

          {formError && (
            <div
              className="px-4 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', color: '#992d22' }}
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-tq-snorkel">
                Nombre visible *
              </label>
              <input
                name="label"
                required
                placeholder="Ej: Campaña activa"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2"
                style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#b2b2b2' }}>
                La clave se genera automáticamente (ej: campana_activa)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-tq-snorkel">
                Tipo *
              </label>
              <select
                name="field_type"
                value={fieldType}
                onChange={e => setFieldType(e.target.value as CustomFieldType)}
                className="w-full px-3 py-2 rounded-lg text-sm border bg-white focus:outline-none focus:ring-2"
                style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="text-[10px] mt-1" style={{ color: '#b2b2b2' }}>
                {FIELD_TYPES.find(t => t.value === fieldType)?.hint}
              </p>
            </div>
          </div>

          {fieldType === 'select' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-tq-snorkel">
                Opciones (una por línea) *
              </label>
              <textarea
                name="options"
                rows={4}
                placeholder={'Opción 1\nOpción 2\nOpción 3'}
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 font-mono"
                style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
              />
            </div>
          )}

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
              {isPending ? 'Creando…' : 'Crear campo'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {fields.length === 0 && !showForm ? (
        <div className="text-center py-20" style={{ color: '#b2b2b2' }}>
          <p className="text-3xl mb-3">≡</p>
          <p className="text-sm font-medium text-tq-snorkel">Sin campos definidos</p>
          <p className="text-xs mt-1">
            Ejemplos: Campaña activa · Colección · Estado fotografía · Aprobado catálogo
          </p>
        </div>
      ) : fields.length > 0 && (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                {['Nombre', 'Clave', 'Tipo', 'Opciones', 'Estado', ''].map(h => (
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
              {fields.map((f, i) => (
                <tr
                  key={f.id}
                  style={{
                    borderBottom: i < fields.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                    opacity: f.is_active ? 1 : 0.5,
                  }}
                >
                  <td className="px-4 py-3 font-medium text-tq-snorkel">{f.label}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#b2b2b2' }}>{f.field_key}</td>
                  <td className="px-4 py-3"><TypeBadge type={f.field_type} /></td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: '#b2b2b2' }}>
                    {f.options?.length ? f.options.join(' · ') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={f.is_active
                        ? { background: 'rgba(58,158,106,0.12)', color: '#2d7a54' }
                        : { background: 'rgba(0,85,127,0.06)', color: '#b2b2b2' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.is_active ? '#3A9E6A' : '#d0cdc9' }} />
                      {f.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(f.id, f.is_active)}
                      disabled={isPending}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                      style={f.is_active
                        ? { background: 'rgba(192,57,43,0.08)', color: '#992d22' }
                        : { background: 'rgba(58,158,106,0.08)', color: '#2d7a54' }}
                    >
                      {f.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="px-4 py-3 rounded-xl text-xs"
        style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)', color: '#b2b2b2' }}
      >
        <span className="font-semibold text-tq-snorkel">Nota:</span>{' '}
        Desactivar un campo lo oculta en las fichas pero conserva todos sus valores.
        No es posible eliminarlo para evitar pérdida de datos.
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    text: 'Texto', textarea: 'Texto largo', date: 'Fecha', boolean: 'Sí/No', select: 'Lista',
  }
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
    >
      {labels[type] ?? type}
    </span>
  )
}
