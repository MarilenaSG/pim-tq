'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { triggerMetabaseSync, type SyncActionResult } from './actions'
import { SyncIndicator } from '@/components/ui'
import type { SyncLog } from '@/types'

interface SyncPanelProps {
  lastMetabaseSync: SyncLog | null
  recentLogs: SyncLog[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function SyncPanel({ lastMetabaseSync, recentLogs }: SyncPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncActionResult | null>(null)

  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const res = await triggerMetabaseSync()
      setResult(res)
      // Refresh server component data (re-fetch sync_log)
      router.refresh()
    })
  }

  const syncStatus = isPending ? 'running' : (lastMetabaseSync?.status ?? 'success')

  return (
    <div className="space-y-6">
      {/* Metabase sync card */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
      >
        <div className="h-1" style={{ background: isPending ? '#0099f2' : (lastMetabaseSync?.status === 'error' ? '#C0392B' : '#3A9E6A') }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-tq-snorkel">Metabase CSV</span>
                <SyncIndicator
                  status={syncStatus as 'success' | 'error' | 'running'}
                  lastSync={lastMetabaseSync?.finished_at ?? null}
                />
              </div>
              <p className="text-xs" style={{ color: '#b2b2b2' }}>
                Descarga el CSV público de Metabase y actualiza products y product_variants
              </p>
              {lastMetabaseSync && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: '#b2b2b2' }}>
                  <span>
                    Registros: <strong className="text-tq-snorkel">{lastMetabaseSync.records_updated ?? 0}</strong>
                  </span>
                  <span>
                    Duración: <strong className="text-tq-snorkel">
                      {formatDuration(lastMetabaseSync.started_at, lastMetabaseSync.finished_at)}
                    </strong>
                  </span>
                  <span>
                    Por: <strong className="text-tq-snorkel">{lastMetabaseSync.triggered_by}</strong>
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleSync}
              disabled={isPending}
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0099f2' }}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sincronizando…
                </span>
              ) : (
                '↻ Sincronizar ahora'
              )}
            </button>
          </div>

          {/* Result message */}
          {result && !isPending && (
            <div
              className="mt-4 px-4 py-3 rounded-lg text-sm"
              style={{
                background: result.ok ? 'rgba(58,158,106,0.08)' : 'rgba(192,57,43,0.08)',
                border: `1px solid ${result.ok ? 'rgba(58,158,106,0.25)' : 'rgba(192,57,43,0.25)'}`,
                color: result.ok ? '#2d7a54' : '#992d22',
              }}
            >
              {result.ok ? (
                <span>
                  ✓ Sync completado — {result.modelsUpserted} modelos · {result.variantsUpserted} variantes · {result.imagesUpserted} imágenes
                </span>
              ) : (
                <span>✕ Error: {result.error ?? result.errors?.join(', ')}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Shopify (pendiente sesión 4) */}
      <div
        className="bg-white rounded-xl overflow-hidden opacity-60"
        style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
      >
        <div className="h-1" style={{ background: '#c6c6c6' }} />
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="font-semibold text-tq-snorkel mb-0.5">Shopify Admin API</div>
            <p className="text-xs" style={{ color: '#b2b2b2' }}>
              Importa productos, imágenes y datos de Shopify — disponible en Sesión 4
            </p>
          </div>
          <button
            disabled
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white opacity-50 cursor-not-allowed"
            style={{ background: '#b2b2b2' }}
          >
            Próximamente
          </button>
        </div>
      </div>

      {/* Sync log table */}
      <div>
        <h3
          className="text-[11px] font-bold tracking-widest uppercase mb-3"
          style={{ color: '#0099f2' }}
        >
          Últimas sincronizaciones
        </h3>

        {recentLogs.length === 0 ? (
          <div
            className="bg-white rounded-xl p-8 text-center text-sm"
            style={{ color: '#b2b2b2', boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            Sin sincronizaciones registradas. Ejecuta tu primer sync.
          </div>
        ) : (
          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                  {['Fuente', 'Estado', 'Registros', 'Duración', 'Disparado por', 'Inicio'].map(h => (
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
                {recentLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: i < recentLogs.length - 1 ? '1px solid rgba(0,85,127,0.06)' : 'none' }}
                  >
                    <td className="px-4 py-3 font-medium text-tq-snorkel capitalize">
                      {log.source}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                        style={{
                          background:
                            log.status === 'success' ? 'rgba(58,158,106,0.12)' :
                            log.status === 'error'   ? 'rgba(192,57,43,0.12)' :
                                                       'rgba(0,153,242,0.12)',
                          color:
                            log.status === 'success' ? '#2d7a54' :
                            log.status === 'error'   ? '#992d22' :
                                                       '#007acc',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              log.status === 'success' ? '#3A9E6A' :
                              log.status === 'error'   ? '#C0392B' :
                                                         '#0099f2',
                          }}
                        />
                        {log.status === 'success' ? 'OK' : log.status === 'error' ? 'Error' : 'Running'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-tq-snorkel">
                      {log.records_updated ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#b2b2b2' }}>
                      {formatDuration(log.started_at, log.finished_at)}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: '#b2b2b2' }}>
                      {log.triggered_by}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#b2b2b2' }}>
                      {formatDate(log.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Schema SQL hint */}
        <div
          className="mt-4 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)', color: '#b2b2b2' }}
        >
          <span className="font-semibold text-tq-snorkel">Cron job:</span>{' '}
          Ejecuta automáticamente a las 05:00 UTC · configurado en{' '}
          <code className="font-mono">vercel.json</code>
        </div>
      </div>
    </div>
  )
}
