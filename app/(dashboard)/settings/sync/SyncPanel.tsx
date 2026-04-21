'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  triggerMetabaseSync,
  triggerShopifySync,
  triggerVentasSync,
  triggerReservasSync,
  disconnectShopify,
  type SyncActionResult,
} from './actions'
import { SyncIndicator } from '@/components/ui'
import type { SyncLog } from '@/types'

interface SyncPanelProps {
  lastMetabaseSync: SyncLog | null
  lastShopifySync:  SyncLog | null
  lastVentasSync:   SyncLog | null
  lastReservasSync: SyncLog | null
  recentLogs:       SyncLog[]
  shopifyConnected: boolean
  shopifyShop:      string | null
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

function MetaStats({ result }: { result: SyncActionResult }) {
  if (!result.ok) return <span>✕ {result.error ?? result.errors?.join(', ')}</span>
  return (
    <span>
      ✓ {result.modelsUpserted} modelos · {result.variantsUpserted} variantes · {result.imagesUpserted} imágenes
    </span>
  )
}

function ShopifyStats({ result }: { result: SyncActionResult }) {
  if (!result.ok) return <span>✕ {result.error ?? result.errors?.join(', ')}</span>
  return (
    <span>
      ✓ {result.productsProcessed} productos · {result.shopifyDataUpserted} fichas · {result.imagesUpserted} imágenes
      {result.skippedNoMatch ? ` · ${result.skippedNoMatch} sin match` : ''}
    </span>
  )
}

export function SyncPanel({
  lastMetabaseSync,
  lastShopifySync,
  lastVentasSync,
  lastReservasSync,
  recentLogs,
  shopifyConnected,
  shopifyShop,
}: SyncPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [metaPending,       startMetaTrans]       = useTransition()
  const [shopifyPending,    startShopifyTrans]    = useTransition()
  const [ventasPending,     startVentasTrans]     = useTransition()
  const [reservasPending,   startReservasTrans]   = useTransition()
  const [disconnectPending, startDisconnectTrans] = useTransition()
  const [metaResult,    setMetaResult]    = useState<SyncActionResult | null>(null)
  const [shopifyResult, setShopifyResult] = useState<SyncActionResult | null>(null)
  const [ventasResult,  setVentasResult]  = useState<SyncActionResult | null>(null)
  const [reservasResult, setReservasResult] = useState<SyncActionResult | null>(null)

  // Show OAuth result from URL param
  const oauthResult = searchParams.get('shopify')

  function handleMetaSync() {
    setMetaResult(null)
    startMetaTrans(async () => {
      const res = await triggerMetabaseSync()
      setMetaResult(res)
      router.refresh()
    })
  }

  function handleShopifySync() {
    setShopifyResult(null)
    startShopifyTrans(async () => {
      const res = await triggerShopifySync()
      setShopifyResult(res)
      router.refresh()
    })
  }

  function handleVentasSync() {
    setVentasResult(null)
    startVentasTrans(async () => {
      const res = await triggerVentasSync()
      setVentasResult(res)
      router.refresh()
    })
  }

  function handleReservasSync() {
    setReservasResult(null)
    startReservasTrans(async () => {
      const res = await triggerReservasSync()
      setReservasResult(res)
      router.refresh()
    })
  }

  function handleDisconnect() {
    startDisconnectTrans(async () => {
      await disconnectShopify()
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* OAuth result banner */}
      {oauthResult === 'connected' && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(58,158,106,0.08)', border: '1px solid rgba(58,158,106,0.25)', color: '#2d7a54' }}>
          ✓ Shopify conectado correctamente. Ya puedes sincronizar.
        </div>
      )}
      {oauthResult === 'error' && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', color: '#992d22' }}>
          ✕ Error al conectar Shopify: {searchParams.get('reason') ?? 'desconocido'}
        </div>
      )}

      {/* ── Metabase card ─────────────────────────────────────── */}
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

      {/* ── Shopify card ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <div className="h-1" style={{ background: shopifyPending ? '#0099f2' : (lastShopifySync?.status === 'error' ? '#C0392B' : shopifyConnected ? '#3A9E6A' : '#c6c6c6') }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-tq-snorkel">Shopify Admin API</span>
                {shopifyConnected ? (
                  <SyncIndicator
                    status={shopifyPending ? 'running' : (lastShopifySync?.status ?? 'success') as 'success' | 'error' | 'running'}
                    lastSync={lastShopifySync?.finished_at ?? null}
                  />
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(200,132,42,0.12)', color: '#a06818' }}>
                    No conectado
                  </span>
                )}
              </div>
              <p className="text-xs mb-2" style={{ color: '#b2b2b2' }}>
                Productos, imágenes y datos de Shopify → product_shopify_data + product_images
              </p>

              {shopifyConnected && shopifyShop && (
                <p className="text-xs font-medium" style={{ color: '#00557f' }}>
                  Tienda: <span className="font-mono">{shopifyShop}</span>
                </p>
              )}
              {!shopifyConnected && (
                <div className="mt-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(200,132,42,0.07)', border: '1px solid rgba(200,132,42,0.2)', color: '#a06818' }}>
                  Conecta la tienda con OAuth para sincronizar. Asegúrate de que{' '}
                  <code className="font-mono">SHOPIFY_SHOP_DOMAIN</code> termine en{' '}
                  <code className="font-mono">.myshopify.com</code>
                </div>
              )}

              {lastShopifySync && shopifyConnected && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: '#b2b2b2' }}>
                  <span>Registros: <strong className="text-tq-snorkel">{lastShopifySync.records_updated ?? 0}</strong></span>
                  <span>Duración: <strong className="text-tq-snorkel">{formatDuration(lastShopifySync.started_at, lastShopifySync.finished_at)}</strong></span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 items-end shrink-0">
              {shopifyConnected ? (
                <button
                  onClick={handleShopifySync}
                  disabled={shopifyPending || disconnectPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#0099f2' }}
                >
                  {shopifyPending ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sincronizando…
                    </span>
                  ) : '↻ Sincronizar ahora'}
                </button>
              ) : (
                <a
                  href="/api/shopify/oauth/start"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white no-underline transition-opacity hover:opacity-85"
                  style={{ background: '#00557f' }}
                >
                  Conectar Shopify →
                </a>
              )}
              {shopifyConnected && (
                <button
                  onClick={handleDisconnect}
                  disabled={shopifyPending || disconnectPending}
                  className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: '#b2b2b2' }}
                >
                  {disconnectPending ? 'Desconectando…' : 'Reconectar / cambiar token'}
                </button>
              )}
            </div>
          </div>

          {/* Shopify result */}
          {shopifyResult && !shopifyPending && (
            <div className="mt-4 px-4 py-3 rounded-lg text-sm"
              style={{
                background:   shopifyResult.ok ? 'rgba(58,158,106,0.08)' : 'rgba(192,57,43,0.08)',
                border: `1px solid ${shopifyResult.ok ? 'rgba(58,158,106,0.25)' : 'rgba(192,57,43,0.25)'}`,
                color:        shopifyResult.ok ? '#2d7a54' : '#992d22',
              }}>
              <ShopifyStats result={shopifyResult} />
            </div>
          )}
        </div>
      </div>

      {/* ── Ventas mensuales card ─────────────────────────────── */}
      <SyncCard
        title="Ventas mensuales"
        description="Histórico mensual de ventas por variante → ventas_mensuales"
        lastSync={lastVentasSync}
        isPending={ventasPending}
        result={ventasResult}
        onSync={handleVentasSync}
        statsComponent={ventasResult ? (
          ventasResult.ok
            ? <span>✓ {ventasResult.rowsUpserted} filas actualizadas</span>
            : <span>✕ {ventasResult.error ?? ventasResult.errors?.join(', ')}</span>
        ) : null}
        color="#C8842A"
      />

      {/* ── Reservas activas card ─────────────────────────────── */}
      <SyncCard
        title="Reservas activas"
        description="Snapshot diario de reservas por variante → reservas_activas (reemplaza todos los datos)"
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

      {/* ── Sync log ──────────────────────────────────────────── */}
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
                    <td className="px-4 py-3">
                      <LogStatusBadge status={log.status} />
                    </td>
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
                    : '—'
                  }
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
              background:   result.ok ? 'rgba(58,158,106,0.08)' : 'rgba(192,57,43,0.08)',
              border: `1px solid ${result.ok ? 'rgba(58,158,106,0.25)' : 'rgba(192,57,43,0.25)'}`,
              color:        result.ok ? '#2d7a54' : '#992d22',
            }}>
            {statsComponent}
          </div>
        )}
      </div>
    </div>
  )
}
