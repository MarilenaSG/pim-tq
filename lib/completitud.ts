export interface CompletiudInput {
  hasImagenPrimaria: boolean
  hasDescripcionShopify: boolean
  hasTituloSEO: boolean
  hasTags: boolean
  hasImagenAdicional: boolean
  camposCustomRellenos: number      // 0–1, proporción de campos rellenos
  totalCamposCustomActivos: number
}

export interface CompletiudDetalle {
  criterio: string
  peso: number
  cumplido: boolean
  puntos: number
  tab?: string
  generacion?: string
}

export interface CompletiudResult {
  score: number
  detalles: CompletiudDetalle[]
  nivel: 'alta' | 'media' | 'baja'
}

const BASE_CRITERIA = [
  { criterio: 'Imagen primaria',       peso: 25, key: 'hasImagenPrimaria',    tab: 'imagenes' },
  { criterio: 'Descripción Shopify',   peso: 20, key: 'hasDescripcionShopify', tab: 'shopify', gen: 'shopify_description' },
  { criterio: 'Título SEO Shopify',    peso: 15, key: 'hasTituloSEO',          tab: 'shopify', gen: 'seo_title' },
  { criterio: 'Tags Shopify',          peso: 10, key: 'hasTags',               tab: 'shopify', gen: 'tags' },
  { criterio: 'Imagen adicional',      peso: 10, key: 'hasImagenAdicional',    tab: 'imagenes' },
] as const

export function calcularCompletitud(input: CompletiudInput): CompletiudResult {
  const { camposCustomRellenos, totalCamposCustomActivos } = input

  const hasCustomCriteria = totalCamposCustomActivos > 0
  const customPuntos = hasCustomCriteria
    ? Math.round(camposCustomRellenos * 20)
    : 0

  // If no custom fields defined, redistribute the 20 points proportionally
  const scaleFactor = hasCustomCriteria ? 1 : 100 / 80

  const detalles: CompletiudDetalle[] = BASE_CRITERIA.map(c => {
    const cumplido = input[c.key as keyof CompletiudInput] as boolean
    const pesoAjustado = hasCustomCriteria ? c.peso : Math.round(c.peso * scaleFactor)
    return {
      criterio: c.criterio,
      peso: pesoAjustado,
      cumplido,
      puntos: cumplido ? pesoAjustado : 0,
      tab: c.tab,
      generacion: 'gen' in c ? c.gen : undefined,
    }
  })

  if (hasCustomCriteria) {
    const filled = Math.round(camposCustomRellenos * totalCamposCustomActivos)
    detalles.push({
      criterio: `Campos custom (${filled}/${totalCamposCustomActivos})`,
      peso: 20,
      cumplido: camposCustomRellenos >= 1,
      puntos: customPuntos,
      tab: 'custom',
    })
  }

  const score = Math.min(100, detalles.reduce((acc, d) => acc + d.puntos, 0))
  const nivel: CompletiudResult['nivel'] =
    score >= 80 ? 'alta' : score >= 40 ? 'media' : 'baja'

  return { score, detalles, nivel }
}

export const NIVEL_COLOR: Record<CompletiudResult['nivel'], { bar: string; text: string; bg: string }> = {
  alta:  { bar: '#3A9E6A', text: '#2d7a54', bg: 'rgba(58,158,106,0.1)'  },
  media: { bar: '#C8842A', text: '#a06818', bg: 'rgba(200,132,42,0.1)'  },
  baja:  { bar: '#C0392B', text: '#992d22', bg: 'rgba(192,57,43,0.1)'   },
}
