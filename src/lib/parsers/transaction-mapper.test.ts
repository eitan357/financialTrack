import { mapRows } from './transaction-mapper'

const BASE_ROW = {
  'תאריך עסקה': '01/06/2026',
  'שם בית העסק': 'שופרסל',
  'קטגוריה': 'מזון',
  'סוג עסקה': 'רגיל',
  'סכום חיוב': '150.00',
  'מטבע חיוב': 'ILS',
  'הערות': '',
}

describe('mapRows', () => {
  it('maps a basic row correctly', () => {
    const [tx] = mapRows([BASE_ROW])
    expect(tx.date).toBe('2026-06-01')
    expect(tx.merchantName).toBe('שופרסל')
    expect(tx.bankCategory).toBe('מזון')
    expect(tx.amount).toBe(150)
    expect(tx.currency).toBe('ILS')
    expect(tx.isImmediate).toBe(false)
    expect(tx.notes).toBe('')
  })

  it('detects immediate transactions', () => {
    const row = { ...BASE_ROW, 'סוג עסקה': 'חיוב עסקות מיידי' }
    expect(mapRows([row])[0].isImmediate).toBe(true)
  })

  it('filters out rows with no merchant name', () => {
    const row = { ...BASE_ROW, 'שם בית העסק': '   ' }
    expect(mapRows([row])).toHaveLength(0)
  })

  it('parses amounts with thousand-separator commas', () => {
    const row = { ...BASE_ROW, 'סכום חיוב': '1,234.56' }
    expect(mapRows([row])[0].amount).toBe(1234.56)
  })

  it('defaults currency to ILS when field is empty', () => {
    const row = { ...BASE_ROW, 'מטבע חיוב': '' }
    expect(mapRows([row])[0].currency).toBe('ILS')
  })

  it('trims whitespace from merchant name', () => {
    const row = { ...BASE_ROW, 'שם בית העסק': '  YES  ' }
    expect(mapRows([row])[0].merchantName).toBe('YES')
  })
})
