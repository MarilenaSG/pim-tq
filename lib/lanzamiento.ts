import type { SemanaProyeccion, LanzamientoEscenario } from '@/types'

// ── Cálculo de curva de demanda ───────────────────────────────
// Importable tanto en servidor como en cliente (paso 7).

export interface CalcularCurvaParams {
  unidadesPorTienda:     number
  nTiendas:              number
  semanasRampa:          number     // 1–12 semanas hasta alcanzar el pico base
  crecimientoSemanalPct: number     // 0–30% de crecimiento semanal post-rampa
  factorAjustePct:       number     // 50–150% ajuste sobre la referencia análoga
  precioVenta:           number
  coste:                 number
  descuentoPct:          number     // % descuento en semanas de promo
  semanasPromo:          number     // cuántas semanas dura el descuento
}

export function calcularCurva(params: CalcularCurvaParams): SemanaProyeccion[] {
  const {
    unidadesPorTienda, nTiendas, semanasRampa,
    crecimientoSemanalPct, factorAjustePct,
    precioVenta, coste, descuentoPct, semanasPromo,
  } = params

  const factor        = factorAjustePct / 100
  const baseTotal     = unidadesPorTienda * nTiendas * factor
  const inversionInit = coste * baseTotal   // para calcular break-even
  const SEMANAS       = 16

  const result: SemanaProyeccion[] = []
  let margenAcumulado   = 0
  let breakEvenAlcanzado = false

  for (let s = 1; s <= SEMANAS; s++) {
    let uds: number

    if (semanasRampa <= 1) {
      // Sin rampa: arranca a pleno rendimiento
      uds = baseTotal
    } else if (s <= semanasRampa) {
      // Rampa lineal: de 0 a baseTotal en semanasRampa semanas
      uds = baseTotal * (s / semanasRampa)
    } else {
      // Post-rampa: crecimiento compuesto desde el pico base
      const semanasPost = s - semanasRampa
      uds = baseTotal * Math.pow(1 + crecimientoSemanalPct / 100, semanasPost)
    }

    // Descuento promocional en las primeras N semanas
    const enPromo     = semanasPromo > 0 && descuentoPct > 0 && s <= semanasPromo
    const pvpEfectivo = enPromo ? precioVenta * (1 - descuentoPct / 100) : precioVenta

    const ingresos       = uds * pvpEfectivo
    const margenSemana   = uds * (pvpEfectivo - coste)
    margenAcumulado     += margenSemana

    if (!breakEvenAlcanzado && margenAcumulado >= inversionInit) {
      breakEvenAlcanzado = true
    }

    result.push({
      semana:             s,
      unidades:           Math.max(0, Math.round(uds)),
      ingresos:           Math.max(0, ingresos),
      margen:             margenSemana,
      margenAcumulado,
      breakEvenAlcanzado,
    })
  }

  return result
}

// ── KPIs resumen desde la curva ───────────────────────────────

export function calcularKpis(curva: SemanaProyeccion[], params: CalcularCurvaParams) {
  const unidades_total    = curva.reduce((s, r) => s + r.unidades, 0)
  const ingresos          = curva.reduce((s, r) => s + r.ingresos, 0)
  const margen_bruto      = curva.reduce((s, r) => s + r.margen, 0)
  const margen_pct        = ingresos > 0 ? (margen_bruto / ingresos) * 100 : 0
  const beRow             = curva.find(r => r.breakEvenAlcanzado)
  const breakeven_semanas = beRow ? beRow.semana : null

  return { unidades_total, ingresos, margen_bruto, margen_pct, breakeven_semanas }
}

// ── Escenario helper ──────────────────────────────────────────

export function crearEscenario(
  nombre: string,
  params: CalcularCurvaParams,
  confirmado = false,
): LanzamientoEscenario {
  const curva = calcularCurva(params)
  const kpis  = calcularKpis(curva, params)

  return {
    id:        crypto.randomUUID(),
    nombre,
    params:    {
      unidadesPorTienda:     params.unidadesPorTienda,
      nTiendas:              params.nTiendas,
      semanasRampa:          params.semanasRampa,
      crecimientoSemanalPct: params.crecimientoSemanalPct,
      factorAjustePct:       params.factorAjustePct,
      precioVenta:           params.precioVenta,
      coste:                 params.coste,
      descuentoPct:          params.descuentoPct,
      semanasPromo:          params.semanasPromo,
    },
    kpis: {
      unidades_total:    kpis.unidades_total,
      ingresos:          kpis.ingresos,
      margen_bruto:      kpis.margen_bruto,
      margen_pct:        kpis.margen_pct,
      breakeven_semanas: kpis.breakeven_semanas ?? 99,
    },
    confirmado,
  }
}

// ── Clusters estáticos (TODO: reemplazar con query tiendas) ──

export const CLUSTERS = [
  { id: 'A', label: 'Cluster A', descripcion: 'Flagship',          nTiendas: 5, color: '#3A9E6A' },
  { id: 'B', label: 'Cluster B', descripcion: 'Estándar',          nTiendas: 8, color: '#0099f2' },
  { id: 'C', label: 'Cluster C', descripcion: 'Pequeñas / Turísticas', nTiendas: 4, color: '#C8842A' },
] as const

export function nTiendasDesdeClusters(clusters: string[]): number {
  return clusters.reduce((sum, id) => {
    const c = CLUSTERS.find(cl => cl.id === id)
    return sum + (c ? c.nTiendas : 0)
  }, 0)
}

// ── Formatters ────────────────────────────────────────────────

export function fmtEur(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export function fmtPct(n: number | null | undefined, dec = 1) {
  if (n == null) return '—'
  return n.toFixed(dec) + '%'
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Calcular MB en tiempo real ────────────────────────────────

export function calcularMb(pvp: number | null, coste: number | null): number | null {
  if (!pvp || !coste || pvp <= 0) return null
  return ((pvp - coste) / pvp) * 100
}

export function mbColor(mb: number | null, umbral = 40): string {
  if (mb == null) return '#8fa8b8'
  if (mb >= umbral) return '#3A9E6A'
  if (mb >= umbral - 5) return '#C8842A'
  return '#C0392B'
}

// ── Fecha de entrega necesaria ────────────────────────────────

export function fechaEntregaNecesaria(
  fechaLanzamiento: string | null,
  leadTimeSemanas:  number,
): string | null {
  if (!fechaLanzamiento) return null
  const d = new Date(fechaLanzamiento + 'T00:00:00')
  d.setDate(d.getDate() - leadTimeSemanas * 7)
  return d.toISOString().slice(0, 10)
}
