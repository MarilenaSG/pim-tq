'use client'

import { useState } from 'react'
import { PriceSuggestionPanel } from './PriceSuggestionPanel'

type GenerationType = 'shopify_description' | 'seo_title' | 'tags' | 'catalog_description'

const GENERATORS: { type: GenerationType; label: string; desc: string; icon: string }[] = [
  {
    type:  'shopify_description',
    label: 'Descripción Shopify',
    desc:  'HTML con párrafos y lista de características · 80-150 palabras',
    icon:  '◈',
  },
  {
    type:  'seo_title',
    label: 'Título SEO',
    desc:  'Título optimizado para buscadores · 50-70 caracteres',
    icon:  '⊙',
  },
  {
    type:  'tags',
    label: 'Tags',
    desc:  'Etiquetas para filtrado en Shopify · 8-15 tags',
    icon:  '◇',
  },
  {
    type:  'catalog_description',
    label: 'Descripción catálogo',
    desc:  'Texto corto para el catálogo de tiendas · 1-2 frases',
    icon:  '◫',
  },
]

interface Props {
  codigoModelo: string
}

export function AiContentPanel({ codigoModelo }: Props) {
  const [results, setResults]   = useState<Partial<Record<GenerationType, string>>>({})
  const [loading, setLoading]   = useState<GenerationType | null>(null)
  const [errors, setErrors]     = useState<Partial<Record<GenerationType, string>>>({})
  const [copied, setCopied]     = useState<GenerationType | null>(null)

  async function generate(type: GenerationType) {
    setLoading(type)
    setErrors(prev => ({ ...prev, [type]: undefined }))

    try {
      const res = await fetch('/api/ai/generate-content', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo_modelo: codigoModelo, type }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error desconocido')
      setResults(prev => ({ ...prev, [type]: data.content }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrors(prev => ({ ...prev, [type]: msg }))
    } finally {
      setLoading(null)
    }
  }

  async function copyToClipboard(type: GenerationType, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Price suggestion */}
      <PriceSuggestionPanel codigoModelo={codigoModelo} />

      <div className="border-t border-[#e2ddd9] pt-4" />

      {/* Intro */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(200,132,42,0.06)', border: '1px solid rgba(200,132,42,0.15)' }}
      >
        <span className="text-lg shrink-0" style={{ color: '#C8842A' }}>✦</span>
        <div>
          <p className="font-semibold text-[#00557f]">Generador de contenido con IA</p>
          <p className="text-xs mt-0.5" style={{ color: '#b2b2b2' }}>
            Usa los datos del producto y la voz de marca de TQ Jewels para generar contenido listo para usar.
            Revisa siempre el resultado antes de publicar.
          </p>
        </div>
      </div>

      {/* Generator cards */}
      {GENERATORS.map(({ type, label, desc, icon }) => {
        const result  = results[type]
        const isLoading = loading === type
        const error   = errors[type]
        const isCopied = copied === type

        return (
          <div
            key={type}
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0ece8]">
              <div className="flex items-center gap-2.5">
                <span className="text-sm" style={{ color: '#C8842A' }}>{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-[#00557f]">{label}</p>
                  <p className="text-xs" style={{ color: '#b2b2b2' }}>{desc}</p>
                </div>
              </div>
              <button
                onClick={() => generate(type)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: isLoading ? '#f0ece8' : '#00557f',
                  color:      isLoading ? '#b2b2b2' : '#fff',
                }}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block text-xs">◌</span>
                    Generando…
                  </>
                ) : result ? (
                  '↻ Regenerar'
                ) : (
                  '✦ Generar'
                )}
              </button>
            </div>

            {/* Result area */}
            {error && (
              <div className="px-5 py-3 text-sm" style={{ color: '#C0392B', background: 'rgba(192,57,43,0.04)' }}>
                Error: {error}
              </div>
            )}

            {result && !error && (
              <div className="px-5 py-4">
                {type === 'shopify_description' ? (
                  <div className="space-y-3">
                    <div
                      className="prose prose-sm max-w-none text-[#1d1d1b] rounded-lg p-3"
                      style={{ background: '#fdf3e4', fontSize: '0.8125rem', lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: result }}
                    />
                    <div className="border rounded-lg p-3 bg-[#f5f3f0]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#b2b2b2] mb-1">HTML</p>
                      <pre className="text-xs text-[#00557f] whitespace-pre-wrap break-all font-mono">{result}</pre>
                    </div>
                  </div>
                ) : type === 'tags' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {result.split(',').map(tag => tag.trim()).filter(Boolean).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px]" style={{ color: '#b2b2b2' }}>{result}</p>
                  </div>
                ) : (
                  <div
                    className="rounded-lg p-3 text-sm text-[#00557f]"
                    style={{ background: '#fdf3e4', lineHeight: 1.6 }}
                  >
                    {result}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => copyToClipboard(type, result)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: isCopied ? 'rgba(58,158,106,0.12)' : 'rgba(0,85,127,0.06)',
                      color:      isCopied ? '#3A9E6A' : '#00557f',
                    }}
                  >
                    {isCopied ? '✓ Copiado' : '⎘ Copiar'}
                  </button>
                  <span className="text-[10px]" style={{ color: '#b2b2b2' }}>
                    Revisa el contenido antes de usarlo en Shopify
                  </span>
                </div>
              </div>
            )}

            {!result && !error && !isLoading && (
              <div className="px-5 py-4 text-xs" style={{ color: '#b2b2b2' }}>
                Haz clic en "Generar" para crear el contenido con IA
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
