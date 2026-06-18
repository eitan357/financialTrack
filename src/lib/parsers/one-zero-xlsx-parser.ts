import * as XLSX from 'xlsx'
import type { RawTransaction } from '../types'

function parseOneZeroDate(dateStr: string): string {
  const [d, m, y] = dateStr.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseOneZeroXlsx(data: Uint8Array): RawTransaction[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as (string | number)[][]

  const result: RawTransaction[] = []
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/

  for (const row of rows) {
    const dateStr = String(row[0] ?? '').trim()
    if (!dateRegex.test(dateStr)) continue

    const merchantName = String(row[3] ?? '').trim()
    if (!merchantName) continue

    const amountRaw = parseFloat(String(row[4] ?? '0').replace(/,/g, '')) || 0
    const currency = String(row[5] ?? 'ILS').trim() || 'ILS'
    const type = String(row[6] ?? '').trim()

    const isCredit = type === 'זיכוי' || amountRaw > 0

    result.push({
      date: parseOneZeroDate(dateStr),
      merchantName,
      bankCategory: '',
      amount: Math.abs(amountRaw),
      currency,
      isImmediate: false,
      notes: '',
      direction: isCredit ? 'income' : 'expense',
    })
  }
  return result
}
