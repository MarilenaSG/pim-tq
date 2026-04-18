import { createServerClient } from '@/lib/supabase/server'

interface SupabaseStatus {
  ok: boolean
  message: string
  latencyMs?: number
}

async function checkSupabaseConnection(): Promise<SupabaseStatus> {
  const start = Date.now()
  try {
    const supabase = createServerClient()
    // Simple ping — select 1 row from a system table
    const { error } = await supabase.from('products').select('codigo_modelo').limit(1)
    const latencyMs = Date.now() - start

    if (error) {
      // Table missing = schema not yet created, but the connection itself works
      const isTableMissing =
        error.code === '42P01' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      if (isTableMissing) {
        return { ok: true, message: 'Conectado · Esquema pendiente de crear (Sesión 2)', latencyMs }
      }
      return { ok: false, message: `Error: ${error.message}`, latencyMs }
    }

    return { ok: true, message: 'Conectado correctamente', latencyMs }
  } catch (err) {
    return { ok: false, message: `No se pudo conectar: ${String(err)}` }
  }
}

export default async function DashboardPage() {
  const status = await checkSupabaseConnection()

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold tracking-widest uppercase text-tq-sky mb-1">
          Te Quiero Joyerías
        </p>
        <h1 className="text-4xl font-bold text-tq-snorkel mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          PIM
        </h1>
        <p className="text-base text-[var(--tq-fg-muted)]">
          Gestor de información de producto · 17 tiendas en Canarias
        </p>
      </div>

      {/* Supabase status card */}
      <div className="tq-card p-5 mb-8 flex items-start gap-4">
        <div
          className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${
            status.ok ? 'bg-[var(--status-ok)]' : 'bg-[var(--status-error)]'
          }`}
          style={{ boxShadow: status.ok ? '0 0 0 3px rgba(58,158,106,0.2)' : '0 0 0 3px rgba(192,57,43,0.2)' }}
        />
        <div>
          <div className="font-semibold text-tq-snorkel text-sm">
            Supabase
          </div>
          <div className={`text-sm mt-0.5 ${status.ok ? 'text-[var(--status-ok)]' : 'text-[var(--status-error)]'}`}>
            {status.message}
          </div>
          {status.latencyMs !== undefined && (
            <div className="text-xs text-[var(--tq-gray-400)] mt-1">
              Latencia: {status.latencyMs}ms
            </div>
          )}
        </div>
      </div>

      {/* Próximos pasos */}
      <div className="tq-card p-5">
        <h3 className="font-semibold text-tq-snorkel mb-3 text-sm">
          Estado del proyecto · Sesión 1
        </h3>
        <ul className="space-y-2 text-sm">
          {[
            { done: true,  label: 'Next.js 14 + App Router inicializado' },
            { done: true,  label: 'Tailwind CSS con paleta TQ configurado' },
            { done: true,  label: 'Supabase client (anon + service role) configurado' },
            { done: true,  label: 'Tipos TypeScript en types/index.ts' },
            { done: false, label: 'Sesión 2: Esquema BD + componentes UI base' },
            { done: false, label: 'Sesión 3: Sync Metabase CSV → 440 productos' },
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span
                className={`text-xs font-bold ${
                  item.done ? 'text-[var(--status-ok)]' : 'text-[var(--tq-gray-400)]'
                }`}
              >
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-tq-snorkel' : 'text-[var(--tq-gray-400)]'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
