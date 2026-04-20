import { google } from 'googleapis'
import { createServiceClient } from './supabase/server'

// ── Auth ──────────────────────────────────────────────────────

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no está configurada')

  const json = Buffer.from(b64, 'base64').toString('utf-8')
  const key  = JSON.parse(json)

  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

// ── Export logic ──────────────────────────────────────────────

export interface ExportOptions {
  metal?:    string
  familia?:  string
  category?: string
  abc?:      string
  includeFinancials: boolean
}

export interface ExportResult {
  sheetUrl: string
  sheetId:  string
  rowCount: number
}

export async function exportToGoogleSheets(opts: ExportOptions): Promise<ExportResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID no está configurada')

  const auth     = getAuth()
  const sheets   = google.sheets({ version: 'v4', auth })
  const supabase = createServiceClient()


  // 1 · Fetch products
  let query = supabase
    .from('products')
    .select(`
      codigo_modelo, description, category, familia, metal, karat,
      supplier_name, num_variantes, abc_ventas, ingresos_12m
    `)
    .order('abc_ventas', { ascending: true, nullsFirst: false })
    .order('ingresos_12m', { ascending: false, nullsFirst: false })

  if (opts.metal)    query = query.eq('metal', opts.metal)
  if (opts.familia)  query = query.eq('familia', opts.familia)
  if (opts.category) query = query.eq('category', opts.category)
  if (opts.abc)      query = query.eq('abc_ventas', opts.abc)

  const { data: products, error } = await query
  if (error) throw new Error(`Supabase error: ${error.message}`)
  if (!products?.length) throw new Error('No hay productos con los filtros seleccionados')

  const codes = products.map(p => p.codigo_modelo)

  // 2 · Fetch images + shopify data
  const [imagesRes, shopifyRes] = await Promise.all([
    supabase.from('product_images').select('codigo_modelo, url').in('codigo_modelo', codes).eq('is_primary', true),
    supabase.from('product_shopify_data').select('codigo_modelo, shopify_title, shopify_tags, shopify_status').in('codigo_modelo', codes),
  ])

  const imageMap   = Object.fromEntries((imagesRes.data ?? []).map(r => [r.codigo_modelo, r.url]))
  const shopifyMap = Object.fromEntries((shopifyRes.data ?? []).map(r => [r.codigo_modelo, r]))

  // 3 · Build rows
  const headers = [
    'Imagen', 'Código', 'Descripción', 'Categoría', 'Familia',
    'Metal', 'Quilates', 'Proveedor', 'Variantes', 'ABC',
    ...(opts.includeFinancials ? ['Ingresos 12m'] : []),
    'Título Shopify', 'Tags Shopify', 'Estado Shopify',
  ]

  const dataRows = products.map(p => {
    const imgUrl  = imageMap[p.codigo_modelo]
    const shopify = shopifyMap[p.codigo_modelo]
    return [
      imgUrl ? `=IMAGE("${imgUrl}")` : '',
      p.codigo_modelo,
      p.description    ?? '',
      p.category       ?? '',
      p.familia        ?? '',
      p.metal          ?? '',
      p.karat          ?? '',
      p.supplier_name  ?? '',
      p.num_variantes  ?? '',
      p.abc_ventas     ?? '',
      ...(opts.includeFinancials ? [p.ingresos_12m ?? ''] : []),
      shopify?.shopify_title              ?? '',
      shopify?.shopify_tags?.join(', ')   ?? '',
      shopify?.shopify_status             ?? '',
    ]
  })

  const allRows = [headers, ...dataRows]

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`

  // 4 · Clear existing content
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range:         'A1:ZZ10000',
  })

  // 5 · Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId:    sheetId,
    range:            'A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  })

  // 6 · Format (non-fatal)
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat:      { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0, green: 0.333, blue: 0.498 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          {
            updateDimensionProperties: {
              range:      { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 80 },
              fields:     'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range:      { sheetId: 0, dimension: 'ROWS', startIndex: 1, endIndex: products.length + 1 },
              properties: { pixelSize: 70 },
              fields:     'pixelSize',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: headers.length },
            },
          },
        ],
      },
    })
  } catch {
    // Format errors are non-fatal — data is already written
  }

  return { sheetUrl, sheetId, rowCount: products.length }
}
