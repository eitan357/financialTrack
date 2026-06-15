import * as XLSX from 'xlsx'
import { getSheetNames, parseSheet } from './xlsx-parser'

// Helper: build an in-memory XLSX Uint8Array
function buildXLSX(sheets: Record<string, Record<string, string>[]>): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

describe('getSheetNames', () => {
  it('returns all sheet names in order', () => {
    const data = buildXLSX({ 'פירוט': [], 'קניות בחול': [] })
    expect(getSheetNames(data)).toEqual(['פירוט', 'קניות בחול'])
  })

  it('returns single sheet name', () => {
    const data = buildXLSX({ 'גליון1': [] })
    expect(getSheetNames(data)).toEqual(['גליון1'])
  })
})

describe('parseSheet', () => {
  it('returns rows from named sheet', () => {
    const data = buildXLSX({
      'פירוט': [{ 'שם בית העסק': 'שופרסל', 'סכום חיוב': '150' }],
    })
    const rows = parseSheet(data, 'פירוט')
    expect(rows).toHaveLength(1)
    expect(rows[0]['שם בית העסק']).toBe('שופרסל')
  })

  it('returns empty array for non-existent sheet', () => {
    const data = buildXLSX({ 'פירוט': [] })
    expect(parseSheet(data, 'לא קיים')).toEqual([])
  })

  it('returns empty array for sheet with no rows', () => {
    const data = buildXLSX({ 'ריק': [] })
    expect(parseSheet(data, 'ריק')).toEqual([])
  })
})
