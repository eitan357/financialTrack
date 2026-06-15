import * as XLSX from 'xlsx'
import type { ParsedRow } from './csv-parser'

export function getSheetNames(data: Uint8Array): string[] {
  const workbook = XLSX.read(data, { type: 'array' })
  return workbook.SheetNames
}

export function parseSheet(data: Uint8Array, sheetName: string): ParsedRow[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '', raw: false })
}
