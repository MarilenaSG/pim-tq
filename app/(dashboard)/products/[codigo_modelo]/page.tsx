import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import { AiContentPanel } from './AiContentPanel'
import { ProductComments } from './ProductComments'
import { calcularCompletitud, NIVEL_COLOR } from '@/lib/completitud'
import type {
  Product, ProductVariant, ProductImage,
  ProductShopifyData, ProductCustomField, CustomFieldDefinition, AbcRating,
} from '@/types'

// ── Tabs ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'resumen',   label: 'Resumen'       },
  { key: 'variantes', label: 'Variantes'     },
  { key: 'imagenes',  label: 'Imágenes'      },
  { key: 'shopify',   label: 'Shopify'       },
  { key: 'custom',    label: 'Campos custom' },
  { key: 'ia',        label: '✦ IA'          },
  { key: 'notas',     label: 'Notas'         },
] as const

type TabKey = typeof TABS[number]['key']

const VALID_TABS = TABS.map(t => t.key)

// ── Page ──────────────────────────────────────────────────────────

export default async function ProductPage({
  params,
  searchParams,
}: {
  params:       { codigo_modelo: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const { codigo_modelo } = params
  const rawTab = searchParams.tab as string | undefined
  const tab: TabKey = (VALID_TABS.includes(rawTab as TabKey) ? rawTab : 'resumen') as TabKey

  const supabase = createServerClient()
  const user = await getCurrentUser()

  const [productRes, variantsRes, imagesRes, shopifyRes, customFieldsRes, fieldDefsRes] =
    await Promise.all([
      supabase.from('products').select('*').eq('codigo_modelo', codigo_modelo).single(),
      supabase.from('product_variants').select('*').eq('codigo_modelo', codigo_modelo).order('codigo_interno'),
      supabase.from('product_images').select('*').eq('codigo_modelo', codigo_modelo)
        .order('is_primary', { ascending: false }).order('orden'),
      supabase.from('product_shopify_data').select('*').eq('codigo_modelo', codigo_modelo).maybeSingle(),
      supabase.from('product_custom_fields').select('*').eq('codigo_modelo', codigo_modelo),
      supabase.from('custom_field_definitions').select('*').eq('is_active', true).order('field_key'),
    ])

  if (!productRes.data) return notFound()

  const product      = productRes.data      as Product
  const variants     = (variantsRes.data    ?? []) as ProductVariant[]
  const images       = (imagesRes.data      ?? []) as ProductImage[]
  const shopify      = (shopifyRes.data     ?? null) as ProductShopifyData | null
  const customFields = (customFieldsRes.data ?? []) as ProductCustomField[]
  const fieldDefs    = (fieldDefsRes.data   ?? []) as CustomFieldDefinition[]

  const primaryImage = images.find(img => img.is_primary) ?? images[0] ?? null

  return (
    <div className="p-6 max-w-6xl space-y-5">

      {/* Back link + header */}
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 transition-opacity hover:opacity-70"
          style={{ color: '#0099f2' }}
        >
          ← Productos
        </Link>
        <PageHeader
          eyebrow={[product.metal, product.karat, product.category].filter(Boolean).join(' · ')}
          title={product.codigo_modelo}
          subtitle={product.description ?? ''}
        />
      </div>

      {/* Tab nav */}
      <nav className="flex gap-0.5 border-b" style={{ borderColor: 'rgba(0,85,127,0.1)' }}>
        {TABS.map(t => {
          const active = t.key === tab
          const badge =
            t.key === 'variantes' ? variants.length :
            t.key === 'imagenes'  ? images.length   : 0
          return (
            <Link
              key={t.key}
              href={`/products/${codigo_modelo}?tab=${t.key}`}
              scroll={false}
              className="px-4 py-2.5 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap"
              style={{
                color:        active ? '#0099f2' : '#b2b2b2',
                borderBottom: active ? '2px solid #0099f2' : '2px solid transparent',
                background:   active ? 'rgba(0,153,242,0.04)' : 'transparent',
              }}
            >
              {t.label}
              {badge > 0 && (
                <span
                  className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(0,85,127,0.08)', color: '#00557f' }}
                >
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Tab content */}
      {tab === 'resumen'   && <TabResumen   product={product} primaryImage={primaryImage} images={images} variants={variants} shopify={shopify} customFields={customFields} fieldDefs={fieldDefs} />}
      {tab === 'variantes' && <TabVariantes variants={variants} />}
      {tab === 'imagenes'  && <TabImagenes  images={images} />}
      {tab === 'shopify'   && <TabShopify   shopify={shopify} />}
      {tab === 'custom'    && <CustomFieldsEditor fieldDefs={fieldDefs} customFields={customFields} codigo={codigo_modelo} />}
      {tab === 'ia'        && <AiContentPanel codigoModelo={codigo_modelo} />}
      {tab === 'notas'     && <ProductComments codigo_modelo={codigo_modelo} userEmail={user?.email ?? null} />}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtEuro(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function AbcChip({ abc }: { abc: AbcRating }) {
  if (!abc) return <span style={{ color: '#d0cdc9' }}>—</span>
  const cfg: Record<string, { bg: string; text: string }> = {
    A: { bg: 'rgba(58,158,106,0.12)',  text: '#2d7a54' },
    B: { bg: 'rgba(0,153,242,0.12)',   text: '#007acc' },
    C: { bg: 'rgba(200,132,42,0.12)',  text: '#a06818' },
  }
  const { bg, text } = cfg[abc] ?? { bg: 'rgba(0,85,127,0.06)', text: '#b2b2b2' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: bg, color: text }}
    >
      {abc}
    </span>
  )
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(0,85,127,0.06)' }}>
      <span className="w-36 shrink-0 text-xs font-semibold" style={{ color: '#b2b2b2' }}>{label}</span>
      <span className="text-sm text-tq-snorkel">{children}</span>
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────────

function TabResumen({
  product, primaryImage, images, variants, shopify, customFields, fieldDefs,
}: {
  product: Product
  primaryImage: ProductImage | null
  images: ProductImage[]
  variants: ProductVariant[]
  shopify: ProductShopifyData | null
  customFields: ProductCustomField[]
  fieldDefs: CustomFieldDefinition[]
}) {
  const leader = variants.find(v => v.es_variante_lider)

  const activeDefs = fieldDefs.filter(d => d.is_active)
  const filledKeys = new Set(customFields.filter(f => f.field_value).map(f => f.field_key))
  const camposRatio = activeDefs.length > 0
    ? activeDefs.filter(d => filledKeys.has(d.field_key)).length / activeDefs.length
    : 0

  const completitud = calcularCompletitud({
    hasImagenPrimaria:       images.some(i => i.is_primary),
    hasDescripcionShopify:   !!(shopify?.shopify_description),
    hasTituloSEO:            !!(shopify?.shopify_seo_title),
    hasTags:                 !!(shopify?.shopify_tags?.length),
    hasImagenAdicional:      images.length >= 2,
    camposCustomRellenos:    camposRatio,
    totalCamposCustomActivos: activeDefs.length,
  })
  const col = NIVEL_COLOR[completitud.nivel]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* Left: image */}
      <div className="lg:col-span-1">
        <div
          className="rounded-xl overflow-hidden aspect-square flex items-center justify-center"
          style={{ background: '#f5f3f0' }}
        >
          {primaryImage ? (
            <img src={primaryImage.url} alt={primaryImage.alt_text ?? product.codigo_modelo} className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2" style={{ color: '#d0cdc9' }}>
              <span className="text-4xl">◫</span>
              <span className="text-xs">Sin imagen</span>
            </div>
          )}
        </div>
        {primaryImage && (
          <p className="mt-1.5 text-[10px] text-center font-medium" style={{ color: '#b2b2b2' }}>
            {primaryImage.source} · {primaryImage.variante ? `talla ${primaryImage.variante}` : 'imagen principal'}
          </p>
        )}
      </div>

      {/* Right: details */}
      <div className="lg:col-span-2 space-y-5">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'ABC ventas',    value: <AbcChip abc={product.abc_ventas} /> },
            { label: 'Ingresos 12m',  value: fmtEuro(product.ingresos_12m) },
            { label: 'Variantes',     value: String(product.num_variantes ?? variants.length) },
            { label: 'Precio líder',  value: fmtEuro(leader?.precio_venta ?? null) },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="bg-white rounded-xl px-4 py-3"
              style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}
            >
              <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#b2b2b2' }}>
                {kpi.label}
              </div>
              <div className="text-base font-bold text-tq-snorkel">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Completitud card */}
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: col.bg, border: `1px solid ${col.bar}30` }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: col.text }}>
              Completitud de ficha — {completitud.score}%
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold capitalize"
              style={{ background: col.bar, color: '#fff' }}
            >
              {completitud.nivel}
            </span>
          </div>
          <div className="w-full h-2 rounded-full mb-4" style={{ background: 'rgba(0,0,0,0.08)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${completitud.score}%`, background: col.bar }}
            />
          </div>
          <ul className="space-y-1.5">
            {completitud.detalles.map(d => (
              <li key={d.criterio} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2" style={{ color: d.cumplido ? col.text : '#b2b2b2' }}>
                  <span>{d.cumplido ? '✓' : '✗'}</span>
                  {d.criterio}
                </span>
                {!d.cumplido && d.tab && (
                  <Link
                    href={`/products/${product.codigo_modelo}?tab=${d.tab}${d.generacion ? `&gen=${d.generacion}` : ''}`}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors"
                    style={{ background: 'rgba(0,153,242,0.1)', color: '#0099f2' }}
                  >
                    {d.generacion ? 'Generar con IA' : 'Ir →'}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Product fields */}
        <div className="bg-white rounded-xl px-5 py-1" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <DataRow label="Categoría">{product.category ?? '—'}</DataRow>
          <DataRow label="Familia">{product.familia ?? '—'}</DataRow>
          <DataRow label="Metal">{product.metal ?? '—'}</DataRow>
          <DataRow label="Quilates">{product.karat ?? '—'}</DataRow>
          <DataRow label="Proveedor">
            {product.supplier_name
              ? <Link href={`/suppliers?highlight=${encodeURIComponent(product.supplier_name)}`} className="text-tq-sky hover:underline font-medium">{product.supplier_name}</Link>
              : '—'}
          </DataRow>
          <DataRow label="1ª entrada">{fmtDate(product.primera_entrada)}</DataRow>
          <DataRow label="Variante líder">
            <span className="font-mono text-xs">{product.variante_lider ?? '—'}</span>
          </DataRow>
          <DataRow label="ABC unidades"><AbcChip abc={product.abc_unidades} /></DataRow>
          <DataRow label="Shopify">
            {shopify ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: shopify.shopify_status === 'active' ? '#3A9E6A' : '#C8842A' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: shopify.shopify_status === 'active' ? '#3A9E6A' : '#C8842A' }} />
                {shopify.shopify_status ?? 'desconocido'} · {shopify.shopify_handle}
              </span>
            ) : (
              <span style={{ color: '#d0cdc9' }}>Sin datos de Shopify</span>
            )}
          </DataRow>
        </div>

        {/* Sync timestamps */}
        <div
          className="flex flex-wrap gap-4 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'rgba(0,85,127,0.03)', border: '1px solid rgba(0,85,127,0.08)' }}
        >
          <span style={{ color: '#b2b2b2' }}>
            <span className="font-semibold text-tq-snorkel">Metabase: </span>
            {fmtDate(product.metabase_synced_at)}
          </span>
          <span style={{ color: '#b2b2b2' }}>
            <span className="font-semibold text-tq-snorkel">Shopify: </span>
            {fmtDate(product.shopify_synced_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Variantes ────────────────────────────────────────────────

function TabVariantes({ variants }: { variants: ProductVariant[] }) {
  if (variants.length === 0) {
    return (
      <div className="text-center py-16 text-sm" style={{ color: '#b2b2b2' }}>
        Sin variantes. Ejecuta el sync de Metabase.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)', minWidth: 1020 }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,85,127,0.08)' }}>
              {['Slug (ERP)', 'Cód. interno', 'Var.', '★', 'Precio venta', 'Tachado', 'Dto.', 'Coste medio', 'Margen', '% Margen', 'Stock', 'ABC', 'Ingresos 12m', 'Tiendas'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b2b2b2' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr
                key={v.codigo_interno}
                className="transition-colors"
                style={{
                  borderBottom: i < variants.length - 1 ? '1px solid rgba(0,85,127,0.05)' : 'none',
                  background:   v.es_variante_lider ? 'rgba(0,153,242,0.03)' : undefined,
                }}
              >
                <td className="px-3 py-2 font-mono text-xs font-bold text-tq-sky">{v.slug ?? v.codigo_interno}</td>
                <td className="px-3 py-2 font-mono text-xs text-tq-snorkel">{v.codigo_interno}</td>
                <td className="px-3 py-2 font-mono text-xs font-bold text-tq-snorkel">{v.variante ?? '—'}</td>
                <td className="px-3 py-2 text-center text-xs" style={{ color: v.es_variante_lider ? '#C8842A' : '#e8e3df' }}>★</td>
                <td className="px-3 py-2 font-mono text-xs text-right text-tq-snorkel">{fmtEuro(v.precio_venta)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right" style={{ color: '#b2b2b2' }}>{fmtEuro(v.precio_tachado)}</td>
                <td className="px-3 py-2 text-xs text-right" style={{ color: v.descuento_aplicado ? '#C8842A' : '#b2b2b2' }}>
                  {v.descuento_aplicado ? fmtPct(v.descuento_aplicado) : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-right" style={{ color: '#b2b2b2' }}>{fmtEuro(v.cost_price_medio)}</td>
                <td className="px-3 py-2 font-mono text-xs text-right" style={{ color: '#b2b2b2' }}>{fmtEuro(v.margen_bruto)}</td>
                <td className="px-3 py-2 text-xs text-right">
                  <span style={{ color: (v.pct_margen_bruto ?? 0) >= 40 ? '#3A9E6A' : '#C8842A' }}>
                    {fmtPct(v.pct_margen_bruto)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-center font-bold text-tq-snorkel">{v.stock_variante ?? '—'}</td>
                <td className="px-3 py-2"><AbcChip abc={v.abc_ventas} /></td>
                <td className="px-3 py-2 font-mono text-xs text-right text-tq-snorkel">{fmtEuro(v.ingresos_slug_12m)}</td>
                <td className="px-3 py-2 text-xs text-center" style={{ color: '#b2b2b2' }}>{v.num_tiendas_activo ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-center" style={{ color: '#b2b2b2' }}>
        ★ Variante líder · Coste y margen: solo lectura · Datos de Metabase
      </p>
    </div>
  )
}

// ── Tab: Imágenes ─────────────────────────────────────────────────

function TabImagenes({ images }: { images: ProductImage[] }) {
  if (images.length === 0) {
    return (
      <div className="text-center py-16 text-sm" style={{ color: '#b2b2b2' }}>
        Sin imágenes. Las imágenes se sincronizan desde Metabase (S3) y Shopify.
      </div>
    )
  }

  const sourceCfg: Record<string, { bg: string; text: string; label: string }> = {
    s3:      { bg: 'rgba(0,153,242,0.12)',  text: '#007acc', label: 'S3' },
    shopify: { bg: 'rgba(58,158,106,0.12)', text: '#2d7a54', label: 'Shopify' },
    manual:  { bg: 'rgba(200,132,42,0.12)', text: '#a06818', label: 'Manual' },
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {images.map(img => {
        const src = sourceCfg[img.source] ?? sourceCfg.manual
        return (
          <div
            key={img.id}
            className="bg-white rounded-xl overflow-hidden relative"
            style={{ boxShadow: img.is_primary ? '0 0 0 2px #0099f2' : '0 2px 6px rgba(0,32,60,0.08)' }}
          >
            <div className="aspect-square bg-[#f5f3f0]">
              <img src={img.url} alt={img.alt_text ?? ''} className="w-full h-full object-contain" />
            </div>
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: src.bg, color: src.text }}
                >
                  {src.label}
                </span>
                {img.is_primary && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(0,153,242,0.12)', color: '#007acc' }}
                  >
                    Principal
                  </span>
                )}
              </div>
              {img.variante && (
                <p className="text-[10px] font-mono" style={{ color: '#b2b2b2' }}>talla {img.variante}</p>
              )}
              {img.alt_text && (
                <p className="text-[10px] truncate" style={{ color: '#b2b2b2' }}>{img.alt_text}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Shopify ──────────────────────────────────────────────────

function TabShopify({ shopify }: { shopify: ProductShopifyData | null }) {
  if (!shopify) {
    return (
      <div className="text-center py-16">
        <div className="text-3xl mb-3" style={{ color: '#e8e3df' }}>◫</div>
        <p className="text-sm font-medium text-tq-snorkel">Sin datos de Shopify</p>
        <p className="text-xs mt-1" style={{ color: '#b2b2b2' }}>
          Conecta Shopify en <Link href="/settings/sync" className="text-tq-sky hover:underline">Sincronización</Link> y ejecuta el sync.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: shopify.shopify_status === 'active' ? '#3A9E6A' : '#C8842A' }} />
          <span className="text-sm font-semibold capitalize text-tq-snorkel">{shopify.shopify_status ?? '—'}</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <span className="text-xs font-semibold text-tq-snorkel">Handle: </span>
          <span className="font-mono text-xs text-tq-sky">{shopify.shopify_handle ?? '—'}</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <span className="text-xs font-semibold text-tq-snorkel">Vendor: </span>
          <span className="text-xs" style={{ color: '#b2b2b2' }}>{shopify.shopify_vendor ?? '—'}</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <span className="text-xs font-semibold text-tq-snorkel">ID: </span>
          <span className="font-mono text-xs" style={{ color: '#b2b2b2' }}>{shopify.shopify_product_id ?? '—'}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl px-5 py-1" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
        <DataRow label="Título">{shopify.shopify_title ?? '—'}</DataRow>
        <DataRow label="SEO title">{shopify.shopify_seo_title ?? '—'}</DataRow>
        <DataRow label="SEO desc">{shopify.shopify_seo_desc ?? '—'}</DataRow>
        <DataRow label="Sync">
          <span className="font-mono text-xs">{fmtDate(shopify.synced_at)}</span>
        </DataRow>
      </div>

      {/* Tags */}
      {shopify.shopify_tags && shopify.shopify_tags.length > 0 && (
        <div className="bg-white rounded-xl px-5 py-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#b2b2b2' }}>Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {shopify.shopify_tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(0,85,127,0.06)', color: '#00557f' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description HTML */}
      {shopify.shopify_description && (
        <div className="bg-white rounded-xl px-5 py-4" style={{ boxShadow: '0 2px 6px rgba(0,32,60,0.08)' }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#b2b2b2' }}>Descripción Shopify (HTML)</p>
          <div
            className="prose prose-sm max-w-none text-tq-snorkel"
            style={{ fontSize: '0.8125rem', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ __html: shopify.shopify_description }}
          />
        </div>
      )}
    </div>
  )
}

