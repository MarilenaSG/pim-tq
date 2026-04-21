'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Setting {
  key: string
  value: string
  label: string
  description: string
  type: 'integer' | 'boolean'
}

const SETTINGS_META: Omit<Setting, 'value'>[] = [
  {
    key: 'umbral_stock_abc_a',
    label: 'Stock mínimo ABC-A',
    description: 'Alerta cuando un producto ABC-A tiene menos de N unidades en stock.',
    type: 'integer',
  },
  {
    key: 'umbral_stock_abc_b',
    label: 'Stock mínimo ABC-B',
    description: 'Umbral de stock para productos ABC-B (solo si "Alertar ABC-B" está activado).',
    type: 'integer',
  },
  {
    key: 'dias_new_sin_venta',
    label: 'Días NEW sin rendir',
    description: 'Alerta cuando un producto categoría NEW lleva X días sin llegar a ABC-A o B.',
    type: 'integer',
  },
  {
    key: 'alertar_abc_b_stock',
    label: 'Alertar también para ABC-B',
    description: 'Activar alertas de stock también para productos con clasificación ABC-B.',
    type: 'boolean',
  },
]

export default function AlertsSettingsPage() {
  const supabase = createClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('alert_settings').select('key, value').then(({ data }) => {
      const map: Record<string, string> = {}
      for (const row of data ?? []) map[row.key] = row.value
      setValues(map)
      setLoading(false)
    })
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    const updates = Object.entries(values).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }))

    await supabase
      .from('alert_settings')
      .upsert(updates, { onConflict: 'key' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function setValue(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 w-48 rounded bg-gray-100 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse h-16 rounded-xl bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Configuración"
        title="Umbrales de alerta"
        subtitle="Configura los parámetros que determinan qué alertas se generan."
      />

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        {SETTINGS_META.map((meta, i) => (
          <div
            key={meta.key}
            className="px-5 py-4 flex items-center justify-between gap-6"
            style={{ borderBottom: i < SETTINGS_META.length - 1 ? '1px solid rgba(0,85,127,0.06)' : 'none' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-tq-snorkel">{meta.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#b2b2b2' }}>{meta.description}</p>
            </div>

            {meta.type === 'integer' ? (
              <input
                type="number"
                min={0}
                value={values[meta.key] ?? ''}
                onChange={e => setValue(meta.key, e.target.value)}
                className="w-20 px-3 py-2 rounded-lg border text-sm text-right font-mono focus:outline-none"
                style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setValue(meta.key, values[meta.key] === 'true' ? 'false' : 'true')}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{
                  background: values[meta.key] === 'true' ? '#3A9E6A' : 'rgba(0,85,127,0.15)',
                }}
                aria-label={meta.label}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: values[meta.key] === 'true' ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: '#00557f' }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {saved && (
          <span className="text-sm font-medium" style={{ color: '#3A9E6A' }}>
            ✓ Guardado
          </span>
        )}
      </div>
    </div>
  )
}
