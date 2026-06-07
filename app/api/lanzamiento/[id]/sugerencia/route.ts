import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/lanzamiento/[id]/sugerencia
 * Genera una recomendación de la IA en función del paso y el contexto actual.
 *
 * Body: { paso: number, contexto: Record<string, unknown> }
 * Response: { sugerencia: string }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { paso, contexto } = (await req.json()) as {
    paso:     number
    contexto: Record<string, unknown>
  }

  const supabase = createServerClient()

  const { data: lanzamiento } = await supabase
    .from('lanzamientos')
    .select('nombre, familia, metal, precio_venta, coste, margen_objetivo, clusters_objetivo, unidades_por_tienda, n_tiendas, tipo')
    .eq('id', params.id)
    .single()

  if (!lanzamiento) {
    return NextResponse.json({ error: 'Lanzamiento no encontrado' }, { status: 404 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'IA no configurada' }, { status: 503 })
  }

  let prompt = ''

  if (paso === 3) {
    // Validación de la distribución propuesta
    const totalUds   = contexto.total_unidades as number ?? 0
    const mediaVentas = contexto.media_ventas as number | null
    const clusters   = (contexto.clusters as string[] ?? []).join(', ')
    const mediaTexto = mediaVentas != null
      ? `La media mensual de venta de referencias similares es de ${mediaVentas} uds/mes.`
      : 'No hay suficiente histórico de referencias similares.'

    prompt = `Eres un analista de Category Management para Te Quiero Jewels, cadena de 19 joyerías en Canarias.

Están planificando el lanzamiento: "${lanzamiento.nombre ?? 'Nuevo lanzamiento'}"
- Familia: ${lanzamiento.familia ?? '—'}
- Tipo: ${lanzamiento.tipo ?? '—'}
- PVP: ${lanzamiento.precio_venta ?? '—'}€
- Clusters seleccionados: ${clusters || '—'}
- Unidades totales propuestas para el pedido inicial: ${totalUds}
- ${mediaTexto}

Evalúa si la cantidad del pedido inicial es adecuada. Ten en cuenta el riesgo de sobre-stock si la demanda no se confirma en las primeras semanas. Responde en 2-3 frases directas y prácticas en español. No uses listas ni viñetas.`
  } else if (paso === 4) {
    // Recomendación de referencia análoga
    type RefCtx = { nombre: string; avg_uds_mes: number; precio_venta: number; mb_pct: number | null }
    const refs = (contexto.referencias as RefCtx[] ?? [])
    const refsList = refs.length
      ? refs.map((r, i) =>
          `${i + 1}. ${r.nombre} — ${r.avg_uds_mes} uds/mes, ${r.precio_venta}€, MB: ${r.mb_pct != null ? r.mb_pct.toFixed(0) + '%' : '—'}`,
        ).join('\n')
      : 'Ninguna referencia encontrada.'

    prompt = `Eres un analista de Category Management para Te Quiero Jewels.

Están planificando el lanzamiento de: "${lanzamiento.nombre ?? 'Nuevo producto'}"
- Familia: ${lanzamiento.familia ?? '—'}
- Metal: ${lanzamiento.metal ?? '—'}
- PVP: ${lanzamiento.precio_venta ?? '—'}€
- Margen objetivo: ${lanzamiento.margen_objetivo ?? '—'}%

Referencias análogas encontradas en el catálogo histórico (últimos 12 meses):
${refsList}

¿Cuál de estas referencias es la más relevante para anclar la proyección de demanda? Explica en 2-3 frases por qué esa referencia es la más comparable. Sé directo y práctico. Responde en español sin usar listas ni viñetas.`
  } else {
    return NextResponse.json({ sugerencia: 'Paso no soportado aún.' })
  }

  try {
    const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 350,
      messages:   [{ role: 'user', content: prompt }],
    })

    const sugerencia = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ sugerencia })
  } catch (e) {
    console.error('[sugerencia-ia]', e)
    return NextResponse.json({ error: 'Error al consultar la IA' }, { status: 500 })
  }
}
