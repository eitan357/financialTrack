import { parseCSV } from './csv-parser'

describe('parseCSV', () => {
  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('parses CSV with Hebrew headers', () => {
    const csv = `תאריך עסקה,שם בית העסק,סכום חיוב\n01/06/2026,שופרסל,150.00`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['שם בית העסק']).toBe('שופרסל')
    expect(rows[0]['סכום חיוב']).toBe('150.00')
  })

  it('skips blank lines', () => {
    const csv = `תאריך עסקה,שם בית העסק\n\n01/06/2026,שופרסל\n`
    expect(parseCSV(csv)).toHaveLength(1)
  })

  it('parses multiple rows', () => {
    const csv = `תאריך עסקה,שם בית העסק\n01/06/2026,שופרסל\n02/06/2026,YES`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]['שם בית העסק']).toBe('YES')
  })
})
