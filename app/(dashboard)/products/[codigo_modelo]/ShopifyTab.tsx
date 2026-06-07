'use client'

import { useState } from 'react'
import type { ProductShopifyData } from '@/types'

interface ShopifyTabProps {
  codigoModelo: string
  shopifyData:  ProductShopifyData | null
  shopDomain?:  string | null
}

type GenerationType = 'shopify_description' | 'seo_title' | 'tags' | 'catalog_description'

// ── Helpers ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const cfg = {
    active:   { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54', dot: '#3A9E6A', label: 'ACTIVO'    },
    draft:    { bg: 'rgba(200,132,42,0.12)',   text: '#a06818', dot: '#C8842A', label: 'BORRADOR'  },
    archived: { bg: 'rgba(192,57,43,0.12)',    text: '#992d22', dot: '#C0392B', label: 'ARCHIVADO' },
  }[status ?? ''] ?? { bg: 'rgba(0,85,127,0.08)', text: '#b2b2b2', dot: '#b2b2b2', label: 'NO SINCRONIZADO' }

  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black tracking-widest uppercase"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function CompletiturBar({ data }: { data: ProductShopifyData | null }) {
  const fields: { key: keyof ProductShopifyData; label: string }[] = [
    { key: 'shopify_title',       label: 'Título'       },
    { key: 'shopify_description', label: 'Descripción'  },
    { key: 'shopify_tags',        label: 'Tags'         },
    { key: 'shopify_seo_title',   label: 'SEO title'    },
    { key: 'shopify_seo_desc',    label: 'SEO desc'     },
  ]
  const filled = data
    ? fields.filter(f => {
        const v = data[f.key]
        if (Array.isArray(v)) return v.length > 0
        return !!v
      }).length
    : 0
  const total = fields.length
  const pct   = Math.round((filled / total) * 100)
  const color = pct >= 80 ? '#3A9E6A' : pct >= 40 ? '#C8842A' : '#b2b2b2'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(0,85,127,0.08)' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold whitespace-nowrap" style={{ color }}>
        {filled}/{total} campos completados
      </span>
    </div>
  )
}

function InlineField({
  label, value, field, codigoModelo, multiline, onSaved,
}: {
  label: string
  value: string | null
  field: string
  codigoModelo: string
  multiline?: boolean
  onSaved: (field: string, value: string) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState(value ?? '')
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/products/${codigoModelo}/shopify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: draft }),
    })
    setSaving(false)
    if (!res.ok) { setError('Error al guardar'); return }
    onSaved(field, draft)
    setEditing(false)
  }

  return (
    <div className="py-2.5" style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
          {label}
        </span>
        {!editing && (
          <button
            onClick={() => { setDraft(value ?? ''); setEditing(true) }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,153,242,0.08)', color: '#0099f2' }}
          >
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {multiline ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none"
              style={{ borderColor: 'rgba(0,85,127,0.2)', background: '#fafafa' }}
            />
          ) : (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'rgba(0,85,127,0.2)', background: '#fafafa' }}
            />
          )}
          {error && <p className="text-xs" style={{ color: '#C0392B' }}>{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: '#0099f2' }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(0,85,127,0.08)', color: '#b2b2b2' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: value ? '#00557f' : '#d0cdc9' }}>
          {value ?? '—'}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export function ShopifyTab({ codigoModelo, shopifyData: initialData, shopDomain }: ShopifyTabProps) {
  const [data,          setData]          = useState<ProductShopifyData | null>(initialData)
  const [generating,    setGenerating]    = useState<GenerationType | null>(null)
  const [preview,       setPreview]       = useState<{ type: GenerationType; content: string } | null>(null)
  const [savingPreview, setSavingPreview] = useState(false)
  const [genError,      setGenError]      = useState<string | null>(null)

  function handleSaved(field: string, value: string) {
    setData(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function generate(type: GenerationType) {
    setGenerating(type)
    setGenError(null)
    setPreview(null)
    const res = await fetch('/api/ai/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_modelo: codigoModelo, type }),
    })
    setGenerating(null)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setGenError(err.error ?? 'Error al generar')
      return
    }
    const { content } = await res.json()
    setPreview({ type, content })
  }

  async function savePreview() {
    if (!preview) return
    setSavingPreview(true)
    const fieldMap: Record<GenerationType, string> = {
      shopify_description: 'shopify_description',
      seo_title:           'shopify_seo_title',
      tags:                'shopify_seo_desc', // overridden below
      catalog_description: 'shopify_description',
    }
    const field = preview.type === 'tags'
      ? 'shopify_tags'
      : preview.type === 'seo_title'
        ? 'shopify_seo_title'
        : preview.type === 'catalog_description'
          ? 'shopify_description'
          : 'shopify_description'

    const value = preview.type === 'tags'
      ? preview.content.split(',').map(t => t.trim()).filter(Boolean)
      : preview.content

    const res = await fetch(`/api/products/${codigoModelo}/shopify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setSavingPreview(false)
    if (!res.ok) { setGenError('Error al guardar'); return }
    setData(prev => prev
      ? { ...prev, [field]: value }
      : {
          codigo_modelo: codigoModelo,
          shopify_product_id: null, shopify_title: null, shopify_description: null,
          shopify_tags: [], shopify_status: null, shopify_handle: null,
          shopify_vendor: null, shopify_seo_title: null, shopify_seo_desc: null,
          synced_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          [field]: value,
        } as ProductShopifyData
    )
    setPreview(null)
  }

  const genButtons: { type: GenerationType; label: string }[] = [
    { type: 'shopify_description', label: 'Generar descripción Shopify' },
    { type: 'seo_title',           label: 'Generar SEO title'           },
    { type: 'tags',                label: 'Generar tags'                },
    { type: 'catalog_description', label: 'Generar descripción catálogo'},
  ]

  return (
    <div className="space-y-5">
      {/* Completitud bar */}
      <div
        className="px-4 py-3 rounded-xl"
        style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.08)' }}
      >
        <CompletiturBar data={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — Estado en Shopify */}
        <div className="bg-white rounded-xl px-5 py-4 space-y-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
            Estado en Shopify
          </p>

          <StatusBadge status={data?.shopify_status ?? null} />

          {!data && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(200,132,42,0.08)', border: '1px solid rgba(200,132,42,0.2)', color: '#a06818' }}
            >
              Este producto no está en Shopify todavía.
              <button
                onClick={() => generate('shopify_description')}
                disabled={generating !== null}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#C8842A' }}
              >
                {generating === 'shopify_description' ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generando…
                  </>
                ) : 'Generar contenido para subir'}
              </button>
            </div>
          )}

          {data?.shopify_handle && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Handle</span>
              {shopDomain ? (
                <a
                  href={`https://${shopDomain}/products/${data.shopify_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-tq-sky hover:underline"
                >
                  /{data.shopify_handle} ↗
                </a>
              ) : (
                <span className="text-sm font-mono text-tq-snorkel">{data.shopify_handle}</span>
              )}
            </div>
          )}

          {data?.shopify_vendor && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Marca (vendor)</span>
              <span className="text-sm text-tq-snorkel">{data.shopify_vendor}</span>
            </div>
          )}

          {data?.shopify_tags && data.shopify_tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {data.shopify_tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data?.synced_at && (
            <p className="text-xs" style={{ color: '#b2b2b2' }}>
              Último sync: {new Date(data.synced_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Right — Contenido */}
        <div className="bg-white rounded-xl px-5 py-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#b2b2b2' }}>
            Contenido
          </p>

          <InlineField
            label="Título Shopify"
            value={data?.shopify_title ?? null}
            field="shopify_title"
            codigoModelo={codigoModelo}
            onSaved={handleSaved}
          />

          {/* Descripción HTML con botón regenerar */}
          <div className="py-2.5" style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
                Descripción (HTML)
              </span>
              <button
                onClick={() => generate('shopify_description')}
                disabled={generating !== null}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,153,242,0.08)', color: '#0099f2' }}
              >
                {generating === 'shopify_description' ? (
                  <>
                    <span className="inline-block w-2.5 h-2.5 border-2 border-[#0099f2] border-t-transparent rounded-full animate-spin" />
                    Generando…
                  </>
                ) : '⟳ Regenerar con IA'}
              </button>
            </div>
            {data?.shopify_description ? (
              <div
                className="prose prose-sm max-w-none text-sm"
                style={{ color: '#00557f' }}
                dangerouslySetInnerHTML={{ __html: data.shopify_description }}
              />
            ) : (
              <p className="text-sm" style={{ color: '#d0cdc9' }}>Sin descripción</p>
            )}
          </div>

          <InlineField
            label="SEO Title"
            value={data?.shopify_seo_title ?? null}
            field="shopify_seo_title"
            codigoModelo={codigoModelo}
            onSaved={handleSaved}
          />

          <InlineField
            label="SEO Description"
            value={data?.shopify_seo_desc ?? null}
            field="shopify_seo_desc"
            codigoModelo={codigoModelo}
            multiline
            onSaved={handleSaved}
          />
        </div>
      </div>

      {/* Sección generación IA */}
      <div
        className="bg-white rounded-xl px-5 py-4"
        style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
      >
        <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: '#b2b2b2' }}>
          Generación con IA
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          {genButtons.map(btn => (
            <button
              key={btn.type}
              onClick={() => generate(btn.type)}
              disabled={generating !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'rgba(200,132,42,0.1)', color: '#8B5E1A', border: '1px solid rgba(200,132,42,0.25)' }}
            >
              {generating === btn.type ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-[#8B5E1A] border-t-transparent rounded-full animate-spin" />
                  Generando…
                </>
              ) : btn.label}
            </button>
          ))}
        </div>

        {genError && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', color: '#992d22' }}>
            {genError}
          </div>
        )}

        {preview && (
          <div
            className="space-y-3 p-4 rounded-xl"
            style={{ background: 'rgba(200,132,42,0.05)', border: '1px solid rgba(200,132,42,0.2)' }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#a06818' }}>
              Vista previa — {preview.type}
            </p>
            <textarea
              value={preview.content}
              onChange={e => setPreview(p => p ? { ...p, content: e.target.value } : p)}
              rows={5}
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none font-mono"
              style={{ borderColor: 'rgba(200,132,42,0.3)', background: '#fff' }}
            />
            <div className="flex gap-2">
              <button
                onClick={savePreview}
                disabled={savingPreview}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#C8842A' }}
              >
                {savingPreview ? 'Guardando…' : 'Guardar en Shopify Data'}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(0,85,127,0.08)', color: '#b2b2b2' }}
              >
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
