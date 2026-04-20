'use client'

import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

// Minimal markdown: bold + newlines
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>
      }
      return part
    })
    return <span key={i}>{parts}{i < lines.length - 1 ? <br /> : null}</span>
  })
}

export function ChatWidget() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res  = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error')
      setMessages(prev => [...prev, { role: 'assistant', content: data.content ?? '' }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-13 h-13 rounded-full shadow-lg transition-all hover:scale-105"
        style={{
          width: 52, height: 52,
          background: open ? '#C8842A' : '#00557f',
          boxShadow: '0 4px 20px rgba(0,32,60,0.25)',
        }}
        title="Chat analítico IA"
      >
        {open
          ? <span className="text-white text-lg font-bold">×</span>
          : <span className="text-white text-lg">✦</span>
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 380, height: 520,
            boxShadow: '0 8px 40px rgba(0,32,60,0.2)',
            background: '#fff',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#00557f' }}>
            <span className="text-white text-sm">✦</span>
            <div>
              <p className="text-white text-sm font-semibold">Chat analítico</p>
              <p className="text-white/60 text-[10px]">Pregunta sobre el catálogo · claude-sonnet-4-6</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="ml-auto text-white/50 hover:text-white text-xs transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: '#fafaf9' }}>
            {messages.length === 0 && (
              <div className="flex flex-col gap-2 mt-4">
                <p className="text-xs text-center" style={{ color: '#b2b2b2' }}>
                  Pregunta sobre el catálogo, stock, precios o rendimiento
                </p>
                {[
                  '¿Cuántos modelos ABC-A tenemos?',
                  '¿Qué familia genera más ingresos?',
                  '¿Hay productos sin stock con alto valor?',
                  '¿Cuál es el precio medio del catálogo?',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="text-left text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white"
                    style={{ background: 'rgba(0,85,127,0.05)', color: '#00557f', border: '1px solid rgba(0,85,127,0.1)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: m.role === 'user' ? '#00557f' : '#fff',
                    color:      m.role === 'user' ? '#fff' : '#1d1d1b',
                    boxShadow:  m.role === 'assistant' ? '0 1px 4px rgba(0,32,60,0.08)' : 'none',
                    lineHeight: 1.5,
                    fontSize:   '0.8125rem',
                  }}
                >
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-xl px-3 py-2 text-sm" style={{ boxShadow: '0 1px 4px rgba(0,32,60,0.08)', color: '#b2b2b2' }}>
                  <span className="animate-pulse">Analizando…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-[#e2ddd9] flex gap-2 items-end bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pregunta sobre el catálogo…"
              rows={1}
              className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                border: '1px solid #e2ddd9',
                background: '#fafaf9',
                color: '#1d1d1b',
                maxHeight: 80,
                overflowY: 'auto',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center rounded-lg text-white transition-all disabled:opacity-40"
              style={{ width: 34, height: 34, background: '#00557f', flexShrink: 0 }}
            >
              <span className="text-sm">↑</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
