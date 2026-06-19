import type { ParsedRow } from './csv-parser'
import type { RawTransaction } from '../types'

function parseDiscountDate(dateStr: string): string {
  const parts = (dateStr ?? '').split('/')
  if (parts.length !== 3) return dateStr ?? ''
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseAmount(raw: string): number {
  return parseFloat((raw ?? '0').replace(/,/g, '').trim()) || 0
}

// Try multiple column name variants (different Israeli credit card exporters use different names)
function getField(row: ParsedRow, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key]?.trim()
    if (val) return val
  }
  return ''
}

export function mapRows(rows: ParsedRow[]): RawTransaction[] {
  return rows
    .filter(row => getField(row,
      'שם בית העסק', 'שם בית עסק', 'שם ספק', 'שם בית-עסק',
      'תיאור', 'פירוט נוסף', 'תיאור העסקה',
    ))
    .map(row => ({
      date: parseDiscountDate(
        getField(row, 'תאריך עסקה', 'תאריך') ?? ''
      ),
      merchantName: getField(row,
        'שם בית העסק', 'שם בית עסק', 'שם ספק', 'שם בית-עסק',
        'תיאור', 'פירוט נוסף', 'תיאור העסקה',
      ),
      bankCategory: getField(row, 'קטגוריה', 'ענף', 'קטגורית עסקה') ?? '',
      amount: parseAmount(
        getField(row, 'סכום חיוב', 'סכום', 'חיוב', 'סכום ₪', 'סכום בש"ח') || '0'
      ),
      currency: getField(row, 'מטבע חיוב', 'מטבע') || 'ILS',
      isImmediate: /מיידי/.test(getField(row, 'סוג עסקה')),
      notes: getField(row, 'הערות', 'פירוט נוסף', 'תיאור נוסף') ?? '',
    }))
}
