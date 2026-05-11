import React from 'react'
import {
  Document, Page, Text, View, Image,
  StyleSheet,
} from '@react-pdf/renderer'

// ── Types ──────────────────────────────────────────────────────────

export type CatalogPDFVariant = {
  variante:        string | null
  precio_venta:    number | null
  is_discontinued: boolean
}

export type CatalogPDFProduct = {
  codigo_modelo:   string
  description:     string | null
  category:        string | null
  familia:         string | null
  metal:           string | null
  karat:           string | null
  marca:           string | null
  image_url:       string | null
  is_discontinued: boolean
  variants:        CatalogPDFVariant[]
}

export type CatalogPDFFilters = {
  search?:   string
  metal?:    string
  familia?:  string
  category?: string
  estado?:   string
}

// ── Constants ──────────────────────────────────────────────────────

const TQ_BLUE      = '#00557f'
const TQ_GOLD      = '#C8842A'
const H_PAD        = 28
const HEADER_H     = 46
const FOOTER_H     = 28
const COL_GAP      = 10
const ROW_GAP      = 8
const CARD_PAD     = 10
const IMG_SIZE     = 90
// Mostramos hasta 16 variantes en 2 columnas (8 filas)
const MAX_VARIANTS = 16

// ── Helpers ────────────────────────────────────────────────────────

// Formateo manual de precios — no depende de toLocaleString (falla en Node sin ICU completo)
function fmtEur(n: number): string {
  const fixed = Math.abs(n).toFixed(2)           // "440.99"
  const [intPart, dec] = fixed.split('.')
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')  // separador de miles
  return `${intFmt},${dec} €`               // "440,99 €"
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const months = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${dd} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

function sortVar(a: string | null, b: string | null): number {
  const na = parseFloat(a ?? ''), nb = parseFloat(b ?? '')
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return (a ?? '').localeCompare(b ?? '', 'es')
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function buildFilterSummary(filters: CatalogPDFFilters): string | null {
  const parts: string[] = []
  if (filters.search)   parts.push(`"${filters.search}"`)
  if (filters.metal)    parts.push(filters.metal)
  if (filters.familia)  parts.push(filters.familia)
  if (filters.category) parts.push(filters.category)
  if (filters.estado === 'catalogo')      parts.push('En catalogo')
  if (filters.estado === 'descatalogado') parts.push('Descatalogados')
  return parts.length > 0 ? parts.join('  /  ') : null
}

// ── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily:        'Helvetica',
    backgroundColor:   '#f5f3f0',
    paddingHorizontal: H_PAD,
    paddingTop:        HEADER_H + 8,
    paddingBottom:     FOOTER_H + 8,
  },

  // Fixed header
  header: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
  },
  headerBar: {
    backgroundColor:   TQ_BLUE,
    paddingHorizontal: H_PAD,
    paddingVertical:   8,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  headerBrand: {
    fontSize:      9,
    color:         '#ffffff',
    fontFamily:    'Helvetica-Bold',
    letterSpacing: 1.8,
  },
  headerMeta: {
    fontSize: 8,
    color:    'rgba(255,255,255,0.7)',
  },
  headerFilterBar: {
    backgroundColor:   '#deeaf2',
    paddingHorizontal: H_PAD,
    paddingVertical:   5,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
  },
  headerFilterKey: {
    fontSize:   7.5,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
  },
  headerFilterVal: {
    fontSize: 7.5,
    color:    '#004466',
  },

  // Fixed footer
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   '#f5f3f0',
    borderTopWidth:    1,
    borderTopColor:    'rgba(0,85,127,0.10)',
    paddingHorizontal: H_PAD,
    paddingVertical:   8,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  footerText: {
    fontSize: 7,
    color:    '#aaaaaa',
  },
  footerPage: {
    fontSize:   7.5,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
  },

  // Grid
  row: {
    flexDirection: 'row',
    gap:           COL_GAP,
    marginBottom:  ROW_GAP,
  },
  col:      { flex: 1 },
  colEmpty: { flex: 1 },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius:    6,
    borderWidth:     1,
    borderColor:     'rgba(0,85,127,0.08)',
    overflow:        'hidden',
  },

  // Card top: image + info
  cardTop: {
    flexDirection: 'row',
    gap:           CARD_PAD,
    padding:       CARD_PAD,
  },
  cardImg: {
    width:           IMG_SIZE,
    height:          IMG_SIZE,
    borderRadius:    4,
    backgroundColor: '#f0ede8',
    flexShrink:      0,
    objectFit:       'cover' as unknown as 'cover',
  },
  cardImgPlaceholder: {
    width:           IMG_SIZE,
    height:          IMG_SIZE,
    borderRadius:    4,
    backgroundColor: '#ede9e4',
    flexShrink:      0,
  },
  cardInfo: {
    flex:     1,
    minWidth: 0,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginBottom:  4,
    flexWrap:      'wrap',
  },
  tagCategory: {
    fontSize:          7,
    color:             TQ_BLUE,
    fontFamily:        'Helvetica-Bold',
    letterSpacing:     0.6,
    backgroundColor:   'rgba(0,85,127,0.08)',
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      3,
  },
  tagMarca: {
    fontSize:      7,
    color:         TQ_GOLD,
    fontFamily:    'Helvetica-Bold',
    letterSpacing: 0.3,
  },
  tagSep: {
    fontSize: 7,
    color:    '#cccccc',
  },
  productName: {
    fontSize:    10.5,
    color:       TQ_BLUE,
    fontFamily:  'Helvetica-Bold',
    lineHeight:  1.3,
    marginBottom: 3,
  },
  productFamilia: {
    fontSize:     7.5,
    color:        '#999999',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginBottom:  5,
    flexWrap:      'wrap',
  },
  tagMetal: {
    fontSize:          7.5,
    color:             TQ_BLUE,
    backgroundColor:   'rgba(0,85,127,0.08)',
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      3,
  },
  tagKarat: {
    fontSize:          7.5,
    color:             '#7a5c1e',
    fontFamily:        'Helvetica-Bold',
    backgroundColor:   'rgba(200,132,42,0.12)',
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      3,
  },
  cardCodigo: {
    fontSize:   7,
    color:      '#c8c5c1',
    marginLeft: 'auto' as unknown as number,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
    marginTop:     2,
  },
  priceLabel: {
    fontSize: 8,
    color:    '#aaaaaa',
  },
  priceValue: {
    fontSize:   13,
    color:      TQ_BLUE,
    fontFamily: 'Helvetica-Bold',
  },
  discontinuedBadge: {
    marginTop:         5,
    fontSize:          7,
    color:             '#888888',
    fontFamily:        'Helvetica-Bold',
    letterSpacing:     0.5,
    backgroundColor:   'rgba(120,120,120,0.10)',
    paddingHorizontal: 5,
    paddingVertical:   3,
    borderRadius:      3,
    alignSelf:         'flex-start',
  },

  // Variants section
  variantsDivider: {
    height:           1,
    backgroundColor:  'rgba(0,85,127,0.08)',
    marginHorizontal: CARD_PAD,
  },
  variantsSection: {
    paddingHorizontal: CARD_PAD,
    paddingTop:        6,
    paddingBottom:     8,
  },
  variantsHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   4,
  },
  variantsLabel: {
    fontSize:      6.5,
    color:         '#b2b2b2',
    fontFamily:    'Helvetica-Bold',
    letterSpacing: 1,
  },
  variantsTotal: {
    fontSize: 6.5,
    color:    '#cccccc',
  },

  // 2-column variant grid
  variantGridRow: {
    flexDirection: 'row',
    marginBottom:  2,
    gap:           4,
  },

  // Each half-column
  variantCell: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    borderRadius:   3,
    gap:            4,
  },
  variantCellActive: {
    backgroundColor: 'rgba(58,158,106,0.06)',
  },
  variantCellDisc: {
    backgroundColor: 'rgba(120,120,120,0.04)',
  },

  // Dot (View, not Unicode)
  dotAvailable: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: '#3A9E6A',
    flexShrink:      0,
  },
  dotDiscontinued: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: '#cccccc',
    flexShrink:      0,
  },

  variantTalla: {
    fontSize:   8,
    color:      '#333333',
    fontFamily: 'Helvetica-Bold',
    width:      22,
    flexShrink: 0,
  },
  variantTallaDisc: {
    fontSize:   8,
    color:      '#bbbbbb',
    width:      22,
    flexShrink: 0,
  },
  variantPrice: {
    fontSize:  8,
    color:     TQ_BLUE,
    flex:      1,
    textAlign: 'right' as unknown as 'right',
  },
  variantPriceDisc: {
    fontSize:  8,
    color:     '#cccccc',
    flex:      1,
    textAlign: 'right' as unknown as 'right',
  },

  variantsMore: {
    fontSize:   7,
    color:      '#b2b2b2',
    fontFamily: 'Helvetica-Oblique',
    marginTop:  3,
    paddingLeft: 5,
  },

  // Separador vertical entre columnas de variantes
  variantColSep: {
    width:           1,
    backgroundColor: 'rgba(0,85,127,0.07)',
    marginVertical:  1,
  },
})

// ── VariantCell ────────────────────────────────────────────────────

function VariantCell({ v }: { v: CatalogPDFVariant }) {
  const disc = v.is_discontinued
  return (
    <View style={[s.variantCell, disc ? s.variantCellDisc : s.variantCellActive]}>
      <View style={disc ? s.dotDiscontinued : s.dotAvailable} />
      <Text style={disc ? s.variantTallaDisc : s.variantTalla}>
        {v.variante ?? '-'}
      </Text>
      <Text style={disc ? s.variantPriceDisc : s.variantPrice}>
        {v.precio_venta != null ? fmtEur(v.precio_venta) : '-'}
      </Text>
    </View>
  )
}

// ── ProductCard ────────────────────────────────────────────────────

function ProductCard({ p }: { p: CatalogPDFProduct }) {
  const active = p.variants
    .filter(v => !v.is_discontinued)
    .sort((a, b) => sortVar(a.variante, b.variante))
  const disc = p.variants
    .filter(v => v.is_discontinued)
    .sort((a, b) => sortVar(a.variante, b.variante))

  const allVariants = [...active, ...disc]
  const shown       = allVariants.slice(0, MAX_VARIANTS)
  const hidden      = allVariants.length - shown.length

  // Agrupar en pares para layout de 2 columnas
  const pairs = chunk(shown, 2)

  // Precio: mínimo entre variantes disponibles
  const activePrices = active.map(v => v.precio_venta).filter((x): x is number => x != null)
  const minPrice     = activePrices.length > 0 ? Math.min(...activePrices) : null
  const maxPrice     = activePrices.length > 0 ? Math.max(...activePrices) : null
  const isRange      = minPrice != null && maxPrice != null && minPrice !== maxPrice

  return (
    <View style={s.card} wrap={false}>
      {/* ── Top: imagen + info ── */}
      <View style={s.cardTop}>
        {p.image_url
          ? <Image src={p.image_url} style={s.cardImg} />
          : <View style={s.cardImgPlaceholder} />
        }

        <View style={s.cardInfo}>
          <View style={s.tagsRow}>
            {p.category && <Text style={s.tagCategory}>{p.category.toUpperCase()}</Text>}
            {p.category && p.marca && <Text style={s.tagSep}>·</Text>}
            {p.marca    && <Text style={s.tagMarca}>{p.marca.toUpperCase()}</Text>}
          </View>

          <Text style={s.productName}>{p.description ?? p.codigo_modelo}</Text>

          {p.familia && <Text style={s.productFamilia}>{p.familia}</Text>}

          <View style={s.metaRow}>
            {p.metal && <Text style={s.tagMetal}>{p.metal}</Text>}
            {p.karat && <Text style={s.tagKarat}>{p.karat}</Text>}
            <Text style={s.cardCodigo}>{p.codigo_modelo}</Text>
          </View>

          {p.is_discontinued ? (
            <Text style={s.discontinuedBadge}>DESCATALOGADO</Text>
          ) : minPrice != null ? (
            <View style={s.priceRow}>
              {isRange && <Text style={s.priceLabel}>Desde</Text>}
              <Text style={s.priceValue}>{fmtEur(minPrice)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Variantes en 2 columnas ── */}
      {pairs.length > 0 && (
        <>
          <View style={s.variantsDivider} />
          <View style={s.variantsSection}>
            <View style={s.variantsHeaderRow}>
              <Text style={s.variantsLabel}>TALLAS / VARIANTES</Text>
              <Text style={s.variantsTotal}>
                {allVariants.length} variante{allVariants.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {pairs.map((pair, i) => (
              <View key={i} style={s.variantGridRow}>
                <VariantCell v={pair[0]} />
                <View style={s.variantColSep} />
                {pair[1]
                  ? <VariantCell v={pair[1]} />
                  : <View style={{ flex: 1 }} />
                }
              </View>
            ))}

            {hidden > 0 && (
              <Text style={s.variantsMore}>
                + {hidden} variante{hidden !== 1 ? 's' : ''} adicionale{hidden !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  )
}

// ── Main component ─────────────────────────────────────────────────

export function CatalogPDF({
  products,
  filters,
}: {
  products: CatalogPDFProduct[]
  filters:  CatalogPDFFilters
}) {
  const fecha         = fmtDate(new Date())
  const filterSummary = buildFilterSummary(filters)
  // Agrupamos en filas de 2; wrap={false} en cada fila evita que se parta entre páginas
  const rows          = chunk(products, 2)

  return (
    <Document
      title="Te Quiero Joyerias - Catalogo de productos"
      author="Te Quiero Joyerias"
    >
      <Page size="A4" style={s.page}>

        {/* ── Cabecera fija ── */}
        <View style={s.header} fixed>
          <View style={s.headerBar}>
            <Text style={s.headerBrand}>TE QUIERO JOYERIAS</Text>
            <Text style={s.headerMeta}>
              {products.length} referencia{products.length !== 1 ? 's' : ''}  ·  {fecha}
            </Text>
          </View>
          {filterSummary && (
            <View style={s.headerFilterBar}>
              <Text style={s.headerFilterKey}>FILTROS:</Text>
              <Text style={s.headerFilterVal}>{filterSummary}</Text>
            </View>
          )}
        </View>

        {/* ── Pie fijo ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Joyerias Te Quiero  ·  Catalogo de productos  ·  Uso interno
          </Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

        {/* ── Cuadricula de productos (2 columnas) ── */}
        {rows.map((row, ri) => (
          // wrap={false} mantiene las 2 tarjetas juntas en la misma página
          <View key={ri} style={s.row} wrap={false}>
            {row.map(p => (
              <View key={p.codigo_modelo} style={s.col}>
                <ProductCard p={p} />
              </View>
            ))}
            {row.length < 2 && <View style={s.colEmpty} />}
          </View>
        ))}

      </Page>
    </Document>
  )
}
