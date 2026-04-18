import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { SyncIndicator } from '@/components/ui'

interface SupabaseStatus {
  ok: boolean
  schemaReady: boolean
  message: string
  latencyMs?: number
}

async function checkSupabaseConnection(): Promise<SupabaseStatus> {
  const start = Date.now()
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('products').select('codigo_modelo').limit(1)
    const latencyMs = Date.now() - start

    if (error) {
      const isTableMissing =
        error.code === '42P01' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      if (isTableMissing) {
        return { ok: true, schemaReady: false, message: 'Conectado · esquema pendiente', latencyMs }
      }
      return { ok: false, schemaReady: false, message: error.message, latencyMs }
    }

    return { ok: true, schemaReady: true, message: 'Conectado · esquema listo', latencyMs }
  } catch (err) {
    return { ok: false, schemaReady: false, message: String(err) }
  }
}

const SESSIONS = [
  { n: 1, done: true,  label: 'Next.js 14 + Supabase + Tailwind' },
  { n: 2, done: true,  label: 'Esquema BD + componentes UI base' },
  { n: 3, done: false, label: 'Sync Metabase CSV → 440 productos' },
  { n: 4, done: false, label: 'Sync Shopify → imágenes y datos' },
  { n: 5, done: false, label: 'Lista de productos con filtros' },
  { n: 6, done: false, label: 'Ficha de producto · 5 tabs' },
]

export default async function DashboardPage() {
  const status = await checkSupabaseConnection()

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-bold tracking-widest uppercase text-tq-sky mb-1">
          Te Quiero Joyerías
        </p>
        <h1
          className="text-4xl font-bold text-tq-snorkel mb-2"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          PIM
        </h1>
        <p className="text-sm" style={{ color: 'color-mix(in srgb, #00557f 65%, #fff)' }}>
          Gestor de información de producto · 17 tiendas en Canarias
        </p>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-3 mb-8">
        {/* Supabase */}
        <div
          className="bg-white rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
        >
          <SyncIndicator
            status={status.ok ? 'success' : 'error'}
            lastSync={null}
            label={`Supabase · ${status.message}`}
          />
          {status.latencyMs !== undefined && (
            <span className="text-xs" style={{ color: '#b2b2b2' }}>{status.latencyMs}ms</span>
          )}
        </div>

        {/* Schema status */}
        <div
          className="bg-white rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
        >
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold"
            style={{ color: status.schemaReady ? '#3A9E6A' : '#C8842A' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: status.schemaReady ? '#3A9E6A' : '#C8842A' }}
            />
            Esquema BD {status.schemaReady ? 'listo' : '— ejecutar schema.sql'}
          </span>
        </div>
      </div>

      {/* Schema SQL hint (shown when schema not ready) */}
      {!status.schemaReady && (
        <div
          className="mb-8 rounded-xl px-5 py-4"
          style={{ background: 'rgba(200,132,42,0.07)', border: '1px solid rgba(200,132,42,0.25)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: '#a06818' }}>
            Pendiente: crear tablas en Supabase
          </p>
          <p className="text-xs mb-3" style={{ color: '#b2b2b2' }}>
            Abre <strong>Supabase Dashboard → SQL Editor → New Query</strong>,
            pega el contenido de <code className="font-mono">supabase/schema.sql</code> y ejecuta.
          </p>
          <Link
            href="/settings/sync"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: '#C8842A', color: '#fff' }}
          >
            Ver panel de sync →
          </Link>
        </div>
      )}

      {/* Progress */}
      <div className="tq-card p-5 mb-6">
        <h3 className="font-semibold text-tq-snorkel mb-4 text-sm">
          Progreso del proyecto
        </h3>
        <ul className="space-y-2">
          {SESSIONS.map((s) => (
            <li key={s.n} className="flex items-center gap-3 text-sm">
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={
                  s.done
                    ? { background: 'rgba(58,158,106,0.12)', color: '#3A9E6A' }
                    : { background: 'rgba(0,85,127,0.06)',   color: '#c6c6c6' }
                }
              >
                {s.done ? '✓' : s.n}
              </span>
              <span className={s.done ? 'text-tq-snorkel' : ''} style={s.done ? {} : { color: '#b2b2b2' }}>
                <span className="font-medium">Sesión {s.n}</span> — {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/test',         label: 'Ver design system', color: '#0099f2' },
          { href: '/settings/sync', label: 'Panel de sync',    color: '#00557f' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: l.color }}
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  )
}
