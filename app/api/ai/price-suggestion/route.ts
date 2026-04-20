import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface PriceSuggestion {
  precio_venta_sugerido:    number
  precio_tachado_sugerido:  number | null
  margen_resultante:        number
  razonamiento:             string
  alertas:                  string[]
}

interface SuggestionBody {
  codigo_modelo: string
}

export async function POST(req: NextRequest) {
  try {
    const { codigo_modelo } = await req.json() as SuggestionBody
    if (!codigo_modelo) return NextResponse.json({ error: 'Falta codigo_modelo' }, { status: 400 })

    const supabase = createServiceClient()

    const [productRes, leaderRes, rulesRes] = await Promise.all([
      supabase.from('products').select('*').eq('codigo_modelo', codigo_modelo).single(),
      supabase.from('product_variants')
        .select('precio_venta, precio_tachado, descuento_aplicado, cost_price_medio, pct_margen_bruto, margen_bruto, ingresos_slug_12m, abc_ventas')
        .eq('codigo_modelo', codigo_modelo)
        .eq('es_variante_lider', true)
        .maybeSingle(),
      supabase.from('pricing_rules').select('*'),
    ])

    if (!productRes.data) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const p      = productRes.data
    const leader = leaderRes.data
    const rules  = rulesRes.data ?? []

    // Match the most specific pricing rule (familia+metal+karat > familia+metal > familia)
    const matchRule = rules.find(r =>
      r.familia === p.familia && r.metal === p.metal && r.karat === p.karat
    ) ?? rules.find(r =>
      r.familia === p.familia && r.metal === p.metal && !r.karat
    ) ?? rules.find(r =>
      r.familia === p.familia && !r.metal && !r.karat
    )

    const prompt = `Eres un experto en category management de joyería para Te Quiero Joyerías (Canarias).
Tu tarea es sugerir el precio de venta óptimo para el siguiente producto.

DATOS DEL PRODUCTO:
- Código: ${p.codigo_modelo}
- Descripción: ${p.description ?? '—'}
- Familia: ${p.familia ?? '—'}
- Categoría: ${p.category ?? '—'}
- Metal: ${p.metal ?? '—'} ${p.karat ? `(${p.karat})` : ''}
- Proveedor: ${p.supplier_name ?? '—'}
- ABC ventas: ${p.abc_ventas ?? 'sin dato'}

DATOS FINANCIEROS (variante líder):
- Precio de venta actual: ${leader?.precio_venta ?? 'sin dato'} €
- Precio tachado actual: ${leader?.precio_tachado ?? 'ninguno'} €
- Coste medio: ${leader?.cost_price_medio ?? 'sin dato'} €
- Margen bruto actual: ${leader?.pct_margen_bruto ?? 'sin dato'}%
- Ingresos 12m (variante líder): ${leader?.ingresos_slug_12m ?? 'sin dato'} €

REGLA DE PRICING APLICABLE:${matchRule ? `
- Margen objetivo: ${matchRule.margen_objetivo_pct}%
- Redondeo: ${matchRule.redondeo} (99 = terminar en 99, 00 = terminar en 00, text = libre)
- Descuento mínimo permitido: ${matchRule.descuento_minimo_pct ?? 0}%` : `
- Sin regla definida para este producto. Usa criterio de joyería premium: margen 45-60%.`}

INSTRUCCIONES:
1. Calcula el precio de venta sugerido aplicando el margen objetivo sobre el coste
2. Si no hay coste, estima a partir del precio actual y el margen objetivo
3. Aplica el redondeo indicado (ej: 99 → 199€, 349€, 99€; 00 → 200€, 350€)
4. Decide si conviene precio tachado (solo si hay descuento real, mínimo el descuento_minimo_pct)
5. Calcula el margen resultante con el precio sugerido
6. Añade alertas si: margen < 35%, precio baja más de 20% respecto al actual, o producto ABC-A sin stock reciente

Responde ÚNICAMENTE con un JSON válido, sin texto adicional:
{
  "precio_venta_sugerido": <número entero>,
  "precio_tachado_sugerido": <número entero o null>,
  "margen_resultante": <número con 1 decimal>,
  "razonamiento": "<explicación breve de 2-3 frases>",
  "alertas": ["<alerta1>", "<alerta2>"]
}`

    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'

    // Strip potential markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const suggestion = JSON.parse(jsonStr) as PriceSuggestion

    return NextResponse.json(suggestion)
  } catch (err) {
    console.error('[ai/price-suggestion]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
