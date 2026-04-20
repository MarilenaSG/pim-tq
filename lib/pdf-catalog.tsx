import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────

export interface PdfProduct {
  codigo_modelo:       string
  description:         string | null
  metal:               string | null
  karat:               string | null
  familia:             string | null
  precio_venta:        number | null
  image_url:           string | null
  marca:               string | null
  shopify_description: string | null
  shopify_tags:        string[] | null
  shopify_status:      string | null
}

// ── Design tokens ─────────────────────────────────────────────

const C = {
  snorkel:   '#00557f',
  gold:      '#C8842A',
  goldLight: '#fdf3e4',
  ink:       '#1d1d1b',
  gray:      '#b2b2b2',
  grayLight: '#f0ece8',
  white:     '#ffffff',
  border:    '#e2ddd9',
}

// A4 usable area with 24pt padding each side:
// Width: 595 - 48 = 547pt  /  Height: 842 - 48 = 794pt
// Header: ~48pt + 12pt gap = 60pt
// Footer: 20pt (fixed, outside flow)
// Grid: 794 - 60 - 20 = ~714pt  →  2 rows × ~350pt each (with 8pt gap)

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop:    24,
    paddingBottom: 24,
    paddingLeft:   24,
    paddingRight:  24,
    fontFamily:    'Helvetica',
    flexDirection: 'column',
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingBottom:     10,
    marginBottom:      12,
    borderBottomWidth: 1.5,
    borderBottomColor: C.snorkel,
  },
  headerBrand: {
    fontSize:      6.5,
    fontFamily:    'Helvetica-Bold',
    color:         C.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom:  2,
  },
  headerTitle: {
    fontSize:   15,
    fontFamily: 'Helvetica-Bold',
    color:      C.snorkel,
  },
  headerDate: {
    fontSize: 8,
    color:    C.gray,
  },

  // ── Grid: 2 rows ────────────────────────────────────────────
  gridContainer: {
    flex:          1,
    flexDirection: 'column',
    gap:           8,
  },
  gridRow: {
    flex:          1,
    flexDirection: 'row',
    gap:           8,
  },

  // ── Card ────────────────────────────────────────────────────
  card: {
    flex:            1,
    flexDirection:   'column',
    backgroundColor: C.white,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    5,
    overflow:        'hidden',
  },
  cardEmpty: {
    flex: 1,
  },

  // Image fills remaining vertical space
  cardImageWrap: {
    flex:            1,
    backgroundColor: C.grayLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardImage: {
    width:      '100%',
    height:     '100%',
    objectFit:  'contain',
  },
  cardNoImage: {
    fontSize: 9,
    color:    C.border,
  },

  // Content at the bottom — fixed height
  cardBody: {
    paddingHorizontal: 8,
    paddingTop:        7,
    paddingBottom:     7,
    borderTopWidth:    1,
    borderTopColor:    C.border,
  },

  // Row 1: marca + código
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   3,
  },
  marca: {
    fontSize:      6.5,
    fontFamily:    'Helvetica-Bold',
    color:         C.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  codigo: {
    fontSize:   6.5,
    fontFamily: 'Helvetica',
    color:      C.gray,
  },

  // Row 2: description
  description: {
    fontSize:     8.5,
    fontFamily:   'Helvetica-Bold',
    color:        C.snorkel,
    lineHeight:   1.3,
    marginBottom: 4,
  },

  // Row 3: pills + price
  midRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   4,
  },
  pillsRow: {
    flexDirection: 'row',
    gap:           3,
  },
  pill: {
    paddingHorizontal: 4,
    paddingVertical:   1.5,
    borderRadius:      8,
    backgroundColor:   '#eef4f8',
  },
  pillText: {
    fontSize: 6.5,
    color:    C.snorkel,
  },
  pillGold: {
    paddingHorizontal: 4,
    paddingVertical:   1.5,
    borderRadius:      8,
    backgroundColor:   C.goldLight,
  },
  pillGoldText: {
    fontSize:   6.5,
    color:      C.gold,
    fontFamily: 'Helvetica-Bold',
  },
  price: {
    fontSize:   10,
    fontFamily: 'Helvetica-Bold',
    color:      C.snorkel,
  },

  // Row 4: tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           3,
  },
  tag: {
    paddingHorizontal: 4,
    paddingVertical:   1.5,
    borderRadius:      3,
    backgroundColor:   C.grayLight,
  },
  tagText: {
    fontSize: 6,
    color:    '#888',
  },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    position:       'absolute',
    bottom:         10,
    left:           24,
    right:          24,
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color:    C.border,
  },
})

// ── Helpers ───────────────────────────────────────────────────

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Product Card ──────────────────────────────────────────────

function ProductCard({ p }: { p: PdfProduct }) {
  const tags = (p.shopify_tags ?? []).slice(0, 5)
  const desc = stripHtml(p.shopify_description)

  return (
    <View style={s.card}>
      {/* Image — fills all remaining space */}
      <View style={s.cardImageWrap}>
        {p.image_url ? (
          <Image style={s.cardImage} src={p.image_url} />
        ) : (
          <Text style={s.cardNoImage}>Sin imagen</Text>
        )}
      </View>

      {/* Fixed bottom content */}
      <View style={s.cardBody}>
        {/* Marca + código */}
        <View style={s.topRow}>
          <Text style={s.marca}>{p.marca ?? p.familia ?? ''}</Text>
          <Text style={s.codigo}>{p.codigo_modelo}</Text>
        </View>

        {/* Description */}
        <Text style={s.description}>
          {trunc(p.description ?? p.codigo_modelo, 65)}
        </Text>

        {/* Pills + price */}
        <View style={s.midRow}>
          <View style={s.pillsRow}>
            {p.metal && (
              <View style={s.pill}><Text style={s.pillText}>{p.metal}</Text></View>
            )}
            {p.karat && (
              <View style={s.pillGold}><Text style={s.pillGoldText}>{p.karat}</Text></View>
            )}
          </View>
          {p.precio_venta != null && (
            <Text style={s.price}>
              {p.precio_venta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </Text>
          )}
        </View>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={s.tagsRow}>
            {tags.map((tag, i) => (
              <View key={i} style={s.tag}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Shopify description snippet */}
        {desc.length > 0 && (
          <Text style={{ fontSize: 7, color: '#666', marginTop: 3, lineHeight: 1.35 }}>
            {trunc(desc, 120)}
          </Text>
        )}
      </View>
    </View>
  )
}

// ── Document ──────────────────────────────────────────────────

interface CatalogDocProps {
  products: PdfProduct[]
  title?:   string
}

export function CatalogDocument({ products, title }: CatalogDocProps) {
  const dateStr = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  // Group into pages of 4
  const pages: PdfProduct[][] = []
  for (let i = 0; i < products.length; i += 4) {
    pages.push(products.slice(i, i + 4))
  }

  return (
    <Document title={title ?? `Catálogo TQ - ${dateStr}`} author="Te Quiero Joyerías">
      {pages.map((pageProducts, pageIdx) => {
        const [p0, p1, p2, p3] = pageProducts

        return (
          <Page key={pageIdx} size="A4" style={s.page}>
            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.headerBrand}>Te Quiero Joyerías</Text>
                <Text style={s.headerTitle}>Catálogo de producto</Text>
              </View>
              <Text style={s.headerDate}>{dateStr}</Text>
            </View>

            {/* Grid: always 2 rows × 2 cols filling the page */}
            <View style={s.gridContainer}>
              <View style={s.gridRow}>
                {p0 ? <ProductCard p={p0} /> : <View style={s.cardEmpty} />}
                {p1 ? <ProductCard p={p1} /> : <View style={s.cardEmpty} />}
              </View>
              <View style={s.gridRow}>
                {p2 ? <ProductCard p={p2} /> : <View style={s.cardEmpty} />}
                {p3 ? <ProductCard p={p3} /> : <View style={s.cardEmpty} />}
              </View>
            </View>

            {/* Footer */}
            <View style={s.footer} fixed>
              <Text style={s.footerText}>Te Quiero Joyerías · Uso interno</Text>
              <Text
                style={s.footerText}
                render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
              />
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
