import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type GenerationType = 'shopify_description' | 'seo_title' | 'tags' | 'catalog_description'

interface GenerateBody {
  codigo_modelo: string
  type:          GenerationType
}

// ── Brand voice context ────────────────────────────────────────────

const BRAND_CONTEXT = `
Eres el redactor de contenidos de Te Quiero Joyerías, una cadena de 17 joyerías en las Islas Canarias.
La marca TQ Jewels vende joyería de oro y plata de alta calidad, con un tono cercano, elegante y moderno.
El público objetivo son mujeres de 25-55 años en Canarias, con poder adquisitivo medio-alto.

Reglas de marca:
- Tono: cálido, sofisticado, sin exageración
- No uses palabras como "increíble", "perfecto", "asombroso"
- Prioriza la artesanía, los materiales nobles y el significado emocional de la joya
- Los precios se expresan en euros (€) con formato español
- Idioma: español de España (tuteo, no voseo)
- No inventes características que no aparezcan en los datos del producto
`.trim()

// ── Prompt builders ────────────────────────────────────────────────

function buildPrompt(type: GenerationType, product: Record<string, unknown>, shopify: Record<string, unknown> | null): string {
  const meta = [
    `Código: ${product.codigo_modelo}`,
    product.description ? `Descripción interna: ${product.description}` : null,
    product.familia      ? `Familia: ${product.familia}` : null,
    product.category     ? `Categoría: ${product.category}` : null,
    product.metal        ? `Metal: ${product.metal}` : null,
    product.karat        ? `Quilates: ${product.karat}` : null,
    shopify?.shopify_vendor ? `Marca/Línea: ${shopify.shopify_vendor}` : null,
    shopify?.shopify_tags && Array.isArray(shopify.shopify_tags) && shopify.shopify_tags.length > 0
      ? `Tags actuales: ${(shopify.shopify_tags as string[]).join(', ')}` : null,
    shopify?.shopify_description
      ? `Descripción actual en Shopify: ${String(shopify.shopify_description).replace(/<[^>]+>/g, ' ').trim().slice(0, 300)}` : null,
  ].filter(Boolean).join('\n')

  const prompts: Record<GenerationType, string> = {
    shopify_description: `${BRAND_CONTEXT}

Datos del producto:
${meta}

Genera una descripción de producto para Shopify en HTML básico (párrafos <p> y listas <ul><li> si procede).
- Longitud: 80-150 palabras
- Destaca materiales, artesanía y para qué ocasión es ideal
- No uses <h1> ni <h2>, solo <p>, <ul>, <li>
- Devuelve únicamente el HTML, sin explicaciones`,

    seo_title: `${BRAND_CONTEXT}

Datos del producto:
${meta}

Genera un título SEO optimizado para Shopify.
- Longitud: 50-70 caracteres
- Incluye el tipo de joya, el metal y la marca/línea si aplica
- Formato: [Tipo de joya] [Metal] [Característica clave] | Te Quiero Joyerías
- Devuelve únicamente el título, sin comillas ni explicaciones`,

    tags: `${BRAND_CONTEXT}

Datos del producto:
${meta}

Genera entre 8 y 15 tags de Shopify para este producto.
- Tags útiles para filtrado: tipo de joya, metal, quilates, ocasión, estilo, colección
- Formato: una lista de tags separados por comas (sin comillas, sin numeración)
- Ejemplo: anillo, oro amarillo, 18k, solitario, compromiso, regalo, minimalista
- Devuelve únicamente los tags separados por comas`,

    catalog_description: `${BRAND_CONTEXT}

Datos del producto:
${meta}

Genera una descripción corta para el catálogo interno de tiendas.
- Longitud: 1-2 frases, máximo 40 palabras
- Tono informativo y directo, sin florituras
- Incluye el tipo de joya, metal y característica distintiva
- Devuelve únicamente la descripción, sin comillas ni explicaciones`,
  }

  return prompts[type]
}

// ── Route handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GenerateBody
    const { codigo_modelo, type } = body

    if (!codigo_modelo || !type) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const [productRes, shopifyRes] = await Promise.all([
      supabase.from('products').select('*').eq('codigo_modelo', codigo_modelo).single(),
      supabase.from('product_shopify_data').select('*').eq('codigo_modelo', codigo_modelo).maybeSingle(),
    ])

    if (!productRes.data) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const prompt = buildPrompt(
      type,
      productRes.data as Record<string, unknown>,
      shopifyRes.data as Record<string, unknown> | null
    )

    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    return NextResponse.json({ content })
  } catch (err) {
    console.error('[ai/generate-content]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
