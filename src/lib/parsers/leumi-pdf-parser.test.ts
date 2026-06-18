import { parseLeumiRows } from './leumi-pdf-parser'

// parseLeumiRows takes pre-extracted text items (not the PDF file itself)
// so we can test it without a real PDF or pdfjs-dist

interface TextItem { str: string; x: number; y: number }

describe('parseLeumiRows', () => {
  const headerRow: TextItem[] = [
    { str: 'תאריך', x: 480, y: 700 },
    { str: 'סוג תנועה', x: 350, y: 700 },
    { str: 'זכות', x: 250, y: 700 },
    { str: 'חובה', x: 170, y: 700 },
    { str: 'יתרה מצטברת', x: 80, y: 700 },
  ]

  it('parses an expense row (חובה)', () => {
    const items: TextItem[] = [
      ...headerRow,
      { str: '05.06.2026', x: 480, y: 650 },
      { str: 'SuperMarket', x: 350, y: 650 },
      { str: '320.50', x: 170, y: 650 },
      { str: '15,200.00', x: 80, y: 650 },
    ]
    const result = parseLeumiRows(items)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-06-05')
    expect(result[0].merchantName).toBe('SuperMarket')
    expect(result[0].amount).toBe(320.5)
    expect(result[0].direction).toBe('expense')
  })

  it('parses an income row (זכות)', () => {
    const items: TextItem[] = [
      ...headerRow,
      { str: '10.06.2026', x: 480, y: 600 },
      { str: 'הכנסה מינואר', x: 350, y: 600 },
      { str: '5,000.00', x: 250, y: 600 },
      { str: '20,000.00', x: 80, y: 600 },
    ]
    const result = parseLeumiRows(items)
    expect(result[0].direction).toBe('income')
    expect(result[0].amount).toBe(5000)
  })

  it('skips the header row itself', () => {
    const result = parseLeumiRows(headerRow)
    expect(result).toHaveLength(0)
  })

  it('skips rows without a valid date', () => {
    const items: TextItem[] = [
      ...headerRow,
      { str: 'not-a-date', x: 480, y: 650 },
      { str: 'SomeMerchant', x: 350, y: 650 },
      { str: '100.00', x: 170, y: 650 },
      { str: '1,000.00', x: 80, y: 650 },
    ]
    const result = parseLeumiRows(items)
    expect(result).toHaveLength(0)
  })
})
