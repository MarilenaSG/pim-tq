import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const metal    = searchParams.get('metal')    || undefined
  const familia  = searchParams.get('familia')  || undefined
  const category = searchParams.get('category') || undefined

  const supabase = createServerClient()

  let query = supabase
    .from('products')
    .select('codigo_modelo, description, familia, metal, lista_variantes, is_discontinued')
    .eq('is_discontinued', false)
    .order('metal',       { ascending: true, nullsFirst: false })
    .order('familia',     { ascending: true, nullsFirst: false })
    .order('description', { ascending: true, nullsFirst: false })

  if (metal)    query = query.eq('metal',    metal)
  if (familia)  query = query.eq('familia',  familia)
  if (category) query = query.eq('category', category)

  const { data: products } = await query

  const fecha = new Date().toISOString().slice(0, 10)

  const workbook  = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Pedido')

  // Column widths
  worksheet.columns = [
    { key: 'metal',       width: 18 },
    { key: 'familia',     width: 20 },
    { key: 'description', width: 40 },
    { key: 'uds',         width: 12 },
  ]

  // Header rows (1-3)
  const titleRow = worksheet.addRow(['Joyerías Te Quiero — Plantilla de Pedido', '', '', ''])
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF00557F' } }
  worksheet.mergeCells('A1:D1')

  const dateRow = worksheet.addRow([`Fecha de generación: ${fecha}`, '', '', ''])
  dateRow.getCell(1).font = { size: 10, color: { argb: 'FF888888' } }
  worksheet.mergeCells('A2:D2')

  worksheet.addRow([]) // row 3 empty

  // Column headers (row 4)
  const headerRow = worksheet.addRow(['Metal', 'Familia', 'Descripción', 'Uds. a pedir'])
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00557F' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF00557F' } },
      bottom: { style: 'thin', color: { argb: 'FF00557F' } },
      left:   { style: 'thin', color: { argb: 'FF00557F' } },
      right:  { style: 'thin', color: { argb: 'FF00557F' } },
    }
  })

  // Data rows (from row 5), grouped by metal
  const borderStyle: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFDDDDDD' } }
  const cellBorder = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle }

  let lastMetal: string | null = null

  for (const p of (products ?? [])) {
    const currentMetal = p.metal ?? ''

    if (currentMetal !== lastMetal) {
      lastMetal = currentMetal
      const sepRow = worksheet.addRow([currentMetal, '', '', ''])
      sepRow.getCell(1).value = currentMetal
      sepRow.getCell(1).font  = { bold: true, color: { argb: 'FF5A3E1A' } }
      worksheet.mergeCells(`A${sepRow.number}:D${sepRow.number}`)
      sepRow.getCell(1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5E6CC' },
      }
      sepRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      sepRow.height = 18
    }

    const dataRow = worksheet.addRow([p.metal ?? '', p.familia ?? '', p.description ?? '', ''])
    dataRow.height = 16
    dataRow.eachCell((cell, col) => {
      if (col <= 4) {
        cell.border    = cellBorder
        cell.alignment = { vertical: 'middle', wrapText: col === 3 }
        cell.font      = { size: 10 }
      }
    })
  }

  // Print setup
  worksheet.pageSetup = {
    paperSize:    9,
    orientation:  'portrait',
    fitToPage:    true,
    fitToWidth:   1,
    fitToHeight:  0,
    margins: {
      left: 0.5, right: 0.5,
      top: 0.75, bottom: 0.75,
      header: 0.3, footer: 0.3,
    },
    printTitlesRow: '4:4',
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Plantilla-Pedidos-TQ-${fecha}.xlsx"`,
    },
  })
}
