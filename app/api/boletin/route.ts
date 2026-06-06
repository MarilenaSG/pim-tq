import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import type { BoletinCategoria } from '@/types'

export interface BoletinItem {
  codigo_modelo:    string
  description:      string | null
  familia:          string | null
  metal:            string | null
  karat:            string | null
  precio_venta:     number | null
  precio_tachado:   number | null
  descuento_aplicado: number | null
  stock_total:      number
  image_url:        string | null
  categoria:        BoletinCategoria
  categoria_origen: 'override' | 'auto'
  nota_interna:     string | null
  primera_entrada:  string | null
}

// ── Boletín auto-categorization rules ────────────────────────
// Priority order: campaña > nuevo > outlet > retirar
// A product can only appear in one category.
function autoCategorize(p: {
  en_campaña_activa: boolean
  dias_en_catalogo: number
  descuento_aplicado: number | null
  is_discontinued: boolean
  sin_ventas_dias: number | null
}): BoletinCategoria | null {
  if (p.en_campaña_activa) return 'campaña'
  if (p.dias_en_catalogo <= 60) return 'nuevo'          // ≤ 2 meses
  if ((p.descuento_aplicado ?? 0) >= 15) return 'outlet' // descuento ≥ 15%
  if (p.is_discontinued) return 'retirar'
  if ((p.sin_ventas_dias ?? 0) > 180) return 'retirar'   // sin ventas > 6m
  return null  // not noteworthy
}

export async function GET() {
  const supabase = createServerClient()

  const today = new Date()

  // ── 1. Fetch active campaigns ────────────────────────────────
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('estado', 'activa')
    .lte('fecha_inicio', today.toISOString().slice(0, 10))
    .or(`fecha_fin.is.null,fecha_fin.gte.${today.toISOString().slice(0, 10)}`)

  const activeCampaignIds = (activeCampaigns ?? []).map(c => c.id as string)

  let productosEnCampaña = new Set<string>()
  if (activeCampaignIds.length > 0) {
    const { data: cpRows } = await supabase
      .from('campaign_products')
      .select('codigo_modelo')
      .in('campaign_id', activeCampaignIds)
    for (const r of cpRows ?? []) productosEnCampaña.add(r.codigo_modelo as string)
  }

  // ── 2. Fetch products with leader variant data ───────────────
  const { data: products } = await supabase
    .from('products')
    .select(`
      codigo_modelo, description, familia, metal, karat,
      primera_entrada, is_discontinued,
      product_variants!inner(
        precio_venta, precio_tachado, descuento_aplicado, stock_variante, es_variante_lider
      )
    `)

  // ── 3. Fetch primary images ──────────────────────────────────
  const { data: images } = await supabase
    .from('product_images')
    .select('codigo_modelo, url')
    .eq('is_primary', true)

  const imageMap = Object.fromEntries(
    (images ?? []).map(img => [img.codigo_modelo as string, img.url as string])
  )

  // ── 4. Fetch active overrides ────────────────────────────────
  const { data: overrides } = await supabase
    .from('boletin_overrides')
    .select('codigo_modelo, categoria, nota_interna, activo, expira_en')
    .eq('activo', true)
    .or(`expira_en.is.null,expira_en.gte.${today.toISOString().slice(0, 10)}`)

  const overrideMap = new Map<string, { categoria: BoletinCategoria; nota_interna: string | null }>(
    (overrides ?? []).map(o => [
      o.codigo_modelo as string,
      { categoria: o.categoria as BoletinCategoria, nota_interna: o.nota_interna as string | null },
    ])
  )

  // ── 5. Build boletin items ───────────────────────────────────
  const items: BoletinItem[] = []

  for (const p of products ?? []) {
    const codigo = p.codigo_modelo as string
    const variants = (p as unknown as { product_variants: Record<string, unknown>[] }).product_variants ?? []

    const leader = variants.find((v) => v.es_variante_lider) ?? variants[0]
    const stockTotal = variants.reduce((sum, v) => sum + ((v.stock_variante as number) ?? 0), 0)

    const diasEnCatalogo = p.primera_entrada
      ? Math.floor((today.getTime() - new Date(p.primera_entrada).getTime()) / 86_400_000)
      : 9999

    // Auto-categorize
    const autoCategoria = autoCategorize({
      en_campaña_activa: productosEnCampaña.has(codigo),
      dias_en_catalogo:  diasEnCatalogo,
      descuento_aplicado: leader ? (leader.descuento_aplicado as number | null) : null,
      is_discontinued:   p.is_discontinued as boolean,
      sin_ventas_dias:   null, // TODO: derive from ventas_mensuales once available
    })

    // Apply override if present, else use auto
    const override = overrideMap.get(codigo)
    const categoria = override?.categoria ?? autoCategoria
    if (!categoria) continue  // product has no relevant categorization

    items.push({
      codigo_modelo:     codigo,
      description:       p.description as string | null,
      familia:           p.familia as string | null,
      metal:             p.metal as string | null,
      karat:             p.karat as string | null,
      precio_venta:      leader ? (leader.precio_venta as number | null) : null,
      precio_tachado:    leader ? (leader.precio_tachado as number | null) : null,
      descuento_aplicado: leader ? (leader.descuento_aplicado as number | null) : null,
      stock_total:       stockTotal,
      image_url:         imageMap[codigo] ?? null,
      categoria,
      categoria_origen:  override ? 'override' : 'auto',
      nota_interna:      override?.nota_interna ?? null,
      primera_entrada:   p.primera_entrada as string | null,
    })
  }

  // Sort: campaña → nuevo → outlet → retirar, then by description
  const ORDER: Record<BoletinCategoria, number> = { campaña: 0, nuevo: 1, outlet: 2, retirar: 3 }
  items.sort((a, b) =>
    ORDER[a.categoria] - ORDER[b.categoria] ||
    (a.description ?? '').localeCompare(b.description ?? '', 'es')
  )

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}

// ── POST: create or update override ───────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { codigo_modelo, categoria, nota_interna, expira_en, creado_por } = body

    if (!codigo_modelo || !categoria) {
      return NextResponse.json({ error: 'codigo_modelo y categoria son obligatorios' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Deactivate any existing override for this model
    await supabase
      .from('boletin_overrides')
      .update({ activo: false })
      .eq('codigo_modelo', codigo_modelo)
      .eq('activo', true)

    // Insert new override
    const { data, error } = await supabase
      .from('boletin_overrides')
      .insert({
        codigo_modelo,
        categoria,
        nota_interna: nota_interna || null,
        activo:       true,
        expira_en:    expira_en || null,
        creado_por:   creado_por || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── DELETE: deactivate override for a model ───────────────────
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const codigo_modelo = searchParams.get('codigo_modelo')
  if (!codigo_modelo) return NextResponse.json({ error: 'codigo_modelo requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('boletin_overrides')
    .update({ activo: false })
    .eq('codigo_modelo', codigo_modelo)
    .eq('activo', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
