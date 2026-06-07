import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30  // Vercel: extender timeout a 30s

const client = new Anthropic()

interface PaybackInfo {
  ebitdaPct:     number
  margenMensual: number | null
  paybackMeses:  number | null
}

export async function POST(req: NextRequest) {
  try {
    const {
      nombre,
      tipo,
      inversionTotal,
      opexPersonalPct,
      opexGastosPct,
      escenarios,
      paybacks,
    } = await req.json() as {
      nombre:          string | null
      tipo:            string | null
      inversionTotal:  number
      opexPersonalPct: number
      opexGastosPct:   number
      escenarios:      { params?: Record<string, unknown>; kpis?: Record<string, unknown> }[]
      paybacks:        PaybackInfo[]
    }

    const LABELS = ['Pesimista', 'Base', 'Optimista']

    const escResumen = escenarios.map((e, i) => {
      const p  = e.params  as { factorAjustePct?: number } | undefined
      const k  = e.kpis   as { unidades_total?: number; ingresos?: number; margen_pct?: number; breakeven_semanas?: number } | undefined
      const pb = paybacks[i]
      return `Escenario ${LABELS[i]}: ST ${p?.factorAjustePct ?? '—'}% · ${k?.unidades_total ?? '—'} uds · ${k?.ingresos ? Math.round(k.ingresos).toLocaleString('es-ES') + '€' : '—'} · MB ${k?.margen_pct ?? '—'}% · break-even sem.${k?.breakeven_semanas ?? '—'} · EBITDA ${pb?.ebitdaPct != null ? pb.ebitdaPct.toFixed(1) + '%' : '—'} · payback ${pb?.paybackMeses != null ? pb.paybackMeses + 'm' : 'n/a'}`
    }).join('\n')

    const tipoLabel = { sku: 'SKU nuevo', drop: 'Drop / Edición limitada', marca: 'Marca nueva' }[tipo ?? ''] ?? tipo ?? 'Lanzamiento'

    const prompt = `Eres el asesor de category management de Te Quiero, cadena de 19 joyerías en Canarias. El equipo considera viable un payback entre 4 y 6 meses.

Lanzamiento: "${nombre ?? 'Sin nombre'}" (${tipoLabel})
Inversión: ${inversionTotal ? Math.round(inversionTotal).toLocaleString('es-ES') + '€' : '—'} · OPEX: ${opexPersonalPct + opexGastosPct}%

${escResumen}

Responde en español, directo y accionable. Estructura exacta (sin introducción):

**¿Vale la pena lanzarlo?**
Una o dos frases directas sobre viabilidad basadas en el escenario base y el payback.

**Escenario más probable**
Cuál de los tres es más realista para joyería en Canarias y por qué.

**Riesgos principales**
- Riesgo concreto 1
- Riesgo concreto 2
- Riesgo concreto 3 (si aplica)

**Recomendación antes de confirmar**
Una acción concreta que el equipo debe revisar o ajustar.`

    // Streaming: el texto llega al cliente word-by-word
    const stream = client.messages.stream({
      model:      'claude-haiku-4-5',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    })

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type':  'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[insights] error:', err)
    return new Response('Error al generar conclusiones. Inténtalo de nuevo.', { status: 500 })
  }
}
