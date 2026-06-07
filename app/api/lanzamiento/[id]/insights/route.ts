import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { LanzamientoEscenario } from '@/types'

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
      escenarios:      LanzamientoEscenario[]
      paybacks:        PaybackInfo[]
    }

    const LABELS = ['Pesimista', 'Base', 'Optimista']

    const escResumen = escenarios.map((e, i) => {
      const p  = e.params  as { factorAjustePct?: number; semanasRampa?: number; crecimientoSemanalPct?: number }
      const k  = e.kpis
      const pb = paybacks[i]
      return `
Escenario ${LABELS[i]}:
  Sell-through: ${p?.factorAjustePct ?? '—'}% del stock
  Unidades vendidas (16 sem.): ${k?.unidades_total ?? '—'} uds
  Ingresos: ${k?.ingresos ? k.ingresos.toLocaleString('es-ES') + '€' : '—'}
  Margen bruto: ${k?.margen_pct ?? '—'}%
  Break-even: semana ${k?.breakeven_semanas ?? '—'}
  EBITDA: ${pb?.ebitdaPct != null ? pb.ebitdaPct.toFixed(1) + '%' : '—'}
  Payback: ${pb?.paybackMeses != null ? pb.paybackMeses + ' meses' : 'no calculable'}
  Margen mensual: ${pb?.margenMensual != null ? pb.margenMensual.toLocaleString('es-ES') + '€/mes' : '—'}`
    }).join('\n')

    const tipoLabel = { sku: 'SKU nuevo', drop: 'Drop / Edición limitada', marca: 'Marca nueva' }[tipo ?? ''] ?? tipo ?? 'Lanzamiento'

    const prompt = `Eres el asesor de category management de Te Quiero, una cadena de 19 joyerías en Canarias. Analiza este lanzamiento y da conclusiones concretas y directas. El equipo considera viable un payback entre 4 y 6 meses.

Lanzamiento: "${nombre ?? 'Sin nombre'}" (${tipoLabel})
Inversión total: ${inversionTotal ? inversionTotal.toLocaleString('es-ES') + '€' : '—'}
OPEX: personal ${opexPersonalPct}% + gastos ${opexGastosPct}% = ${opexPersonalPct + opexGastosPct}% sobre ventas

${escResumen}

Responde en español, de forma directa y accionable. Usa exactamente esta estructura:

**¿Vale la pena lanzarlo?**
Una o dos frases directas sobre la viabilidad basándote en el escenario base y el payback.

**Escenario más probable**
Cuál de los tres es más realista para joyería en Canarias y por qué. 2-3 frases.

**Riesgos principales**
- Riesgo 1 concreto
- Riesgo 2 concreto
- Riesgo 3 si aplica

**Recomendación antes de confirmar**
Una o dos acciones concretas que el equipo debería revisar o ajustar.`

    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    })

    const insights = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ insights })
  } catch (err) {
    console.error('[insights] error:', err)
    return NextResponse.json({ insights: 'Error al generar conclusiones. Inténtalo de nuevo.' }, { status: 500 })
  }
}
