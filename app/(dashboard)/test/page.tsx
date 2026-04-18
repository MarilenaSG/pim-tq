'use client'

import { useState } from 'react'
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  SyncIndicator,
  FeatureCard,
  ActivityFeed,
  EmptyState,
  ToastProvider,
  useToast,
  AnalyticsFilters,
} from '@/components/ui'
import type { AnalyticsFilterValues } from '@/components/ui'
import type { ActivityItem } from '@/types'

// ── Datos de demo ─────────────────────────────────────────────

const ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'sync',   title: 'Sync Metabase completado',       description: '440 productos actualizados',    timestamp: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: '2', type: 'edit',   title: 'Campo editado: Colección',       description: '002AA · por admin@tq.com',      timestamp: new Date(Date.now() - 32 * 60_000).toISOString() },
  { id: '3', type: 'export', title: 'Export a Google Sheets',         description: 'Catálogo Primavera 2026',        timestamp: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: '4', type: 'ai',     title: 'Descripción generada por IA',    description: '015CC · Claude Haiku',           timestamp: new Date(Date.now() - 5 * 3600_000).toISOString() },
  { id: '5', type: 'sync',   title: 'Sync Shopify completado',        description: '218 productos con imagen',       timestamp: new Date(Date.now() - 25 * 3600_000).toISOString() },
]

const DEFAULT_FILTERS: AnalyticsFilterValues = {
  category: '', familia: '', metal: '', karat: '', abc: '', dateFrom: '', dateTo: '',
}

// ── Toast demo button ─────────────────────────────────────────

function ToastDemo() {
  const { toast } = useToast()
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => toast('Sync completado correctamente', 'success')}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
        style={{ background: '#3A9E6A' }}
      >
        Toast success
      </button>
      <button
        onClick={() => toast('Error al conectar con Shopify', 'error')}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
        style={{ background: '#C0392B' }}
      >
        Toast error
      </button>
      <button
        onClick={() => toast('Exportando a Google Sheets…', 'info')}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
        style={{ background: '#0099f2' }}
      >
        Toast info
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function TestPage() {
  const [filters, setFilters] = useState<AnalyticsFilterValues>(DEFAULT_FILTERS)

  return (
    <ToastProvider>
      <div className="p-8 max-w-5xl space-y-12">
        {/* Header */}
        <PageHeader
          eyebrow="Design System"
          title="Componentes UI"
          subtitle="Verificación visual de todos los componentes base · Sesión 2"
          actions={
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(58,158,106,0.12)', color: '#2d7a54' }}
            >
              ✓ Sistema OK
            </span>
          }
        />

        {/* KpiCards */}
        <section>
          <SectionTitle>KpiCard</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Productos"     value="440"        sub="modelos únicos"          color="blue"    icon="◻" />
            <KpiCard label="Ingresos 12m"  value="2.148.320 €" sub="+12% vs año anterior"   color="green"   icon="€" />
            <KpiCard label="Sin imagen"    value="38"         sub="modelos pendientes"      color="amber"   icon="◫" />
            <KpiCard label="Stock 0"       value="12"         sub="variantes agotadas"      color="red"     icon="▣" />
          </div>
        </section>

        {/* StatusBadge */}
        <section>
          <SectionTitle>StatusBadge</SectionTitle>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="ok"      dot />
            <StatusBadge status="warn"    dot />
            <StatusBadge status="error"   dot />
            <StatusBadge status="info"    dot />
            <StatusBadge status="shopify" dot label="Shopify sync" />
            <StatusBadge status="imagen"  dot label="Imagen pendiente" />
            <StatusBadge status="ok"      label="440 productos" />
            <StatusBadge status="warn"    label="Sin precio" />
          </div>
        </section>

        {/* SyncIndicator */}
        <section>
          <SectionTitle>SyncIndicator</SectionTitle>
          <div className="flex flex-col gap-3">
            <SyncIndicator status="success" lastSync={new Date(Date.now() - 7 * 60_000)}   label="Metabase OK" />
            <SyncIndicator status="running" lastSync={null}                                  label="Shopify" />
            <SyncIndicator status="error"   lastSync={new Date(Date.now() - 2 * 3600_000)} label="Google Sheets" />
            <SyncIndicator status="success" lastSync={null} />
          </div>
        </section>

        {/* FeatureCard */}
        <section>
          <SectionTitle>FeatureCard</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureCard icon="◻" name="Lista de productos"     description="440 modelos con filtros por metal, categoría y ABC"  href="/products"         badge="440" />
            <FeatureCard icon="↻" name="Sincronización"         description="Conecta Metabase y Shopify con el PIM"               href="/settings/sync" />
            <FeatureCard icon="↗" name="Exportar a Sheets"      description="Genera un catálogo exportable a Google Sheets"       href="/export" />
            <FeatureCard icon="✦" name="IA: Generar contenido"  description="Descripciones y SEO con Claude Haiku"                href="/products"         badge="Nuevo" />
          </div>
        </section>

        {/* ActivityFeed */}
        <section>
          <SectionTitle>ActivityFeed</SectionTitle>
          <div
            className="bg-white rounded-xl p-4"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            <ActivityFeed items={ACTIVITY} />
          </div>
          <div
            className="mt-3 bg-white rounded-xl p-4"
            style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#0099f2' }}>
              Feed vacío
            </p>
            <ActivityFeed items={[]} />
          </div>
        </section>

        {/* EmptyState */}
        <section>
          <SectionTitle>EmptyState</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              <EmptyState
                icon="◻"
                message="Sin productos"
                description="Ejecuta el primer sync de Metabase para importar el catálogo"
                cta={{ label: 'Ir a sincronización', href: '/settings/sync' }}
              />
            </div>
            <div className="bg-white rounded-xl" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
              <EmptyState
                icon="↗"
                message="Sin exports recientes"
                description="Los exports a Google Sheets aparecerán aquí"
              />
            </div>
          </div>
        </section>

        {/* AnalyticsFilters */}
        <section>
          <SectionTitle>AnalyticsFilters</SectionTitle>
          <AnalyticsFilters
            values={filters}
            onChange={setFilters}
            categories={['Anillos', 'Pendientes', 'Colgantes', 'Pulseras', 'Collares']}
            familias={['Clásico', 'Infinity', 'Nature', 'Hombre']}
          />
          {(filters.metal || filters.karat || filters.abc || filters.category || filters.familia) && (
            <div
              className="text-xs px-4 py-2 rounded-lg font-medium"
              style={{ background: 'rgba(0,153,242,0.08)', color: '#007acc' }}
            >
              Filtros activos: {Object.entries(filters)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}=${v}`)
                .join(' · ')}
            </div>
          )}
        </section>

        {/* Toast */}
        <section>
          <SectionTitle>Toast</SectionTitle>
          <ToastDemo />
        </section>

        {/* PageHeader variants */}
        <section>
          <SectionTitle>PageHeader — variantes</SectionTitle>
          <div className="space-y-6 bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
            <PageHeader title="Dashboard" eyebrow="Principal" subtitle="Resumen del catálogo y estado de sincronización" />
            <hr style={{ borderColor: 'rgba(0,85,127,0.08)' }} />
            <PageHeader title="Lista de productos" subtitle="440 modelos · última sync hace 7 min"
              actions={
                <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#0099f2' }}>
                  + Nuevo campo
                </button>
              }
            />
          </div>
        </section>

        {/* Palette reference */}
        <section>
          <SectionTitle>Paleta de colores TQ</SectionTitle>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[
              { name: 'snorkel',  hex: '#00557f' },
              { name: 'sky',      hex: '#0099f2' },
              { name: 'alyssum',  hex: '#e8e3df' },
              { name: 'gold',     hex: '#c8a164' },
              { name: 'ok',       hex: '#3A9E6A' },
              { name: 'warn',     hex: '#C8842A' },
              { name: 'error',    hex: '#C0392B' },
              { name: 'info',     hex: '#2A5F9E' },
            ].map((c) => (
              <div key={c.name} className="flex flex-col items-center gap-1.5">
                <div className="w-full aspect-square rounded-xl" style={{ background: c.hex }} />
                <span className="text-[10px] font-bold text-tq-snorkel">{c.name}</span>
                <span className="text-[9px]" style={{ color: '#b2b2b2' }}>{c.hex}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ToastProvider>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-bold tracking-widest uppercase mb-4" style={{ color: '#0099f2' }}>
      {children}
    </h2>
  )
}
