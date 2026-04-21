import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { familia, ladderData } = await request.json()

    const prompt = `Eres analista de category management de una joyería llamada Te Quiero en Canarias.
Analiza este price ladder de la familia "${familia}" y genera exactamente 3-4 observaciones accionables en español. Sé conciso y específico.

Datos del ladder:
${JSON.stringify(ladderData, null, 2)}

Responde ÚNICAMENTE con JSON válido en este formato exacto:
{"insights": ["observación 1", "observación 2", "observación 3"]}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('ladder-insights error:', err)
    return NextResponse.json({ insights: [] }, { status: 500 })
  }
}
