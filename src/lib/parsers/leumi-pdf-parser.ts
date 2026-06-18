import type { RawTransaction } from '../types'

export interface PdfTextItem {
  str: string
  x: number
  y: number
}

function parseLeumiDate(dateStr: string): string {
  const [d, m, y] = dateStr.split('.')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, '').trim()) || 0
}

function groupByY(items: PdfTextItem[]): PdfTextItem[][] {
  const rows: PdfTextItem[][] = []
  for (const item of items) {
    const existing = rows.find(row => Math.abs(row[0].y - item.y) <= 3)
    if (existing) {
      existing.push(item)
    } else {
      rows.push([item])
    }
  }
  return rows.sort((a, b) => b[0].y - a[0].y)
}

// Exported separately so it can be unit-tested without a real PDF
export function parseLeumiRows(items: PdfTextItem[]): RawTransaction[] {
  const rows = groupByY(items)

  // Find header row to calibrate column X positions
  const headerRow = rows.find(row =>
    row.some(item => item.str === 'זכות') && row.some(item => item.str === 'חובה')
  )
  if (!headerRow) return []

  const getColX = (label: string) => headerRow.find(i => i.str === label)?.x ?? -1
  const creditX = getColX('זכות')
  const debitX = getColX('חובה')
  const typeX = getColX('סוג תנועה')
  const dateX = getColX('תאריך')

  const COL_TOL = 25

  const getVal = (row: PdfTextItem[], refX: number) =>
    row.find(item => Math.abs(item.x - refX) <= COL_TOL)?.str ?? ''

  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/
  const result: RawTransaction[] = []

  for (const row of rows) {
    if (row === headerRow) continue
    const dateStr = getVal(row, dateX)
    if (!dateRegex.test(dateStr)) continue

    const merchantName = getVal(row, typeX)
    if (!merchantName) continue

    const creditStr = getVal(row, creditX)
    const debitStr = getVal(row, debitX)

    const creditAmount = parseAmount(creditStr)
    const debitAmount = parseAmount(debitStr)

    const isCredit = creditAmount > 0 && debitAmount === 0
    const amount = isCredit ? creditAmount : debitAmount
    if (amount === 0) continue

    result.push({
      date: parseLeumiDate(dateStr),
      merchantName,
      bankCategory: '',
      amount,
      currency: 'ILS',
      isImmediate: false,
      notes: '',
      direction: isCredit ? 'income' : 'expense',
    })
  }
  return result
}

// Called from browser component — loads pdfjs dynamically
export async function parseLeumiPdf(data: Uint8Array): Promise<RawTransaction[]> {
  // @ts-ignore — pdfjs-dist types vary by version; dynamic import works at runtime
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: data.slice(0) }).promise
  const items: PdfTextItem[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        items.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] })
      }
    }
  }
  return parseLeumiRows(items)
}
