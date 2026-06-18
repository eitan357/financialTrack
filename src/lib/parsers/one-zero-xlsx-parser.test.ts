import { parseOneZeroXlsx } from './one-zero-xlsx-parser'
import * as XLSX from 'xlsx'

function makeXlsxFromRows(rows: (string | number)[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

describe('parseOneZeroXlsx', () => {
  it('parses expense row (negative amount)', () => {
    const rows = [
      ['Account info', '', '', '', '', '', ''],          // header junk row
      ['01/06/2026', '', '', 'SuperMarket', -450.5, 'ILS', 'חיוב'],
    ]
    const data = makeXlsxFromRows(rows)
    const result = parseOneZeroXlsx(data)
    expect(result).toHaveLength(1)
    expect(result[0].merchantName).toBe('SuperMarket')
    expect(result[0].amount).toBe(450.5)
    expect(result[0].direction).toBe('expense')
    expect(result[0].date).toBe('2026-06-01')
    expect(result[0].currency).toBe('ILS')
  })

  it('parses income/refund row (positive amount or זיכוי)', () => {
    const rows = [
      ['15/06/2026', '', '', 'Refund Store', 200, 'ILS', 'זיכוי'],
    ]
    const result = parseOneZeroXlsx(makeXlsxFromRows(rows))
    expect(result[0].direction).toBe('income')
    expect(result[0].amount).toBe(200)
  })

  it('skips rows without a valid date in column A', () => {
    const rows = [
      ['Not a date', '', '', 'SomeMerchant', 100, 'ILS', 'חיוב'],
      ['15/06/2026', '', '', 'RealMerchant', 50, 'ILS', 'חיוב'],
    ]
    const result = parseOneZeroXlsx(makeXlsxFromRows(rows))
    expect(result).toHaveLength(1)
    expect(result[0].merchantName).toBe('RealMerchant')
  })

  it('skips rows with empty merchant name', () => {
    const rows = [
      ['15/06/2026', '', '', '', -100, 'ILS', 'חיוב'],
    ]
    const result = parseOneZeroXlsx(makeXlsxFromRows(rows))
    expect(result).toHaveLength(0)
  })
})
