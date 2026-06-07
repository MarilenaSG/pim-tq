'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  triggerMetabaseSync,
  triggerVentasSync,
  triggerReservasSync,
  triggerShopifySync,
  type SyncActionResult,
} from './actions'
import { SyncIndicator } from '@/components/ui'
import type { SyncLog } from '@/types'

interface SyncPanelProps {
  lastMetabaseSync: SyncLog | null
  lastVentasSync:   SyncLog | null
  lastReservasSync: SyncLog | null
  lastShopifySync:  SyncLog | null
  recentLogs:       SyncLog[]
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
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function MetaStats({ result }: { result: SyncActionResult }) {
  if (!result.ok) return <span>✕ {result.error ?? result.errors?.join(', ')}</span>
  return <span>✓ {result.modelsUpserted} modelos · {result.variantsUpserted} variantes · {result.imagesUpserted} imágenes</span>
}

export function SyncPanel({
  lastMetabaseSync, lastVentasSync, lastReservasSync, lastShopifySync, recentLogs,
}: SyncPanelProps) {
  const router = useRouter()

  const [metaPending,     startMetaTrans]     = useTransition()
  const [ventasPending,   startVentasTrans]   = useTransition()
  const [reservasPending, startReservasTrans] = useTransition()
  const [shopifyPending,  startShopifyTrans]  = useTransition()

  const [metaResult,     setMetaResult]     = useState<SyncActionResult | null>(null)
  const [ventasResult,   setVentasResult]   = useState<SyncActionResult | null>(null)
  const [reservasResult, setReservasResult] = useState<SyncActionResult | null>(null)
  const [shopifyResult,  setShopifyResult]  = useState<SyncActionResult | null>(null)

  function handleMetaSync() {
    setMetaResult(null)
    startMetaTrans(async () => { const res = await triggerMetabaseSync(); setMetaResult(res); router.refresh() })
  }

  function handleVentasSync() {
    setVentasResult(null)
    startVentasTrans(async () => { const res = await triggerVentasSync(); setVentasResult(res); router.refresh() })
  }

  function handleReservasSync() {
    setReservasResult(null)
    startReservasTrans(async () => { const res = await triggerReservasSync(); setReservasResult(res); router.refresh() })
  }

  function handleShopifySync() {
    setShopifyResult(null)
    startShopifyTrans(async () => { const res = await triggerShopifySync(); setShopifyResult(res); router.refresh() })
  }

  return (
    <div className="space-y-5">
      <SyncCard
        title="Metabase CSV"
        description="CSV de variantes → products + product_variants + product_images"
        lastSync={lastMetabaseSync}
        isPending={metaPending}
        result={metaResult}
        onSync={handleMetaSync}
        statsComponent={metaResult ? <MetaStats result={metaResult} /> : null}
        color="#0099f2"
      />

      <SyncCard
        title="Ventas mensuales"
        description="Histórico mensual de ventas por variante → ventas_mensuales"
        lastSync={lastVentasSync}
        isPending={ventasPending}
        result={ventasResult}
        onSync={handleVentasSync}
        statsComponent={ventasResult ? (
          ventasResult.ok
            ? <span>✓ {ventasResult.rowsUpserted} filas actualizadas{ventasResult.rowsDropped ? ` · ${ventasResult.rowsDropped} ignoradas` : ''}</span>
            : <span>✕ {ventasResult.error ?? ventasResult.errors?.join(', ')}</span>
        ) : null}
        color="#C8842A"
      />

      <SyncCard
        title="Reservas activas"
        description="Snapshot diario de reservas por variante → reservas_activas"
        lastSync={lastReservasSync}
        isPending={reservasPending}
        result={reservasResult}
        onSync={handleReservasSync}
        statsComponent={reservasResult ? (
          reservasResult.ok
            ? <span>✓ {reservasResult.rowsInserted} reservas importadas</span>
            : <span>✕ {reservasResult.error ?? reservasResult.errors?.join(', ')}</span>
        ) : null}
        color="#3A9E6A"
      />

      <SyncCard
        title="Shopify"
        description="Sync de productos desde Shopify Admin API → product_shopify_data"
        lastSync={lastShopifySync}
        isPending={shopifyPending}
        result={shopifyResult}
        onSync={handleShopifySync}
        statsComponent={shopifyResult ? (
          shopifyResult.ok
            ? <span>✓ {shopifyResult.shopifyDataUpserted} productos · {shopifyResult.imagesUpserted} imágenes{shopifyResult.skippedNoMatch ? ` · ${shopifyResult.skippedNoMatch} sin match` : ''}</span>
            : <span>✕ {shopifyResult.error ?? shopifyResult.errors?.join(', ')}</span>
        ) : null}
        color="#96BF48"
      />

      {/* Sync log */}
      <div>
        <h3 className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: '#0099f2' }}>
          Últimas sincronizaciones
        </h3>

        {recentLogs.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-sm"
            style={{ color: '#b2b2b2', boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            Sin sincronizaciones registradas. Ejecuta tu primer sync.
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
                  {['Fuente', 'Estado', 'Registros', 'Duración', 'Por', 'Inicio'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase"
                      style={{ color: '#b2b2b2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < recentLogs.length - 1 ? '1px solid rgba(0,85,127,0.06)' : 'none' }}>
                    <td className="px-4 py-3 font-medium text-tq-snorkel capitalize">{log.source}</td>
                    <td className="px-4 py-3"><LogStatusBadge status={log.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-tq-snorkel">{log.records_updated ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#b2b2b2' }}>
                      {formatDuration(log.started_at, log.finished_at)}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: '#b2b2b2' }}>{log.triggered_by}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#b2b2b2' }}>{formatDate(log.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'rgba(0,85,127,0.04)', border: '1px solid rgba(0,85,127,0.08)', color: '#b2b2b2' }}>
          <span className="font-semibold text-tq-snorkel">Cron job:</span>{' '}
          Ejecuta automáticamente a las 05:00 UTC (06:00–07:00 Canarias) · configurado en{' '}
          <code className="font-mono">vercel.json</code>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function LogStatusBadge({ status }: { status: string }) {
  const cfg = {
    success: { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54', dot: '#3A9E6A', label: 'OK' },
    error:   { bg: 'rgba(192,57,43,0.12)',   text: '#992d22', dot: '#C0392B', label: 'Error' },
    running: { bg: 'rgba(0,153,242,0.12)',   text: '#007acc', dot: '#0099f2', label: 'Running' },
  }[status] ?? { bg: 'rgba(0,85,127,0.08)', text: '#b2b2b2', dot: '#b2b2b2', label: status }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function SyncCard({
  title, description, lastSync, isPending, result, onSync, statsComponent, color,
}: {
  title: string; description: string; lastSync: SyncLog | null
  isPending: boolean; result: SyncActionResult | null
  onSync: () => void; statsComponent: React.ReactNode; color: string
}) {
  const status: 'success' | 'error' | 'running' = isPending ? 'running' :
    (lastSync?.status as 'success' | 'error' | 'running') ?? 'success'

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
      <div className="h-1" style={{ background: isPending ? color : (lastSync?.status === 'error' ? '#C0392B' : '#3A9E6A') }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-tq-snorkel">{title}</span>
              <SyncIndicator status={status} lastSync={lastSync?.finished_at ?? null} />
            </div>
            <p className="text-xs" style={{ color: '#b2b2b2' }}>{description}</p>
            {lastSync && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: '#b2b2b2' }}>
                <span>Registros: <strong className="text-tq-snorkel">{lastSync.records_updated ?? 0}</strong></span>
                <span>Duración: <strong className="text-tq-snorkel">
                  {lastSync.started_at && lastSync.finished_at
                    ? (() => {
                        const ms = new Date(lastSync.finished_at).getTime() - new Date(lastSync.started_at).getTime()
                        return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
                      })()
                    : '—'}
                </strong></span>
                <span>Por: <strong className="text-tq-snorkel">{lastSync.triggered_by}</strong></span>
              </div>
            )}
          </div>
          <button
            onClick={onSync}
            disabled={isPending}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: color }}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sincronizando…
              </span>
            ) : '↻ Sincronizar ahora'}
          </button>
        </div>

        {result && !isPending && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: result.ok ? 'rgba(58,158,106,0.08)' : 'rgba(192,57,43,0.08)',
              border: `1px solid ${result.ok ? 'rgba(58,158,106,0.25)' : 'rgba(192,57,43,0.25)'}`,
              color:      result.ok ? '#2d7a54' : '#992d22',
            }}>
            {statsComponent}
          </div>
        )}
      </div>
    </div>
  )
}
