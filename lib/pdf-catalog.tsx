import React from 'react'
import path from 'path'
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer'

// ── Font registration ──────────────────────────────────────────

const fontsDir = path.join(process.cwd(), 'te-quiero-design-system/project/fonts')

Font.register({
  family: 'Poppins',
  fonts: [
    { src: path.join(fontsDir, 'Poppins-Regular.ttf'),  fontWeight: 400 },
    { src: path.join(fontsDir, 'Poppins-Medium.ttf'),   fontWeight: 500 },
    { src: path.join(fontsDir, 'Poppins-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Poppins-Bold.ttf'),     fontWeight: 700 },
  ],
})

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
  gold:      '#c8a164',   // official --tq-gold
  goldLight: '#fdf3e4',
  ink:       '#1d1d1b',
  gray:      '#b2b2b2',
  grayLight: '#f0ece8',
  alyssum:   '#e8e3df',   // official --tq-alyssum
  white:     '#ffffff',
  border:    '#e2ddd9',
}

// A4 = 595 × 842 pt
// Padding: 24 all sides → inner area: 547 × 794 pt
// Header: ~52 pt (content ~30 + paddingBottom 10 + marginBottom 12)
// Row gap: 8 pt
// Footer: absolute, doesn't affect flow
// Grid rows: (794 - 52 - 8) / 2 = 367 pt each → use 355 for safety

const ROW_H   = 355  // pt per grid row
const BODY_H  = 92   // pt for card text area (fixed)
const IMG_H   = ROW_H - BODY_H - 1  // 1 = border-top

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop:    24,
    paddingBottom: 24,
    paddingLeft:   24,
    paddingRight:  24,
    fontFamily:    'Poppins',
    flexDirection: 'column',
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    paddingBottom:    10,
    marginBottom:     12,
    borderBottomWidth: 2,
    borderBottomColor: C.snorkel,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           9,
  },
  headerIcon: {
    width:  28,
    height: 28,
  },
  headerBrand: {
    fontSize:      5.5,
    fontWeight:    600,
    color:         C.gray,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom:  2,
  },
  headerTitle: {
    fontSize:      13,
    fontWeight:    700,
    color:         C.snorkel,
    letterSpacing: 0.2,
  },
  headerDate: {
    fontSize:   7.5,
    fontWeight: 400,
    color:      C.gray,
  },

  // ── Grid: 2 rows × 2 cols, fixed height ────────────────────
  gridContainer: {
    flexDirection: 'column',
    gap:           8,
  },
  gridRow: {
    flexDirection: 'row',
    gap:           8,
    height:        ROW_H,
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

  // Image: fixed height, fills width, cropped to widest side
  cardImageWrap: {
    height:          IMG_H,
    backgroundColor: C.alyssum,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardImage: {
    width:     '100%',
    height:    '100%',
    objectFit: 'cover',
  },
  cardNoImage: {
    fontSize: 8,
    color:    C.border,
  },

  // Content: fixed height at bottom
  cardBody: {
    height:            BODY_H,
    paddingHorizontal: 8,
    paddingTop:        6,
    paddingBottom:     6,
    borderTopWidth:    1,
    borderTopColor:    C.border,
    flexDirection:     'column',
    justifyContent:    'space-between',
  },

  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  marca: {
    fontSize:      6,
    fontWeight:    600,
    color:         C.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  codigo: {
    fontSize:  6,
    fontWeight: 400,
    color:     C.gray,
  },

  description: {
    fontSize:   8,
    fontWeight: 600,
    color:      C.snorkel,
    lineHeight: 1.3,
  },

  midRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  pillsRow: {
    flexDirection: 'row',
    gap:           3,
  },
  pill: {
    paddingHorizontal: 4,
    paddingVertical:   2,
    borderRadius:      8,
    backgroundColor:   '#eef4f8',
  },
  pillText: {
    fontSize:  6,
    fontWeight: 500,
    color:     C.snorkel,
  },
  pillGold: {
    paddingHorizontal: 4,
    paddingVertical:   2,
    borderRadius:      8,
    backgroundColor:   C.goldLight,
  },
  pillGoldText: {
    fontSize:  6,
    fontWeight: 600,
    color:     C.gold,
  },
  price: {
    fontSize:  10,
    fontWeight: 700,
    color:     C.snorkel,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           3,
  },
  tag: {
    paddingHorizontal: 3,
    paddingVertical:   1.5,
    borderRadius:      3,
    backgroundColor:   C.grayLight,
  },
  tagText: {
    fontSize:  5.5,
    fontWeight: 400,
    color:     '#888',
  },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    position:       'absolute',
    bottom:         10,
    left:           24,
    right:          24,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  footerText: {
    fontSize:  6.5,
    fontWeight: 400,
    color:     C.gray,
  },
  footerDot: {
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: C.gold,
  },
})

// ── Helpers ───────────────────────────────────────────────────

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Product Card ──────────────────────────────────────────────

function ProductCard({ p }: { p: PdfProduct }) {
  const tags = (p.shopify_tags ?? []).slice(0, 4)

  return (
    <View style={s.card}>
      {/* Image — fixed height, objectFit cover fills to widest side */}
      <View style={s.cardImageWrap}>
        {p.image_url ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image style={s.cardImage} src={p.image_url} />
        ) : (
          <Text style={s.cardNoImage}>Sin imagen</Text>
        )}
      </View>

      {/* Fixed-height info block */}
      <View style={s.cardBody}>
        {/* Marca + código */}
        <View style={s.topRow}>
          <Text style={s.marca}>{trunc(p.marca ?? p.familia ?? '', 28)}</Text>
          <Text style={s.codigo}>{p.codigo_modelo}</Text>
        </View>

        {/* Description */}
        <Text style={s.description}>
          {trunc(p.description ?? p.codigo_modelo, 60)}
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
      </View>
    </View>
  )
}

// ── Document ──────────────────────────────────────────────────

interface CatalogDocProps {
  products: PdfProduct[]
  title?:   string
}

const iconPath = path.join(
  process.cwd(),
  'te-quiero-design-system/project/assets/icon_navy.png'
)

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
            {/* Header — navy pill with TQ icon */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={iconPath} style={s.headerIcon} />
                <View>
                  <Text style={s.headerBrand}>Te Quiero Joyerías</Text>
                  <Text style={s.headerTitle}>Catálogo de producto</Text>
                </View>
              </View>
              <Text style={s.headerDate}>{dateStr}</Text>
            </View>

            {/* Grid: 2 rows × 2 cols — all cells fixed height */}
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
              <Text style={s.footerText}>Te Quiero Joyerías · Catálogo interno</Text>
              <View style={s.footerDot} />
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
