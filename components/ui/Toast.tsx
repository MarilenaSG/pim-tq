'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void
}

// ── Context ───────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, variant, message, duration }])
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Toast Item ────────────────────────────────────────────────

const variantStyle: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  success: { bg: '#ffffff', border: '#3A9E6A', icon: '✓' },
  error:   { bg: '#ffffff', border: '#C0392B', icon: '✕' },
  info:    { bg: '#ffffff', border: '#0099f2', icon: 'ℹ' },
}

const iconColor: Record<ToastVariant, string> = {
  success: '#3A9E6A',
  error:   '#C0392B',
  info:    '#0099f2',
}

function ToastItemComponent({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const s = variantStyle[item.variant]

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(item.id), item.duration ?? 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [item.id, item.duration, onDismiss])

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl min-w-[260px] max-w-sm shadow-lg"
      style={{
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        boxShadow: '0 8px 20px rgba(0,32,60,0.12)',
      }}
    >
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
        style={{ background: iconColor[item.variant] }}
      >
        {s.icon}
      </span>
      <span className="flex-1 text-sm font-medium text-tq-snorkel leading-snug">
        {item.message}
      </span>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-xs font-bold transition-colors hover:opacity-60"
        style={{ color: '#c6c6c6' }}
      >
        ✕
      </button>
    </div>
  )
}

// ── Container ─────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItemComponent key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
