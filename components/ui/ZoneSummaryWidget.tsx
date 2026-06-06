'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Zone } from '@/types'
import type { CMSummary }      from '@/app/api/cm/summary/route'
import type { VentasSummary }  from '@/app/api/ventas/summary/route'
import type { StockSummary }   from '@/app/api/stock/summary/route'

type ZoneSummary =
  | { zone: 'cm';      data: CMSummary }
  | { zone: 'ventas';  data: VentasSummary }
  | { zone: 'stock';   data: StockSummary }
  | { zone: 'tiendas'; data: null }

const API_MAP: Record<Zone, string | null> = {
  cm:      '/api/cm/summary',
  ventas:  '/api/ventas/summary',
  stock:   '/api/stock/summary',
  tiendas: null,
}

const ZONE_COLORS: Record<Zone, string> = {
  cm:      '#00557f',
  ventas:  '#C8842A',
  stock:   '#3A9E6A',
  tiendas: '#8B5E1A',
}

function fmtEur(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K €`
  return `${n.toLocaleString('es-ES')} €`
}

function Kpi({ label, value, color, alert }: { label: string; value: string; color?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl p-3.5 ${alert ? 'ring-1 ring-red-300' : ''}`}
      style={{ background: 'white', border: '1px solid var(--tq-border)' }}>
      <p className="text-xs text-[#b2b2b2] font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? '#1d1d1b' }}>{value}</p>
    </div>
  )
}

function CMWidget({ d, color }: { d: CMSummary; color: string }) {
  const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Modelos activos"    value={d.total_modelos.toLocaleString('es-ES')} color={color} />
        <Kpi label="Familias"           value={d.total_familias.toString()} color={color} />
        <Kpi label="Ingresos 12m"       value={fmtEur(d.ingresos_12m)} color={color} />
        <Kpi label="Nuevos (60d)"       value={d.modelos_nuevos_60d.toString()} color="#3A9E6A" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="ABC-A"              value={d.modelos_abc_a.toString()} color={color} />
        <Kpi label="Sin ventas"         value={d.modelos_sin_ventas.toString()} color="#b2b2b2" />
        <Kpi label="En revisión"        value={d.en_revision.toString()} color="#C8842A" alert={d.en_revision > 0} />
        <Kpi label="A discontinuar"     value={d.a_discontinuar.toString()} color="#C0392B" alert={d.a_discontinuar > 0} />
      </div>
      <div className="flex gap-3 flex-wrap">
        {[
          { href: '/analytics/surtido',    label: 'Surtido →' },
          { href: '/analytics/ciclo-vida', label: 'Ciclo de vida →' },
          { href: '/analytics/precio',     label: 'Precio →' },
          { href: '/analytics/rentabilidad', label: 'Rentabilidad →' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `${color}12`, color }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function VentasWidget({ d, color }: { d: VentasSummary; color: string }) {
  const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const lastLabel = `${MESES[d.last_mes]} ${d.last_anyo}`
  const ytdChange = d.prev_ingresos > 0
    ? Math.round(((d.ytd_ingresos - (d.prev_ingresos / 12 * d.ytd_meses)) / (d.prev_ingresos / 12 * d.ytd_meses)) * 100)
    : null
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label={`YTD ${d.last_anyo}`}   value={fmtEur(d.ytd_ingresos)} color={color} />
        <Kpi label={lastLabel}              value={fmtEur(d.last_ingresos)} color={color} />
        <Kpi label="Vs año anterior"        value={ytdChange != null ? `${ytdChange >= 0 ? '▲' : '▼'} ${Math.abs(ytdChange)}%` : '—'}
          color={ytdChange != null ? (ytdChange >= 0 ? '#3A9E6A' : '#C0392B') : '#b2b2b2'} />
        <Kpi label={`Uds. ${lastLabel}`}    value={d.last_unidades.toLocaleString('es-ES')} color="#555" />
      </div>
      <div className="flex gap-3 flex-wrap">
        {[
          { href: '/ventas',            label: 'Dashboard ventas →' },
          { href: '/ventas/sell-out',   label: 'Sell-out →' },
          { href: '/campaigns',         label: 'Campañas →' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `${color}12`, color }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function StockWidget({ d, color }: { d: StockSummary; color: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Unidades stock"      value={d.total_unidades.toLocaleString('es-ES')} color={color} />
        <Kpi label="Sin stock"           value={d.modelos_sin_stock.toString()} color="#C0392B" alert={d.modelos_sin_stock > 5} />
        <Kpi label="Stock bajo (≤3)"     value={d.modelos_stock_bajo.toString()} color="#C8842A" alert={d.modelos_stock_bajo > 10} />
        <Kpi label="Cobertura media"
          value={d.cobertura_media_dias != null ? `${d.cobertura_media_dias}d` : '—'}
          color={color} />
      </div>
      <div className="flex gap-3 flex-wrap">
        {[
          { href: '/stock',         label: 'Dashboard stock →' },
          { href: '/stock?tab=alertas', label: 'Ver alertas →' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `${color}12`, color }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function TiendasWidget({ color }: { color: string }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {[
        { href: '/tiendas/boletin',  label: 'Boletín tiendas →' },
        { href: '/tiendas/catalogo', label: 'Catálogo →' },
      ].map(l => (
        <Link key={l.href} href={l.href}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: `${color}12`, color }}>
          {l.label}
        </Link>
      ))}
    </div>
  )
}

export function ZoneSummaryWidget() {
  const [zone, setZone]         = useState<Zone>('cm')
  const [result, setResult]     = useState<ZoneSummary | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const stored = (localStorage.getItem('tq_last_zone') ?? 'cm') as Zone
    setZone(stored)
  }, [])

  useEffect(() => {
    const url = API_MAP[zone]
    if (!url) {
      setResult({ zone: 'tiendas', data: null })
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(url)
      .then(r => r.json())
      .then(data => setResult({ zone, data } as ZoneSummary))
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [zone])

  const color = ZONE_COLORS[zone]

  const ZONE_LABELS: Record<Zone, string> = {
    cm:      'Category Management',
    ventas:  'Ventas',
    stock:   'Stock y Compras',
    tiendas: 'Tiendas',
  }

  return (
    <div className="tq-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
          Zona activa — {ZONE_LABELS[zone]}
        </h2>
        {loading && <span className="text-xs text-[#b2b2b2]">Cargando…</span>}
      </div>

      {!loading && result && (
        result.zone === 'cm'      ? <CMWidget      d={result.data} color={color} /> :
        result.zone === 'ventas'  ? <VentasWidget  d={result.data} color={color} /> :
        result.zone === 'stock'   ? <StockWidget   d={result.data} color={color} /> :
        <TiendasWidget color={color} />
      )}

      {!loading && !result && (
        <p className="text-xs text-[#b2b2b2]">No se pudieron cargar los datos.</p>
      )}
    </div>
  )
}
