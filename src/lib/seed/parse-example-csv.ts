import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string        // YYYY-MM-DD
  merchantName: string
  description: string
  amount: number
  categoryName: string
  accountName: string
  month: string       // YYYY-MM (from filename, NOT transaction date)
}

export interface ParsedBankTransaction {
  date: string
  merchantName: string
  description: string
  amount: number
  accountName: string
  month: string
  direction: 'income' | 'expense'
}

export interface ParsedSalary {
  month: string
  grossAmount: number
  incomeTax: number
  nationalInsurance: number
  healthInsurance: number
  pension: number
  trainingFund: number
  netAmount: number
}

export interface ParsedIncomeEntry {
  month: string
  sourceName: string
  amount: number
}

export interface ParsedMonthData {
  month: string
  transactions: ParsedTransaction[]
  bankTransactions: ParsedBankTransaction[]
  salary: ParsedSalary | null
  incomeEntries: ParsedIncomeEntry[]
}

const HE_MONTH_MAP: Record<string, string> = {
  ינואר: '01', פברואר: '02', מרץ: '03', אפריל: '04',
  מאי: '05', יוני: '06', יולי: '07', אוגוסט: '08',
  ספטמבר: '09', אוקטובר: '10', נובמבר: '11', דצמבר: '12',
}

export function monthFromFilename(filename: string): string | null {
  for (const [heName, num] of Object.entries(HE_MONTH_MAP)) {
    const match = filename.match(new RegExp(`${heName}(\\d{4})`))
    if (match) return `${match[1]}-${num}`
  }
  return null
}

export function shouldSkipFile(filename: string): boolean {
  return filename.includes('שבלונה') ||
    filename.includes('סיכום שנה') ||
    filename.includes('שינוי תשלום')
}

function parseAmount(raw: string): number {
  const clean = (raw || '').replace(/[₪,\s]/g, '').replace('−', '-').replace('–', '-')
  return parseFloat(clean) || 0
}

function parseDate(raw: string): string {
  const parts = (raw || '').trim().split('/')
  if (parts.length !== 3) return ''
  const [dd, mm, yyyy] = parts
  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function extractCreditTransactions(
  rows: string[][], startRow: number, accountName: string, month: string
): ParsedTransaction[] {
  const result: ParsedTransaction[] = []
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    const merchant = (row[4] ?? '').trim()
    if (!merchant) continue
    if (merchant.includes('סה"כ') || merchant.includes('סה""כ')) break
    const amountRaw = (row[5] ?? '').trim()
    const description = (row[6] ?? '').trim()
    const dateRaw = (row[7] ?? '').trim()
    const categoryName = (row[8] ?? '').trim()
    if (!amountRaw || !dateRaw) continue
    const date = parseDate(dateRaw)
    if (!date) continue
    result.push({
      date, merchantName: merchant, description,
      amount: Math.abs(parseAmount(amountRaw)),
      categoryName, accountName, month,
    })
  }
  return result
}

function extractSalary(rows: string[][], month: string): ParsedSalary | null {
  const salaryLines: Record<string, number> = {}
  for (let i = 4; i <= 14 && i < rows.length; i++) {
    const label = (rows[i]?.[13] ?? '').trim()
    const amount = parseAmount(rows[i]?.[14] ?? '')
    if (label) salaryLines[label] = amount
  }
  const gross = salaryLines['משכורת'] ?? 0
  if (gross === 0) return null
  const incomeTax = Math.abs(salaryLines['מס הכנסה'] ?? 0)
  const nationalInsurance = Math.abs(
    salaryLines['ביטוח לאומי'] ?? salaryLines['ביטוח לאומי '] ?? 0
  )
  const healthInsurance = Math.abs(salaryLines['ביטוח בריאות'] ?? 0)
  const pension = Math.abs(salaryLines['פנסיה'] ?? 0)
  const trainingFund = Math.abs(
    salaryLines['קרן השתלמות'] ?? salaryLines['קרן השתלמות '] ?? 0
  )
  const netAmount = gross - incomeTax - nationalInsurance - healthInsurance - pension - trainingFund
  return { month, grossAmount: gross, incomeTax, nationalInsurance, healthInsurance, pension, trainingFund, netAmount }
}

function extractIncomeEntries(rows: string[][], month: string, salaryAmount: number): ParsedIncomeEntry[] {
  const result: ParsedIncomeEntry[] = []
  let incomeStart = -1
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if ((rows[i]?.[0] ?? '').trim() === 'הכנסות') { incomeStart = i + 1; break }
  }
  if (incomeStart === -1) return result

  for (let i = incomeStart; i < incomeStart + 10 && i < rows.length; i++) {
    const label = (rows[i]?.[0] ?? '').trim()
    if (!label) continue
    if (label.includes('סה"כ') || label.includes('סה""כ')) break
    const amount = parseAmount(rows[i]?.[1] ?? '')
    if (amount <= 0) continue
    // Skip One Zero bank — it's captured as salary
    if (label.toLowerCase().includes('one zero') && Math.abs(amount - salaryAmount) < 1) continue
    result.push({ month, sourceName: label, amount })
  }
  return result
}

function extractBankSection(
  rows: string[][],
  colOffset: number,
  accountName: string,
  month: string
): ParsedBankTransaction[] {
  const nameCol = colOffset
  const amtCol = colOffset + 1
  const descCol = colOffset + 2
  const dateCol = colOffset + 3

  let expenseStart = -1
  let incomeStart = -1

  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i]?.[nameCol] ?? '').trim()
    if (cell === 'הוצאות' && expenseStart === -1) {
      expenseStart = i
    }
    if (cell === 'הכנסות' && expenseStart !== -1 && incomeStart === -1) {
      incomeStart = i
    }
    if (incomeStart !== -1 && cell.startsWith('סכום לפי')) break
  }

  if (expenseStart === -1) return []

  const result: ParsedBankTransaction[] = []

  // Extract expense entries
  const expenseEndBound = incomeStart !== -1 ? incomeStart : expenseStart + 25
  for (let i = expenseStart + 2; i < Math.min(expenseEndBound, rows.length); i++) {
    const name = (rows[i]?.[nameCol] ?? '').trim()
    if (!name) continue
    if (name.includes('סה"כ') || name.includes('סה""כ') || name === 'הכנסות') break
    // Skip credit card payments and internal bank transfers
    if (name.includes('אשראי') || name.includes('העברה')) continue
    const amtRaw = (rows[i]?.[amtCol] ?? '').trim()
    if (!amtRaw) continue
    const amount = parseAmount(amtRaw)
    if (amount <= 0) continue
    const desc = (rows[i]?.[descCol] ?? '').trim()
    const dateRaw = (rows[i]?.[dateCol] ?? '').trim()
    const date = dateRaw ? parseDate(dateRaw) : `${month}-01`
    if (!date) continue
    result.push({ date, merchantName: name, description: desc, amount, accountName, month, direction: 'expense' })
  }

  // Extract income entries
  if (incomeStart !== -1) {
    for (let i = incomeStart + 2; i < Math.min(incomeStart + 30, rows.length); i++) {
      const name = (rows[i]?.[nameCol] ?? '').trim()
      if (!name) continue
      if (
        name.includes('סה"כ') || name.includes('סה""כ') ||
        name.startsWith('סכום לפי') || name.startsWith('הפרש')
      ) break
      // Skip meta-labels, credit refunds, and internal transfers
      if (name === 'הכנסה נוספת') continue
      if (name.includes('אשראי') || name.includes('העברה')) continue
      const amtRaw = (rows[i]?.[amtCol] ?? '').trim()
      if (!amtRaw) continue
      const amount = parseAmount(amtRaw)
      if (amount <= 0) continue
      const desc = (rows[i]?.[descCol] ?? '').trim()
      // Skip salary deposits — already tracked via SalaryEntry
      if (desc === 'משכורת') continue
      const dateRaw = (rows[i]?.[dateCol] ?? '').trim()
      const date = dateRaw ? parseDate(dateRaw) : `${month}-01`
      result.push({ date, merchantName: name, description: desc, amount, accountName, month, direction: 'income' })
    }
  }

  return result
}

export function parseExampleCsv(csvContent: string, filename: string): ParsedMonthData | null {
  const month = monthFromFilename(filename)
  if (!month) return null

  const result = Papa.parse<string[]>(csvContent, { skipEmptyLines: false })
  const rows = result.data

  const hatzlaadaTxs = extractCreditTransactions(rows, 4, 'אשראי בהצדעה', month)

  let oneZeroTxs: ParsedTransaction[] = []
  for (let i = rows.length - 1; i >= 40; i--) {
    const cell = (rows[i]?.[4] ?? '').toLowerCase().trim()
    if (cell.includes('one zero')) {
      oneZeroTxs = extractCreditTransactions(rows, i + 2, 'אשראי One Zero', month)
      break
    }
  }

  const salary = extractSalary(rows, month)
  const incomeEntries = extractIncomeEntries(rows, month, salary?.grossAmount ?? 0)

  // Detect which bank is at col 18 vs col 23 (layout varies by month)
  const row1 = rows[1] || []
  const col18IsOneZero = (row1[18] ?? '').toLowerCase().includes('one zero')
  const oneZeroCol = col18IsOneZero ? 18 : 23
  const leumiCol = col18IsOneZero ? 23 : 18

  const bankTransactions: ParsedBankTransaction[] = [
    ...extractBankSection(rows, oneZeroCol, 'בנק One Zero', month),
    ...extractBankSection(rows, leumiCol, 'בנק לאומי', month),
  ]

  return {
    month,
    transactions: [...hatzlaadaTxs, ...oneZeroTxs],
    bankTransactions,
    salary,
    incomeEntries,
  }
}
