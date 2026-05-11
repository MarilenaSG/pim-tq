import React from 'react'
import {
  Document, Page, Text, View, Image, Link,
  StyleSheet,
} from '@react-pdf/renderer'

// ── Types ──────────────────────────────────────────────────────────

export type CampaignPDFData = {
  nombre:      string
  tipo:        string | null
  narrativa:   string | null
  descripcion: string | null
  objetivos:   string | null
  canales:     string | null
  soportes:    string | null
  fecha_inicio: string | null
  fecha_fin:   string | null
  color:       string | null
}

export type ProductPDFRow = {
  codigo:      string
  nombre:      string
  marca:       string | null
  metal:       string | null
  karat:       string | null
  familia:     string | null
  precio:      number | null
  precioAntes: number | null
  descuento:   number | null
  descripcion: string
  tags:        string
  url:         string
  tallas:      string
  imagenes:    string[]  // up to 3
}

// ── Styles ─────────────────────────────────────────────────────────

const TQ_BLUE = '#00557f'
const TQ_GOLD = '#C8842A'

const s = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    backgroundColor: '#ffffff',
    paddingTop:      0,
    paddingBottom:   32,
    paddingHorizontal: 0,
  },

  // Cover
  coverAccent: {
    height:          6,
    backgroundColor: TQ_BLUE,
  },
  coverBody: {
    // Sin flexGrow: 1 para que el contenido fluya a páginas nuevas
    // cuando supera el alto de la primera página
    paddingHorizontal: 48,
    paddingTop:        40,
    paddingBottom:     40,
  },
  coverBrand: {
    fontSize:    11,
    color:       TQ_GOLD,
    fontFamily:  'Helvetica-Bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  coverTitle: {
    fontSize:    30,
    color:       TQ_BLUE,
    fontFamily:  'Helvetica-Bold',
    marginBottom: 12,
    lineHeight:  1.2,
  },
  coverMeta: {
    flexDirection: 'row',
    gap:           12,
    marginBottom:  32,
    flexWrap:      'wrap',
  },
  coverChip: {
    fontSize:         9,
    color:            TQ_BLUE,
    backgroundColor:  'rgba(0,85,127,0.08)',
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      4,
  },
  coverDivider: {
    height:          1,
    backgroundColor: 'rgba(0,85,127,0.12)',
    marginBottom:    24,
  },
  coverSection: {
    marginBottom: 18,
  },
  coverNarrLabel: {
    fontSize:        8,
    color:           '#999999',
    fontFamily:      'Helvetica-Bold',
    letterSpacing:   1.5,
    marginBottom:    6,
  },
  coverNarr: {
    fontSize:    11,
    color:       TQ_BLUE,
    lineHeight:  1.7,
  },
  coverFooterDivider: {
    height:          1,
    backgroundColor: 'rgba(0,85,127,0.12)',
    marginTop:       28,
    marginBottom:    14,
  },
  coverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:  'center',
  },
  coverFooterText: {
    fontSize: 8,
    color:    '#b2b2b2',
  },
  coverCount: {
    fontSize:    10,
    color:       TQ_GOLD,
    fontFamily:  'Helvetica-Bold',
  },

  // Products page
  productsHeader: {
    backgroundColor: TQ_BLUE,
    paddingHorizontal: 32,
    paddingVertical:   10,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    marginBottom:      0,
  },
  productsHeaderText: {
    fontSize:  9,
    color:     '#ffffff',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  productsBody: {
    paddingHorizontal: 32,
    paddingTop:        8,
  },

  // Metal group header
  metalHeader: {
    backgroundColor:   TQ_BLUE,
    paddingHorizontal: 10,
    paddingVertical:   7,
    marginTop:         18,
    marginBottom:      0,
    borderRadius:      3,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  metalHeaderText: {
    fontSize:    10,
    color:       '#ffffff',
    fontFamily:  'Helvetica-Bold',
    letterSpacing: 1.2,
  },
  metalHeaderCount: {
    fontSize:  8,
    color:     'rgba(255,255,255,0.7)',
    fontFamily: 'Helvetica',
  },

  // Familia subgroup header
  familiaHeader: {
    borderLeftWidth:   3,
    borderLeftColor:   TQ_GOLD,
    paddingHorizontal: 8,
    paddingVertical:   5,
    marginTop:         12,
    marginBottom:      0,
    backgroundColor:   'rgba(200,132,42,0.06)',
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  familiaHeaderText: {
    fontSize:   9,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
  },
  familiaHeaderCount: {
    fontSize:  8,
    color:     '#999999',
  },

  // Product row
  productRow: {
    flexDirection:    'row',
    paddingVertical:  14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,85,127,0.08)',
    gap:              14,
  },
  productImages: {
    flexDirection: 'column',
    gap:           4,
    width:         80,
    flexShrink:    0,
  },
  productMainImg: {
    width:  80,
    height: 80,
    objectFit: 'cover' as unknown as 'cover',
    borderRadius: 4,
    backgroundColor: '#f5f3f0',
  },
  productThumbRow: {
    flexDirection: 'row',
    gap:           4,
  },
  productThumb: {
    width:           38,
    height:          38,
    objectFit:       'cover' as unknown as 'cover',
    borderRadius:    3,
    backgroundColor: '#f5f3f0',
  },
  productInfo: {
    flex:      1,
    minWidth:  0,
  },
  productNameRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   3,
    gap:            8,
  },
  productName: {
    fontSize:   11,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
    flex:       1,
    lineHeight: 1.3,
  },
  productCode: {
    fontSize:   8,
    color:      '#b2b2b2',
    fontFamily: 'Helvetica',
  },
  productAttrRow: {
    flexDirection: 'row',
    gap:           10,
    marginBottom:  5,
    flexWrap:      'wrap',
  },
  productAttr: {
    fontSize: 9,
    color:    '#555555',
  },
  productAttrBold: {
    fontSize:   9,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
  },
  priceRow: {
    flexDirection: 'row',
    gap:           8,
    alignItems:    'baseline',
    marginBottom:  5,
  },
  price: {
    fontSize:   12,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
  },
  priceBefore: {
    fontSize:  9,
    color:     '#b2b2b2',
    textDecoration: 'line-through' as unknown as 'line-through',
  },
  discount: {
    fontSize:         8,
    color:            '#C0392B',
    fontFamily:       'Helvetica-Bold',
    backgroundColor:  'rgba(192,57,43,0.08)',
    paddingHorizontal: 4,
    paddingVertical:   2,
    borderRadius:      3,
  },
  productDesc: {
    fontSize:    8.5,
    color:       '#555555',
    lineHeight:  1.5,
    marginBottom: 4,
  },
  productTags: {
    fontSize:  8,
    color:     TQ_GOLD,
    marginBottom: 3,
  },
  productUrlRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  productUrl: {
    fontSize:   7.5,
    color:      '#0066cc',
  },
  productSizes: {
    fontSize:   8,
    color:      '#777777',
    marginTop:  3,
  },
})

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// Orden de prioridad de metales (el resto va al final ordenado alfabéticamente)
const METAL_ORDER = ['oro', 'oro blanco', 'oro rosa', 'vermeil', 'plata', 'acero']

function metalSortKey(metal: string): string {
  const lower = metal.toLowerCase()
  const idx = METAL_ORDER.findIndex(m => lower.includes(m) || lower === m)
  return idx >= 0 ? String(idx).padStart(2, '0') + metal : '99' + metal
}

type FamiliaGroup = { familia: string; items: ProductPDFRow[] }
type MetalGroup   = { metal: string; familias: FamiliaGroup[]; total: number }

function groupProducts(products: ProductPDFRow[]): MetalGroup[] {
  const metalMap = new Map<string, Map<string, ProductPDFRow[]>>()

  for (const p of products) {
    const metal   = p.metal   || 'Sin especificar'
    const familia = p.familia || 'Sin familia'
    if (!metalMap.has(metal)) metalMap.set(metal, new Map())
    const familiaMap = metalMap.get(metal)!
    if (!familiaMap.has(familia)) familiaMap.set(familia, [])
    familiaMap.get(familia)!.push(p)
  }

  return Array.from(metalMap.keys())
    .sort((a, b) => metalSortKey(a).localeCompare(metalSortKey(b), 'es'))
    .map(metal => {
      const familiaMap = metalMap.get(metal)!
      const familias: FamiliaGroup[] = Array.from(familiaMap.keys())
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map(familia => ({ familia, items: familiaMap.get(familia)! }))
      return { metal, familias, total: Array.from(familiaMap.values()).reduce((n, arr) => n + arr.length, 0) }
    })
}

// ── Sub-components ─────────────────────────────────────────────────

function ProductRow({ p }: { p: ProductPDFRow }) {
  const desc = p.descripcion.length > 280 ? p.descripcion.slice(0, 280) + '…' : p.descripcion
  const thumbs = p.imagenes.slice(1, 3)

  return (
    <View style={s.productRow} wrap={false}>
      {/* Images */}
      <View style={s.productImages}>
        {p.imagenes[0] ? (
          <Image src={p.imagenes[0]} style={s.productMainImg} />
        ) : (
          <View style={[s.productMainImg, { backgroundColor: '#f0ede8' }]} />
        )}
        {thumbs.length > 0 && (
          <View style={s.productThumbRow}>
            {thumbs.map((url, i) => (
              <Image key={i} src={url} style={s.productThumb} />
            ))}
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.productInfo}>
        <View style={s.productNameRow}>
          <Text style={s.productName}>{p.nombre || p.codigo}</Text>
          <Text style={s.productCode}>{p.codigo}</Text>
        </View>

        <View style={s.productAttrRow}>
          {p.marca   && <Text style={s.productAttrBold}>{p.marca}</Text>}
          {p.metal   && <Text style={s.productAttr}>{p.metal}{p.karat ? ` ${p.karat}` : ''}</Text>}
          {p.familia && <Text style={s.productAttr}>{p.familia}</Text>}
        </View>

        <View style={s.priceRow}>
          {p.precio != null && <Text style={s.price}>{fmtEur(p.precio)}</Text>}
          {p.precioAntes != null && p.precioAntes > (p.precio ?? 0) && (
            <Text style={s.priceBefore}>{fmtEur(p.precioAntes)}</Text>
          )}
          {p.descuento != null && p.descuento > 0 && (
            <Text style={s.discount}>-{Math.round(p.descuento)}%</Text>
          )}
        </View>

        {desc && <Text style={s.productDesc}>{desc}</Text>}

        {p.tags && <Text style={s.productTags}>#{p.tags.split(',').map(t => t.trim()).filter(Boolean).join('  #')}</Text>}

        {p.tallas && <Text style={s.productSizes}>Tallas: {p.tallas}</Text>}

        {p.url && (
          <Link src={p.url} style={s.productUrl}>{p.url}</Link>
        )}
      </View>
    </View>
  )
}

// Encabezado de metal + primera fila en bloque inseparable para evitar
// que el header quede huérfano al final de una página
function MetalSection({ group }: { group: MetalGroup }) {
  return (
    <>
      {group.familias.map((fg, fi) => (
        <React.Fragment key={fg.familia}>
          {/* Metal header: solo delante de la primera familia */}
          {fi === 0 ? (
            <View wrap={false}>
              <View style={s.metalHeader}>
                <Text style={s.metalHeaderText}>{group.metal.toUpperCase()}</Text>
                <Text style={s.metalHeaderCount}>{group.total} ref.</Text>
              </View>
              <View style={s.familiaHeader}>
                <Text style={s.familiaHeaderText}>{fg.familia}</Text>
                <Text style={s.familiaHeaderCount}>{fg.items.length} ref.</Text>
              </View>
              {fg.items[0] && <ProductRow p={fg.items[0]} />}
            </View>
          ) : (
            <View wrap={false}>
              <View style={s.familiaHeader}>
                <Text style={s.familiaHeaderText}>{fg.familia}</Text>
                <Text style={s.familiaHeaderCount}>{fg.items.length} ref.</Text>
              </View>
              {fg.items[0] && <ProductRow p={fg.items[0]} />}
            </View>
          )}
          {/* Resto de productos de esta familia (pueden paginar libremente) */}
          {fg.items.slice(1).map(p => <ProductRow key={p.codigo} p={p} />)}
        </React.Fragment>
      ))}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────

export function CampaignPDF({
  campaign,
  products,
}: {
  campaign: CampaignPDFData
  products: ProductPDFRow[]
}) {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  const metaChips: string[] = []
  if (campaign.tipo)         metaChips.push(campaign.tipo)
  if (campaign.fecha_inicio) metaChips.push(`Inicio: ${fmtDate(campaign.fecha_inicio)}`)
  if (campaign.fecha_fin)    metaChips.push(`Fin: ${fmtDate(campaign.fecha_fin)}`)

  const metalGroups = groupProducts(products)

  return (
    <Document title={`Te Quiero Jewels — ${campaign.nombre}`} author="Te Quiero Jewels">

      {/* ── Cover page (puede paginar si el texto es largo) ── */}
      <Page size="A4" style={s.page}>
        {/* Franja azul — fija en cada página de la portada */}
        <View style={s.coverAccent} fixed />

        <View style={s.coverBody}>
          {/* Cabecera con marca y título — se mantiene unida */}
          <View wrap={false}>
            <Text style={s.coverBrand}>TE QUIERO JEWELS</Text>
            <Text style={s.coverTitle}>{campaign.nombre}</Text>

            {metaChips.length > 0 && (
              <View style={s.coverMeta}>
                {metaChips.map(chip => (
                  <Text key={chip} style={s.coverChip}>{chip}</Text>
                ))}
                <Text style={s.coverChip}>{products.length} referencia{products.length !== 1 ? 's' : ''}</Text>
              </View>
            )}

            <View style={s.coverDivider} />

            {campaign.canales && (
              <Text style={{ ...s.coverNarrLabel, marginBottom: 16 }}>
                CANALES: {campaign.canales.split(',').filter(Boolean).map(c => c.trim() === 'online' ? 'Online' : 'Tiendas').join('  ·  ')}
              </Text>
            )}
          </View>

          {/* Secciones de texto — cada una puede fluir a la siguiente página */}
          {campaign.descripcion && (
            <View style={s.coverSection}>
              <Text style={s.coverNarrLabel}>DESCRIPCIÓN</Text>
              <Text style={s.coverNarr}>{campaign.descripcion}</Text>
            </View>
          )}

          {campaign.objetivos && (
            <View style={s.coverSection}>
              <Text style={s.coverNarrLabel}>OBJETIVOS</Text>
              <Text style={s.coverNarr}>{campaign.objetivos}</Text>
            </View>
          )}

          {campaign.soportes && (
            <View style={s.coverSection}>
              <Text style={s.coverNarrLabel}>SOPORTES</Text>
              <Text style={s.coverNarr}>{campaign.soportes}</Text>
            </View>
          )}

          {campaign.narrativa && (
            <View style={s.coverSection}>
              <Text style={s.coverNarrLabel}>CONCEPTO DE CAMPAÑA</Text>
              <Text style={s.coverNarr}>{campaign.narrativa}</Text>
            </View>
          )}

          {/* Footer — al final del contenido, sin marginTop: auto */}
          <View wrap={false}>
            <View style={s.coverFooterDivider} />
            <View style={s.coverFooter}>
              <Text style={s.coverFooterText}>Generado el {fecha} · Uso interno y para agencias</Text>
              <Text style={s.coverCount}>{products.length} ref.</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ── Products pages — agrupados por metal y familia ── */}
      <Page size="A4" style={s.page}>
        <View style={s.productsHeader} fixed>
          <Text style={s.productsHeaderText}>TE QUIERO JEWELS  ·  {campaign.nombre.toUpperCase()}</Text>
          <Text style={s.productsHeaderText}>{products.length} REFERENCIAS</Text>
        </View>
        <View style={s.productsBody}>
          {metalGroups.map(group => (
            <MetalSection key={group.metal} group={group} />
          ))}
        </View>
      </Page>

    </Document>
  )
}
