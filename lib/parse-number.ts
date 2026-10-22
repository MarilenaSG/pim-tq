/**
 * Parsea números de los CSV de Metabase, que mezclan formatos según la columna:
 *   "162.010,03" → 162010.03   (europeo: punto miles, coma decimal)
 *   "1.905"      → 1905        (europeo: solo separador de miles)
 *   "263.99"     → 263.99      (punto decimal)
 *   "10040.3000" → 10040.3     (punto decimal con muchos decimales)
 *   "1234"       → 1234
 *
 * Regla: si hay coma, es formato europeo. Si no hay coma, un único punto seguido
 * de exactamente 3 dígitos se trata como separador de miles; varios puntos también;
 * en cualquier otro caso el punto es decimal.
 */
export function parseNumber(val: string | undefined | null): number | null {
  if (val == null) return null
  const s = val.trim().replace(/\s/g, '').replace(/€|%/g, '')
  if (s === '' || s === '-') return null

  let cleaned: string
  if (s.includes(',')) {
    cleaned = s.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = (s.match(/\./g) ?? []).length
    if (dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) {
      cleaned = s.replace(/\./g, '')
    } else {
      cleaned = s
    }
  }

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
