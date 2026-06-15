import type { ParsedRow } from './csv-parser'
import type { RawTransaction } from '../types'

function parseDiscountDate(dateStr: string): string {
  const parts = (dateStr ?? '').split('/')
  if (parts.length !== 3) return dateStr ?? ''
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseAmount(raw: string): number {
  return parseFloat((raw ?? '0').replace(/,/g, '')) || 0
}

export function mapRows(rows: ParsedRow[]): RawTransaction[] {
  return rows
    .filter(row => row['שם בית העסק']?.trim())
    .map(row => ({
      date: parseDiscountDate(row['תאריך עסקה'] ?? ''),
      merchantName: row['שם בית העסק'].trim(),
      bankCategory: row['קטגוריה'] ?? '',
      amount: parseAmount(row['סכום חיוב'] ?? '0'),
      currency: row['מטבע חיוב']?.trim() || 'ILS',
      isImmediate: row['סוג עסקה']?.trim() === 'חיוב עסקות מיידי',
      notes: row['הערות'] ?? '',
    }))
}
