import { monthFromFilename, shouldSkipFile, parseExampleCsv } from './parse-example-csv'

describe('monthFromFilename', () => {
  it('extracts ינואר2025 → 2025-01', () => {
    expect(monthFromFilename('ניהול הוצאות והכנסות 2025 - ינואר2025.csv')).toBe('2025-01')
  })
  it('extracts אפריל2026 → 2026-04', () => {
    expect(monthFromFilename('ניהול הוצאות והכנסות 2026 - אפריל2026.csv')).toBe('2026-04')
  })
  it('returns null for template files (no Hebrew month)', () => {
    expect(monthFromFilename('שבלונה.csv')).toBeNull()
  })
})

describe('shouldSkipFile', () => {
  it('skips template files (שבלונה)', () => {
    expect(shouldSkipFile('ניהול הוצאות והכנסות 2025 - שבלונה.csv')).toBe(true)
  })
  it('skips yearly summary files (סיכום שנה)', () => {
    expect(shouldSkipFile('ניהול הוצאות והכנסות 2025 - סיכום שנה 2025.csv')).toBe(true)
  })
  it('skips payment change files (שינוי תשלום)', () => {
    expect(shouldSkipFile('מרץ2025(שינוי תשלום אשראי).csv')).toBe(true)
  })
  it('does not skip regular monthly files', () => {
    expect(shouldSkipFile('ניהול הוצאות והכנסות 2025 - ינואר2025.csv')).toBe(false)
  })
})

describe('parseExampleCsv', () => {
  // Minimal CSV: 4 header rows + 2 transaction rows + סה"כ stop marker
  const minimalCsv = [
    'ניהול הוצאות והכנסות,,,,,,,,,,,,,,,',
    'סיכומים,,,,אשראי,,,,,,,,,משכורת,,,,',
    'הוצאות,,,,אשראי בהצדעה,,,,,,,,,,,,,',
    'בנק,,,,שם החנות,סכום,מה קניתי,תאריך,קטגוריה,,קטגוריה,סכום,,פעולה,סכום,,',
    ',,,,שופרסל, ₪  100.00 ,אוכל,15/01/2025,אוכל,,אוכל, ₪  100.00 ,,משכורת,"₪8,000.00",,',
    ',,,,רמי לוי, ₪  50.00 ,ירקות,16/01/2025,אוכל,,חשבונות, ₪  200.00 ,,מס הכנסה,,,',
    ',,,,סה"כ, ₪  150.00 ,,,,,,,,,,,,,',
  ].join('\n')

  it('returns null for a filename with no Hebrew month', () => {
    expect(parseExampleCsv(minimalCsv, 'שבלונה.csv')).toBeNull()
  })

  it('extracts transactions from the credit card section', () => {
    const result = parseExampleCsv(minimalCsv, 'ניהול הוצאות והכנסות 2025 - ינואר2025.csv')
    expect(result).not.toBeNull()
    expect(result!.transactions).toHaveLength(2)
    expect(result!.transactions[0].merchantName).toBe('שופרסל')
    expect(result!.transactions[0].amount).toBe(100)
    expect(result!.transactions[0].date).toBe('2025-01-15')
    expect(result!.transactions[0].categoryName).toBe('אוכל')
    expect(result!.transactions[0].month).toBe('2025-01')
    expect(result!.transactions[0].accountName).toBe('אשראי בהצדעה')
  })

  it('extracts salary gross from the salary section', () => {
    const result = parseExampleCsv(minimalCsv, 'ניהול הוצאות והכנסות 2025 - ינואר2025.csv')
    expect(result!.salary).not.toBeNull()
    expect(result!.salary!.grossAmount).toBe(8000)
  })

  it('sets month from filename, not transaction date', () => {
    const result = parseExampleCsv(minimalCsv, 'ניהול הוצאות והכנסות 2025 - ינואר2025.csv')
    expect(result!.month).toBe('2025-01')
    expect(result!.transactions[0].month).toBe('2025-01')
  })
})
