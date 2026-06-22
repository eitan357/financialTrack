import type { RawTransaction } from '../types'

export interface PdfTextItem {
  str: string
  x: number
  y: number
}

function parseIsracardDate(dateStr: string): string {
  const [d, m, y] = dateStr.split('.')
  const fullYear = y.length === 2 ? `20${y}` : y
  return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/[₪,]/g, '').trim()) || 0
}

function groupByY(items: PdfTextItem[]): PdfTextItem[][] {
  const rows: PdfTextItem[][] = []
  for (const item of items) {
    const existing = rows.find(r => Math.abs(r[0].y - item.y) <= 3)
    if (existing) existing.push(item)
    else rows.push([item])
  }
  return rows.sort((a, b) => b[0].y - a[0].y)
}

const DATE_RE = /^\d{2}\.\d{2}\.\d{2}$/
const ILS_RE = /^₪[\d,]+\.?\d*$/

export function parseIsracardRows(items: PdfTextItem[]): RawTransaction[] {
  const rows = groupByY(items)
  const result: RawTransaction[] = []

  for (const row of rows) {
    // Date at x ∈ [505, 545] matching DD.MM.YY
    const dateItem = row.find(i => DATE_RE.test(i.str) && i.x >= 505 && i.x <= 545)
    if (!dateItem) continue

    // ILS charged amount at x ∈ [215, 260]
    const ilsItem = row.find(i => ILS_RE.test(i.str) && i.x >= 215 && i.x <= 260)
    if (!ilsItem) continue

    // Skip rows where too many items fall in the merchant area — these are legal notice rows
    // that happen to reference a transaction inline
    const merchantAreaItems = row.filter(i => i !== dateItem && i.x >= 330 && i.x <= 515)
    if (merchantAreaItems.length > 4) continue

    // Build merchant name from RTL items in merchant range, sorted high-x first
    const merchantItems = merchantAreaItems
      .filter(i => i.x >= 330 && i.x <= 505)
      .sort((a, b) => b.x - a.x)
    const merchantName = merchantItems.map(i => i.str).join(' ').replace(/^\.+/, '').trim()
    if (!merchantName) continue

    const amount = parseAmount(ilsItem.str)
    if (amount === 0) continue

    result.push({
      date: parseIsracardDate(dateItem.str),
      merchantName,
      bankCategory: '',
      amount,
      currency: 'ILS',
      isImmediate: false,
      notes: '',
      direction: 'expense',
    })
  }
  return result
}

// Called from browser component — loads pdfjs dynamically
export async function parseIsracardPdf(data: Uint8Array): Promise<RawTransaction[]> {
  // @ts-ignore — pdfjs-dist types vary by version; dynamic import works at runtime
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

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
  return parseIsracardRows(items)
}
