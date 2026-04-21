'use client'

import { useState, useEffect, useTransition } from 'react'
import { useToast } from '@/components/ui'

const TIPOS = [
  { value: 'nota',       label: 'Nota',       color: '#00557f'  },
  { value: 'precio',     label: 'Precio',     color: '#C8842A'  },
  { value: 'surtido',    label: 'Surtido',    color: '#3A9E6A'  },
  { value: 'campana',    label: 'Campaña',    color: '#9B59B6'  },
  { value: 'proveedor',  label: 'Proveedor',  color: '#0099f2'  },
  { value: 'alerta',     label: 'Alerta',     color: '#C0392B'  },
] as const

type Tipo = typeof TIPOS[number]['value']

type Comment = {
  id: string
  user_email: string
  user_name: string | null
  contenido: string
  tipo: Tipo
  created_at: string
  editado: boolean
}

function TipoPill({ tipo }: { tipo: Tipo }) {
  const cfg = TIPOS.find(t => t.value === tipo) ?? TIPOS[0]
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ background: cfg.color + '18', color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function fmtDateTime(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function ProductComments({
  codigo_modelo,
  userEmail,
}: {
  codigo_modelo: string
  userEmail: string | null
}) {
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [tipo, setTipo] = useState<Tipo>('nota')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch(`/api/products/${codigo_modelo}/comments`)
      .then(r => r.json())
      .then(d => { setComments(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [codigo_modelo])

  function submit() {
    if (!text.trim() || !userEmail) return
    startTransition(async () => {
      const res = await fetch(`/api/products/${codigo_modelo}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: text.trim(), tipo }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Error', 'error'); return }
      setComments(prev => [data, ...prev])
      setText('')
      toast('Nota añadida', 'success')
    })
  }

  async function remove(id: string) {
    const res = await fetch(`/api/products/${codigo_modelo}/comments?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast('Error al eliminar', 'error'); return }
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Compose */}
      {userEmail ? (
        <div className="bg-white rounded-xl px-4 py-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#b2b2b2' }}>Nueva nota</p>

          {/* Tipo selector */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all"
                style={{
                  borderColor: tipo === t.value ? t.color : 'rgba(0,85,127,0.15)',
                  background:  tipo === t.value ? t.color + '18' : 'transparent',
                  color:       tipo === t.value ? t.color : '#b2b2b2',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit() }}
            placeholder="Escribe una nota… (⌘+Enter para enviar)"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm border focus:outline-none resize-none"
            style={{ borderColor: 'rgba(0,85,127,0.2)', color: '#00557f' }}
          />

          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px]" style={{ color: '#b2b2b2' }}>{userEmail}</span>
            <button
              onClick={submit}
              disabled={isPending || !text.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
              style={{ background: '#00557f' }}
            >
              {isPending ? 'Enviando…' : 'Añadir nota'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-center py-4" style={{ color: '#b2b2b2' }}>
          Inicia sesión para añadir notas.
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <p className="text-xs text-center py-6" style={{ color: '#b2b2b2' }}>Cargando notas…</p>
      ) : comments.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2" style={{ color: '#e8e3df' }}>◎</p>
          <p className="text-sm font-medium text-tq-snorkel">Sin notas todavía</p>
          <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>Las notas del equipo sobre este producto aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {comments.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-xl px-4 py-3 group"
              style={{ boxShadow: '0 1px 4px rgba(0,32,60,0.07)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <TipoPill tipo={c.tipo} />
                <span className="text-[10px] font-medium" style={{ color: '#b2b2b2' }}>
                  {c.user_name ?? c.user_email.split('@')[0]}
                </span>
                <span className="text-[10px]" style={{ color: '#d0cdc9' }}>·</span>
                <span className="text-[10px]" style={{ color: '#b2b2b2' }}>{fmtDateTime(c.created_at)}</span>
                {c.editado && <span className="text-[10px]" style={{ color: '#b2b2b2' }}>(editado)</span>}
                {c.user_email === userEmail && (
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
                    style={{ color: '#C0392B' }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-tq-snorkel">{c.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
