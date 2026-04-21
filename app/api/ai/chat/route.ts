import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface ChatBody    { messages: ChatMessage[] }

// ── Context injection ──────────────────────────────────────────────

async function buildContext(lastMessage: string): Promise<string> {
  const supabase = createServiceClient()
  const msg = lastMessage.toLowerCase()

  const sections: string[] = []

  // Always: catalog summary
  const [productsRes, variantsRes] = await Promise.all([
    supabase.from('products').select('familia, metal, abc_ventas, ingresos_12m'),
    supabase.from('product_variants').select('stock_variante, precio_venta, es_variante_lider').eq('es_variante_lider', true),
  ])
  const products = productsRes.data ?? []
  const variants = variantsRes.data ?? []

  const totalModelos    = products.length
  const totalIngresos   = products.reduce((s, p) => s + Number(p.ingresos_12m ?? 0), 0)
  const modelosA        = products.filter(p => p.abc_ventas === 'A').length
  const totalStock      = variants.reduce((s, v) => s + Number(v.stock_variante ?? 0), 0)
  const sinStock        = variants.filter(v => Number(v.stock_variante ?? 0) === 0).length

  sections.push(`RESUMEN DEL CATÁLOGO:
- Total modelos: ${totalModelos}
- Ingresos 12m: ${totalIngresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
- Modelos ABC-A: ${modelosA} (${Math.round(modelosA / totalModelos * 100)}%)
- Unidades en stock: ${totalStock.toLocaleString('es-ES')}
- Modelos sin stock: ${sinStock}`)

  // Familia breakdown if asking about assortment/families
  if (/famil|surtido|categor|amplitud|profundidad/.test(msg)) {
    const familiaMap = new Map<string, { count: number; ingresos: number }>()
    for (const p of products) {
      const f = (p.familia as string) ?? 'Otras'
      const cur = familiaMap.get(f) ?? { count: 0, ingresos: 0 }
      familiaMap.set(f, { count: cur.count + 1, ingresos: cur.ingresos + Number(p.ingresos_12m ?? 0) })
    }
    const rows = Array.from(familiaMap.entries())
      .sort((a, b) => b[1].ingresos - a[1].ingresos)
      .slice(0, 10)
      .map(([f, d]) => `  ${f}: ${d.count} modelos, ${d.ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} ingresos`)
      .join('\n')
    sections.push(`FAMILIAS POR INGRESOS:\n${rows}`)
  }

  // Price context
  if (/precio|pvp|margen|descuento|coste/.test(msg)) {
    const precios = variants.map(v => Number(v.precio_venta ?? 0)).filter(p => p > 0)
    const sorted  = [...precios].sort((a, b) => a - b)
    sections.push(`PRECIOS:
- Precio medio: ${Math.round(precios.reduce((s, p) => s + p, 0) / (precios.length || 1))}€
- Precio mediano: ${sorted[Math.floor(sorted.length / 2)] ?? 0}€
- Precio mínimo: ${Math.min(...precios)}€
- Precio máximo: ${Math.max(...precios)}€`)
  }

  // Stock alerts
  if (/stock|inventario|cobertura|rotura/.test(msg)) {
    const { data: alertas } = await supabase
      .from('product_variants')
      .select('codigo_modelo, stock_variante')
      .eq('es_variante_lider', true)
      .eq('stock_variante', 0)

    const codigosAlerta = (alertas ?? [])
      .map(r => r.codigo_modelo as string)
      .slice(0, 15)

    if (codigosAlerta.length > 0) {
      const { data: prodsAlerta } = await supabase
        .from('products')
        .select('codigo_modelo, description, abc_ventas')
        .in('codigo_modelo', codigosAlerta)
        .eq('abc_ventas', 'A')

      if ((prodsAlerta ?? []).length > 0) {
        const rows = (prodsAlerta ?? []).map(p =>
          `  ${p.codigo_modelo}: ${p.description ?? '—'}`
        ).join('\n')
        sections.push(`ALERTAS ROTURA STOCK (ABC-A sin stock):\n${rows}`)
      }
    }
  }

  // Ventas históricas context
  if (/venta|vendid|ingreso|mes|mensual|histór|tendencia|evolución/.test(msg)) {
    const { data: ventasMes } = await supabase
      .from('ventas_mensuales')
      .select('anyo, mes, unidades_vendidas, ingresos_netos')
      .order('anyo', { ascending: false })
      .order('mes', { ascending: false })
      .limit(200)

    if (ventasMes && ventasMes.length > 0) {
      const byMonth = new Map<string, { unidades: number; ingresos: number }>()
      for (const r of ventasMes) {
        const key = `${r.anyo}-${String(r.mes).padStart(2, '0')}`
        const ex = byMonth.get(key) ?? { unidades: 0, ingresos: 0 }
        ex.unidades += Number(r.unidades_vendidas ?? 0)
        ex.ingresos += Number(r.ingresos_netos ?? 0)
        byMonth.set(key, ex)
      }
      const rows = Array.from(byMonth.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
        .map(([k, d]) => `  ${k}: ${d.unidades} uds, ${d.ingresos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`)
        .join('\n')
      sections.push(`VENTAS MENSUALES (últimos meses):\n${rows}`)
    }
  }

  // Reservas context
  if (/reserva|pedido pendiente|demanda/.test(msg)) {
    const { data: reservas } = await supabase
      .from('reservas_activas')
      .select('codigo_interno, reservas_count, unidades_reservadas')
      .order('reservas_count', { ascending: false })
      .limit(10)

    if (reservas && reservas.length > 0) {
      const totalRes = reservas.reduce((s, r) => s + Number(r.reservas_count ?? 0), 0)
      const rows = reservas.map(r => `  ${r.codigo_interno}: ${r.reservas_count} reservas`).join('\n')
      sections.push(`RESERVAS ACTIVAS (top 10, total: ${totalRes}):\n${rows}`)
    }
  }

  // Specific product code mentioned
  const codeMatch = lastMessage.match(/\b([0-9]{3}[A-Z]{2}[0-9]*)\b/)
  if (codeMatch) {
    const code = codeMatch[1]
    const { data: prod } = await supabase
      .from('products')
      .select('*, product_variants(*), product_shopify_data(*)')
      .eq('codigo_modelo', code)
      .single()

    if (prod) {
      sections.push(`PRODUCTO ${code}:
- Descripción: ${prod.description ?? '—'}
- Familia: ${prod.familia ?? '—'} | Metal: ${prod.metal ?? '—'} | Quilates: ${prod.karat ?? '—'}
- ABC ventas: ${prod.abc_ventas ?? '—'}
- Ingresos 12m: ${Number(prod.ingresos_12m ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
- Variantes: ${prod.num_variantes ?? '—'}`)
    }
  }

  return sections.join('\n\n')
}

// ── System prompt ──────────────────────────────────────────────────

const SYSTEM = `Eres el asistente analítico del PIM de Te Quiero Joyerías, una cadena de 17 joyerías en Canarias.
Tienes acceso a datos reales del catálogo de productos (440 modelos aprox., datos de Metabase y Shopify).

Responde en español, de forma concisa y útil. Si te preguntan por datos concretos, úsalos.
No inventes números que no aparezcan en el contexto. Si no tienes el dato, dilo claramente.
No escribas en la base de datos — solo informas y analizas.
Usa formato markdown para mayor claridad cuando sea útil (listas, negritas).`

// ── Route ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as ChatBody
    if (!messages?.length) return NextResponse.json({ error: 'Sin mensajes' }, { status: 400 })

    const lastUserMsg = messages.filter(m => m.role === 'user').at(-1)?.content ?? ''
    const context     = await buildContext(lastUserMsg)

    const systemWithContext = `${SYSTEM}\n\nCONTEXTO ACTUAL:\n${context}`

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemWithContext,
      messages:   messages.map(m => ({ role: m.role, content: m.content })),
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[ai/chat]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
