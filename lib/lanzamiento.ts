import type { SemanaProyeccion, LanzamientoEscenario, Tienda } from '@/types'

// ── Cálculo de curva de demanda ───────────────────────────────
// Importable tanto en servidor como en cliente (paso 7).

export interface CalcularCurvaParams {
  unidadesTotalCompra:   number     // total de unidades pedidas al proveedor
  semanasRampa:          number     // 1–12 semanas hasta alcanzar el pico base
  crecimientoSemanalPct: number     // 0–30% de crecimiento semanal post-rampa
  factorAjustePct:       number     // 50–150% ajuste para escenarios pesimista/optimista
  precioVenta:           number
  coste:                 number
  descuentoPct:          number     // % descuento en semanas de promo
  semanasPromo:          number     // cuántas semanas dura el descuento
}

// ── Pesos de distribución por cluster ────────────────────────
// Un Flagship recibe más stock que una tienda Estándar, y esta más que una Pequeña.
export const CLUSTER_WEIGHTS: Record<string, number> = {
  A: 1.5,   // Flagship
  B: 1.0,   // Estándar (referencia)
  C: 0.5,   // Pequeña
}

/**
 * Calcula cuántas unidades corresponden a cada cluster y a cada tienda
 * dado un total de unidades a comprar y los clusters seleccionados.
 */
export function calcularDistribucionPorCluster(
  unidadesTotalCompra: number,
  tiendas: import('@/types').Tienda[],
  clustersSeleccionados: string[],
): {
  clusterId:   string
  nTiendas:    number
  udsPorTienda: number   // valor exacto (con decimales) para cálculos
  udsCluster:  number   // redondeado para mostrar
}[] {
  const tiendaActivas = tiendas.filter(
    t => t.cluster != null && clustersSeleccionados.includes(t.cluster),
  )
  // Peso total ponderado
  const pesoTotal = tiendaActivas.reduce(
    (sum, t) => sum + (CLUSTER_WEIGHTS[t.cluster!] ?? 1),
    0,
  )
  if (pesoTotal === 0) return []

  // Una "unidad de peso" cuántas unidades reales vale
  const udsPorPeso = unidadesTotalCompra / pesoTotal

  return clustersSeleccionados.map(clusterId => {
    const nTiendas    = tiendaActivas.filter(t => t.cluster === clusterId).length
    const weight      = CLUSTER_WEIGHTS[clusterId] ?? 1
    const udsPorTienda = udsPorPeso * weight
    return {
      clusterId,
      nTiendas,
      udsPorTienda,
      udsCluster: Math.round(udsPorTienda * nTiendas),
    }
  }).filter(r => r.nTiendas > 0)
}

export function calcularCurva(params: CalcularCurvaParams): SemanaProyeccion[] {
  const {
    unidadesTotalCompra, semanasRampa,
    crecimientoSemanalPct, factorAjustePct,
    precioVenta, coste, descuentoPct, semanasPromo,
  } = params

  const factor = factorAjustePct / 100
  // Stock total comprado (ajustado por factor del escenario) — nunca se puede vender más
  const totalStock    = unidadesTotalCompra * factor
  const inversionInit = coste * totalStock
  const SEMANAS       = 16

  // ── Paso 1: generar pesos de distribución (forma de la curva) ──
  // La curva define CÓMO se distribuyen las ventas a lo largo del tiempo,
  // no cuántas unidades hay. Luego escalamos al totalStock.
  const rawWeights: number[] = []
  for (let s = 1; s <= SEMANAS; s++) {
    let w: number
    if (semanasRampa <= 1) {
      // Sin rampa: distribución uniforme
      w = 1
    } else if (s <= semanasRampa) {
      // Rampa lineal: empieza despacio, llega al pico al final de la rampa
      w = s / semanasRampa
    } else {
      // Post-rampa: crecimiento compuesto sobre el pico (=1)
      const semanasPost = s - semanasRampa
      w = Math.pow(1 + crecimientoSemanalPct / 100, semanasPost)
    }
    rawWeights.push(w)
  }

  // ── Paso 2: escalar pesos para que sumen exactamente totalStock ──
  const sumWeights = rawWeights.reduce((a, b) => a + b, 0)
  const scale      = sumWeights > 0 ? totalStock / sumWeights : 0

  // ── Paso 3: calcular proyección semana a semana ──
  const result: SemanaProyeccion[] = []
  let margenAcumulado    = 0
  let breakEvenAlcanzado = false

  for (let s = 1; s <= SEMANAS; s++) {
    const uds = rawWeights[s - 1] * scale

    // Descuento promocional en las primeras N semanas
    const enPromo     = semanasPromo > 0 && descuentoPct > 0 && s <= semanasPromo
    const pvpEfectivo = enPromo ? precioVenta * (1 - descuentoPct / 100) : precioVenta

    const ingresos     = uds * pvpEfectivo
    const margenSemana = uds * (pvpEfectivo - coste)
    margenAcumulado   += margenSemana

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
      unidadesTotalCompra:   params.unidadesTotalCompra,
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

// ── Clusters — metadatos de display (counts vienen de la tabla tiendas) ──

export const CLUSTERS = [
  { id: 'A', label: 'Cluster A', descripcion: 'Flagship', color: '#3A9E6A' },
  { id: 'B', label: 'Cluster B', descripcion: 'Estándar', color: '#0099f2' },
  { id: 'C', label: 'Cluster C', descripcion: 'Pequeña',  color: '#C8842A' },
] as const

export type ClusterId = 'A' | 'B' | 'C'

/** Cuenta tiendas activas en los clusters seleccionados usando datos reales de la tabla tiendas */
export function nTiendasDesdeClusters(clusters: string[], tiendas: Tienda[]): number {
  return tiendas.filter(t => t.cluster != null && clusters.includes(t.cluster)).length
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
