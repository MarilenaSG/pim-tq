'use client'

import { useState, useEffect } from 'react'

interface CoachingPanelProps {
  concepto:     string
  ejemplo:      string
  consecuencia: string
  storageKey:   string
}

export function CoachingPanel({ concepto, ejemplo, consecuencia, storageKey }: CoachingPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'true') setCollapsed(true)
    setMounted(true)
  }, [storageKey])

  function dismiss() {
    setCollapsed(true)
    localStorage.setItem(storageKey, 'true')
  }

  if (!mounted) return null
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 text-xs mb-5 transition-colors"
        style={{ color: '#8fa8b8' }}
      >
        <span style={{ fontSize: 14, color: '#0099f2', opacity: 0.6 }}>💡</span>
        <span className="hover:underline">Ver consejo de este paso</span>
      </button>
    )
  }

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{ background: 'rgba(0,153,242,0.05)', border: '1px solid rgba(0,153,242,0.15)' }}
    >
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>💡</span>
        <div className="flex-1 space-y-2.5">
          <p className="text-[13px] leading-relaxed font-medium" style={{ color: '#00264d' }}>
            {concepto}
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: '#00557f' }}>
            <span className="font-semibold">Ejemplo TQ:</span> {ejemplo}
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: '#C8842A' }}>
            <span className="font-semibold">Consecuencia:</span> {consecuencia}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={dismiss}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ background: 'rgba(0,153,242,0.12)', color: '#0099f2' }}
        >
          Ya lo entendí →
        </button>
      </div>
    </div>
  )
}
