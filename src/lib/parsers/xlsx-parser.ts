import * as XLSX from 'xlsx'
import type { ParsedRow } from './csv-parser'

export function getSheetNames(data: Uint8Array): string[] {
  const workbook = XLSX.read(data, { type: 'array' })
  return workbook.SheetNames
}

// Known column names that signal this row is the real data header.
// Israeli banks/credit companies put metadata rows first, so we scan for the header.
const HEADER_SIGNALS = [
  'שם בית העסק', 'שם בית עסק', 'שם ספק', 'שם בית-עסק',
  'תאריך עסקה', 'תאריך', 'סכום חיוב', 'סכום', 'תיאור', 'תיאור העסקה',
]

export function parseSheet(data: Uint8Array, sheetName: string): ParsedRow[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false })

  // Find the first row that looks like a data header
  const headerIdx = raw.findIndex(row =>
    row.some(cell => HEADER_SIGNALS.includes(String(cell).trim()))
  )

  if (headerIdx === -1) {
    // No recognizable header found — fall back to default (row 1 as header)
    return XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '', raw: false })
  }

  const headers = raw[headerIdx].map(h => String(h).trim())

  return raw
    .slice(headerIdx + 1)
    .filter(row => row.some(cell => String(cell).trim() !== ''))
    .map(row => {
      const obj: ParsedRow = {}
      headers.forEach((header, i) => {
        if (header) obj[header] = String(row[i] ?? '').trim()
      })
      return obj
    })
}
