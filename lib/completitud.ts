export interface CompletiudInput {
  hasImagenPrimaria: boolean
  hasImagenAdicional: boolean
  hasDescripcionCustom: boolean   // nota_interna o campo custom de descripción
  camposCustomRellenos: number
  totalCamposCustomActivos: number
}

export interface CompletiudDetalle {
  criterio: string
  peso: number
  cumplido: boolean
  puntos: number
  tab?: string
}

export interface CompletiudResult {
  score: number
  detalles: CompletiudDetalle[]
  nivel: 'alta' | 'media' | 'baja'
}

const BASE_CRITERIA = [
  { criterio: 'Imagen primaria',     peso: 40, key: 'hasImagenPrimaria',    tab: 'imagenes' },
  { criterio: 'Imagen adicional',    peso: 20, key: 'hasImagenAdicional',   tab: 'imagenes' },
  { criterio: 'Descripción interna', peso: 20, key: 'hasDescripcionCustom', tab: 'custom'   },
] as const

export function calcularCompletitud(input: CompletiudInput): CompletiudResult {
  const { camposCustomRellenos, totalCamposCustomActivos } = input

  const hasCustomCriteria = totalCamposCustomActivos > 0
  const customPuntos = hasCustomCriteria ? Math.round(camposCustomRellenos * 20) : 0
  const scaleFactor  = hasCustomCriteria ? 1 : 100 / 80

  const detalles: CompletiudDetalle[] = BASE_CRITERIA.map(c => {
    const cumplido      = input[c.key as keyof CompletiudInput] as boolean
    const pesoAjustado  = hasCustomCriteria ? c.peso : Math.round(c.peso * scaleFactor)
    return { criterio: c.criterio, peso: pesoAjustado, cumplido, puntos: cumplido ? pesoAjustado : 0, tab: c.tab }
  })

  if (hasCustomCriteria) {
    const filled = Math.round(camposCustomRellenos * totalCamposCustomActivos)
    detalles.push({
      criterio: `Campos custom (${filled}/${totalCamposCustomActivos})`,
      peso: 20, cumplido: camposCustomRellenos >= 1, puntos: customPuntos, tab: 'custom',
    })
  }

  const score  = Math.min(100, detalles.reduce((acc, d) => acc + d.puntos, 0))
  const nivel: CompletiudResult['nivel'] = score >= 80 ? 'alta' : score >= 40 ? 'media' : 'baja'

  return { score, detalles, nivel }
}

export const NIVEL_COLOR: Record<CompletiudResult['nivel'], { bar: string; text: string; bg: string }> = {
  alta:  { bar: '#3A9E6A', text: '#2d7a54', bg: 'rgba(58,158,106,0.1)'  },
  media: { bar: '#C8842A', text: '#a06818', bg: 'rgba(200,132,42,0.1)'  },
  baja:  { bar: '#C0392B', text: '#992d22', bg: 'rgba(192,57,43,0.1)'   },
}
