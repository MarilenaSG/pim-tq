/**
 * Parseo de números de los CSV de Metabase.
 *
 * Metabase puede exportar con formato ("162.010,03", europeo) o sin formato
 * ("162010.03", punto decimal) — tras una actualización los CSV públicos pasaron
 * a venir sin formato. Como "12.345" es ambiguo valor a valor, el formato se
 * detecta una vez por CSV con detectNumberFormat() y se pasa a parseNumber().
 */
export type NumberFormat = 'eu' | 'dot' | 'auto'

const EU_DECIMAL  = /^-?\d{1,3}(\.\d{3})*,\d+$|^-?\d+,\d+$/  // "162.010,03", "0,45"
const EU_THOUSAND = /^-?\d{1,3}(\.\d{3})+$/                   // "1.905", "1.234.567" (ambiguo si solo hay un punto)
const DOT_DECIMAL = /^-?\d*\.\d+$/                             // "263.99", "10040.3000", "0.455"

function clean(val: string): string {
  return val.trim().replace(/\s/g, '').replace(/€|%/g, '')
}

/** Decide el formato numérico de un CSV a partir de valores de sus columnas numéricas. */
export function detectNumberFormat(samples: readonly (string | undefined | null)[]): NumberFormat {
  let eu = false
  let dot = false
  for (const raw of samples) {
    if (!raw) continue
    const s = clean(raw)
    if (EU_DECIMAL.test(s) || /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) eu = true
    else if (DOT_DECIMAL.test(s) && !EU_THOUSAND.test(s)) dot = true
    if (eu && dot) return 'auto'
  }
  if (eu) return 'eu'
  if (dot) return 'dot'
  return 'auto'
}

/**
 *   format 'eu'  : "162.010,03" → 162010.03 · "1.905" → 1905
 *   format 'dot' : "162010.03"  → 162010.03 · "12.345" → 12.345
 *   format 'auto': si hay coma, europeo; un único punto con exactamente 3 dígitos
 *                  detrás, o varios puntos, se tratan como miles; si no, decimal.
 */
export function parseNumber(val: string | undefined | null, format: NumberFormat = 'auto'): number | null {
  if (val == null) return null
  const s = clean(val)
  if (s === '' || s === '-') return null

  let cleaned: string
  if (format === 'eu' || (format === 'auto' && s.includes(','))) {
    cleaned = s.replace(/\./g, '').replace(',', '.')
  } else if (format === 'dot') {
    cleaned = s.replace(/,/g, '')
  } else {
    const dots = (s.match(/\./g) ?? []).length
    cleaned = dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(s) ? s.replace(/\./g, '') : s
  }

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
