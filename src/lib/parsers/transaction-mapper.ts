import type { ParsedRow } from './csv-parser'
import type { RawTransaction } from '../types'

// Handles DD/MM/YYYY (Discount), DD-MM-YYYY (Max), DD.MM.YY (Isracard)
function parseIsraeliDate(dateStr: string): string {
  const s = (dateStr ?? '').trim()
  const sep = s.includes('/') ? '/' : s.includes('-') ? '-' : s.includes('.') ? '.' : null
  if (!sep) return s
  const parts = s.split(sep)
  if (parts.length !== 3) return s
  const [day, month, year] = parts
  const fullYear = year.length === 2 ? `20${year}` : year
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const CURRENCY_SYMBOLS: Record<string, string> = { '₪': 'ILS', '$': 'USD', '€': 'EUR', '£': 'GBP' }

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
      date: parseIsraeliDate(
        getField(row, 'תאריך עסקה', 'תאריך', 'תאריך רכישה') ?? ''
      ),
      merchantName: getField(row,
        'שם בית העסק', 'שם בית עסק', 'שם ספק', 'שם בית-עסק',
        'תיאור', 'פירוט נוסף', 'תיאור העסקה',
      ),
      bankCategory: getField(row, 'קטגוריה', 'ענף', 'קטגורית עסקה') ?? '',
      amount: parseAmount(
        getField(row, 'סכום חיוב', 'סכום', 'חיוב', 'סכום ₪', 'סכום בש"ח') || '0'
      ),
      currency: CURRENCY_SYMBOLS[getField(row, 'מטבע חיוב', 'מטבע')] ?? 'ILS',
      isImmediate: /מיידי/.test(getField(row, 'סוג עסקה')),
      notes: getField(row, 'הערות', 'פירוט נוסף', 'תיאור נוסף') ?? '',
    }))
}
