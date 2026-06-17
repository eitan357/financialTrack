import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { parseExampleCsv, shouldSkipFile } from '@/lib/seed/parse-example-csv'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  const examplesDir = path.join(process.cwd(), 'examples')
  const years = ['2025', '2026']
  const results = []

  for (const year of years) {
    const yearDir = path.join(examplesDir, year)
    if (!fs.existsSync(yearDir)) continue
    const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.csv'))
    for (const file of files) {
      if (shouldSkipFile(file)) continue
      const content = fs.readFileSync(path.join(yearDir, file), 'utf-8')
      const parsed = parseExampleCsv(content, file)
      if (parsed) results.push(parsed)
    }
  }

  const totalTransactions = results.reduce((s, r) => s + r.transactions.length, 0)
  const totalBankTransactions = results.reduce((s, r) => s + r.bankTransactions.length, 0)
  const totalSalaries = results.filter(r => r.salary !== null).length
  const totalIncomeEntries = results.reduce((s, r) => s + r.incomeEntries.length, 0)

  return NextResponse.json({
    months: results.map(r => r.month),
    totalTransactions,
    totalBankTransactions,
    totalSalaries,
    totalIncomeEntries,
    data: results,
  })
}
