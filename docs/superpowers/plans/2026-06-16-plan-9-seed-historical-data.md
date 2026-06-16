# Seed Historical Data from Example CSVs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse the historical Excel CSV files in `examples/2025/` and `examples/2026/` and seed them into Firestore via a simple admin page. Imports credit card transactions and salary entries.

**Architecture:**
- `src/lib/seed/parse-example-csv.ts` — pure parsing logic (no Firestore calls, testable)
- `src/app/api/seed-data/route.ts` — Next.js API route (dev-only) that reads files from the filesystem and returns parsed JSON
- `src/app/(app)/admin/seed/page.tsx` — client page that calls the API, shows a preview, then writes to Firestore using the authenticated client SDK

**Tech Stack:** TypeScript, Next.js App Router (API route + client page), PapaParse, Firebase Firestore client SDK, Jest

---

## CSV Format Reference

These example files are NOT standard CSVs — they are multi-section spreadsheets exported as CSV.

**Column indices (0-indexed):**
| Index | Content |
|---|---|
| 0-3 | Summary section (bank balances, labels) |
| 4 | Credit card merchant name (שם החנות) |
| 5 | Amount (סכום) |
| 6 | Description (מה קניתי) |
| 7 | Date (תאריך, format: DD/MM/YYYY) |
| 8 | Category (קטגוריה, Hebrew name) |
| 10 | Category summary name |
| 11 | Category summary total |
| 13 | Salary line type (משכורת / מס הכנסה / ביטוח לאומי / ביטוח בריאות / פנסיה / קרן השתלמות) |
| 14 | Salary line amount |

**Credit card transactions:**
- Start from row index 4 (5th row — skip 4 header rows)
- Stop when column 4 (index 4) contains `סה"כ` (trimmed) or is empty for 3+ consecutive rows
- Skip rows where column 4 is empty
- The SECOND credit card section (One Zero) is found by searching for a row where column 4 (trimmed, lowercased) contains `one zero`. Then skip 2 more rows and parse same columns.

**Amount parsing:**
```typescript
function parseAmount(raw: string): number {
  // Remove ₪, spaces, commas; handle negative prefix
  const clean = raw.replace(/[₪,\s]/g, '').replace('−', '-').replace('–', '-')
  return parseFloat(clean) || 0
}
```

**Date parsing:**
```typescript
function parseDate(raw: string): string {
  // DD/MM/YYYY → YYYY-MM-DD
  const [dd, mm, yyyy] = raw.trim().split('/')
  if (!dd || !mm || !yyyy) return ''
  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}
```

**Month from filename:**
```typescript
const HE_MONTH_MAP: Record<string, string> = {
  ינואר: '01', פברואר: '02', מרץ: '03', אפריל: '04',
  מאי: '05', יוני: '06', יולי: '07', אוגוסט: '08',
  ספטמבר: '09', אוקטובר: '10', נובמבר: '11', דצמבר: '12',
}
function monthFromFilename(filename: string): string | null {
  // e.g. "ניהול הוצאות והכנסות 2025 - ינואר2025.csv"
  for (const [heName, num] of Object.entries(HE_MONTH_MAP)) {
    const match = filename.match(new RegExp(`${heName}(\\d{4})`))
    if (match) return `${match[1]}-${num}`
  }
  return null
}
```

**Files to skip:**
- Contains `שבלונה` in the filename (template)
- Contains `סיכום שנה` in the filename (yearly summary)
- Contains `שינוי תשלום` in the filename (payment change variant)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/seed/parse-example-csv.ts` | Create | Pure CSV parsing, returns structured data |
| `src/lib/seed/parse-example-csv.test.ts` | Create | Unit tests for parsing |
| `src/app/api/seed-data/route.ts` | Create | Dev-only API route: read files, parse, return JSON |
| `src/app/(app)/admin/seed/page.tsx` | Create | UI: load preview, confirm import, write to Firestore |

---

## Task 1: CSV parsing library

**Files:**
- Create: `src/lib/seed/parse-example-csv.ts`
- Create: `src/lib/seed/parse-example-csv.test.ts`

**Types:**
```typescript
export interface ParsedTransaction {
  date: string        // YYYY-MM-DD
  merchantName: string
  description: string
  amount: number
  categoryName: string  // Hebrew name e.g. "אוכל"
  accountName: string   // e.g. "אשראי בהצדעה" or "אשראי One Zero"
  month: string         // YYYY-MM (from filename, not transaction date)
}

export interface ParsedSalary {
  month: string          // YYYY-MM
  grossAmount: number
  incomeTax: number
  nationalInsurance: number
  healthInsurance: number
  pension: number
  trainingFund: number
  netAmount: number
}

export interface ParsedMonthData {
  month: string
  transactions: ParsedTransaction[]
  salary: ParsedSalary | null
}
```

**Parsing function:**
```typescript
import Papa from 'papaparse'

export function parseExampleCsv(csvContent: string, filename: string): ParsedMonthData | null
```

The function:
1. Calls `monthFromFilename(filename)` — returns null if month can't be extracted (template/summary files return null before reaching this)
2. Parses with PapaParse: `Papa.parse<string[]>(csvContent, { skipEmptyLines: false })`
3. Extracts the first credit section (rows from index 4, cols 4-8) until reaching the "סה"כ" marker
4. Extracts the One Zero section by finding the marker row
5. Extracts salary from rows 4-9 in columns 13-14

**Full implementation:**
```typescript
import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string
  merchantName: string
  description: string
  amount: number
  categoryName: string
  accountName: string
  month: string
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

export interface ParsedMonthData {
  month: string
  transactions: ParsedTransaction[]
  salary: ParsedSalary | null
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
    if (merchant.includes('סה"כ') || merchant.includes('סה""כ') || merchant === 'סה"כ') break
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
  // Salary data is in rows 4-9 (index 4-9), columns 13-14
  const salaryLines: Record<string, number> = {}
  for (let i = 4; i < Math.min(i + 10, rows.length); i++) {
    const label = (rows[i]?.[13] ?? '').trim()
    const amount = parseAmount(rows[i]?.[14] ?? '')
    if (label && amount !== 0) salaryLines[label] = amount
    // Stop after 10 rows to avoid reading into unrelated data
    if (i >= 14) break
  }
  const gross = salaryLines['משכורת'] ?? 0
  if (gross === 0) return null
  const incomeTax = Math.abs(salaryLines['מס הכנסה'] ?? 0)
  const nationalInsurance = Math.abs(salaryLines['ביטוח לאומי'] ?? salaryLines['ביטוח לאומי '] ?? 0)
  const healthInsurance = Math.abs(salaryLines['ביטוח בריאות'] ?? 0)
  const pension = Math.abs(salaryLines['פנסיה'] ?? 0)
  const trainingFund = Math.abs(salaryLines['קרן השתלמות'] ?? salaryLines['קרן השתלמות '] ?? 0)
  const netAmount = gross - incomeTax - nationalInsurance - healthInsurance - pension - trainingFund
  return { month, grossAmount: gross, incomeTax, nationalInsurance, healthInsurance, pension, trainingFund, netAmount }
}

export function parseExampleCsv(csvContent: string, filename: string): ParsedMonthData | null {
  const month = monthFromFilename(filename)
  if (!month) return null

  const result = Papa.parse<string[]>(csvContent, { skipEmptyLines: false })
  const rows = result.data

  // First credit section starts at row 4 (index 4), cols 4-8
  const hatzlaadaTxs = extractCreditTransactions(rows, 4, 'אשראי בהצדעה', month)

  // Find One Zero section: look for a row where col 4 (lowercased, trimmed) contains 'one zero'
  let oneZeroTxs: ParsedTransaction[] = []
  for (let i = rows.length - 1; i >= 40; i--) {
    const cell = (rows[i]?.[4] ?? '').toLowerCase().trim()
    if (cell.includes('one zero')) {
      oneZeroTxs = extractCreditTransactions(rows, i + 2, 'אשראי One Zero', month)
      break
    }
  }

  const salary = extractSalary(rows, month)

  return {
    month,
    transactions: [...hatzlaadaTxs, ...oneZeroTxs],
    salary,
  }
}
```

**Note about the salary extraction loop bug:** The loop has a bug — it should loop `i` from 4 to 14, not `i < Math.min(i + 10, rows.length)`. Fix:
```typescript
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
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/seed/parse-example-csv.test.ts`:

```typescript
import { monthFromFilename, shouldSkipFile, parseExampleCsv } from './parse-example-csv'

describe('monthFromFilename', () => {
  it('extracts ינואר2025 → 2025-01', () => {
    expect(monthFromFilename('ניהול הוצאות והכנסות 2025 - ינואר2025.csv')).toBe('2025-01')
  })
  it('extracts אפריל2026 → 2026-04', () => {
    expect(monthFromFilename('ניהול הוצאות והכנסות 2026 - אפריל2026.csv')).toBe('2026-04')
  })
  it('returns null for template files', () => {
    expect(monthFromFilename('ניהול הוצאות והכנסות 2025 - שבלונה.csv')).toBeNull()
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
  // Minimal CSV with 4 header rows + 2 transaction rows + סה"כ row
  const minimalCsv = [
    'ניהול הוצאות והכנסות,,,,,,,,,,,,,,,',    // row 0
    'סיכומים,,,,אשראי,,,,,,,,,משכורת,,,,',    // row 1
    'הוצאות,,,,אשראי בהצדעה,,,,,,,,,,,,,',    // row 2
    'בנק,,,,שם החנות,סכום,מה קניתי,תאריך,קטגוריה,,קטגוריה,סכום,,פעולה,סכום,,', // row 3
    ',,,,שופרסל, ₪  100.00 ,אוכל,15/01/2025,אוכל,,אוכל, ₪  100.00 ,,משכורת,"₪8,000.00",,', // row 4 (tx1)
    ',,,,רמי לוי, ₪  50.00 ,ירקות,16/01/2025,אוכל,,חשבונות, ₪  200.00 ,,מס הכנסה,,,',     // row 5 (tx2)
    ',,,,סה"כ, ₪  150.00 ,,,,,,,,,,,,,',      // row 6 (stop marker)
  ].join('\n')

  it('returns null for a template filename', () => {
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest src/lib/seed/parse-example-csv.test.ts --no-coverage
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the parser**

Create `src/lib/seed/parse-example-csv.ts` with the full implementation described above (use the corrected `extractSalary` function with the fixed loop bounds).

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest src/lib/seed/parse-example-csv.test.ts --no-coverage
```
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```
git add src/lib/seed/parse-example-csv.ts src/lib/seed/parse-example-csv.test.ts
git commit -m "feat: CSV parser for historical example data"
```

---

## Task 2: API route to read and parse example files

**Files:**
- Create: `src/app/api/seed-data/route.ts`

This route:
1. Only works in development mode (returns 403 in production)
2. Reads all CSV files from `examples/2025/` and `examples/2026/`
3. Skips template/summary files using `shouldSkipFile`
4. Parses each file using `parseExampleCsv`
5. Returns the combined parsed data as JSON

```typescript
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { parseExampleCsv, shouldSkipFile, type ParsedMonthData } from '@/lib/seed/parse-example-csv'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  const examplesDir = path.join(process.cwd(), 'examples')
  const years = ['2025', '2026']
  const results: ParsedMonthData[] = []

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
  const totalSalaries = results.filter(r => r.salary !== null).length

  return NextResponse.json({
    months: results.map(r => r.month),
    totalTransactions,
    totalSalaries,
    data: results,
  })
}
```

- [ ] **Step 1: Implement the API route**

Create `src/app/api/seed-data/route.ts` with the content above.

Note: The `examples` directory is at the project root. `process.cwd()` in Next.js API routes returns the project root. The `fs` module works in Next.js API routes since they run on the server.

- [ ] **Step 2: Test the route manually**

Start the dev server and visit `http://localhost:3000/api/seed-data`. You should see a JSON response with the parsed data.

If there are encoding issues with Hebrew characters in the CSV files, change the file reading to:
```typescript
const content = fs.readFileSync(path.join(yearDir, file), { encoding: 'utf8' })
```
If still garbled, try `'utf-8'` (with dash), or read as buffer and decode:
```typescript
const buffer = fs.readFileSync(path.join(yearDir, file))
const content = buffer.toString('utf8')
```

- [ ] **Step 3: Commit**

```
git add src/app/api/seed-data/route.ts
git commit -m "feat: seed-data API route for historical CSV import"
```

---

## Task 3: Admin seed page

**Files:**
- Create: `src/app/(app)/admin/seed/page.tsx`

This page:
1. Shows a "טען נתונים" button
2. Calls GET /api/seed-data and displays a summary
3. Shows a "ייבא הכל" confirmation button
4. On confirm: maps category names to IDs, maps account names to IDs, writes to Firestore

**The import process:**
1. Load categories from Firestore: `getCategories()` → build `{[name]: id}` map
2. Load accounts from Firestore: `getAccounts()` → build `{[name]: id}` map
3. For each parsed month's transactions:
   - Look up `categoryId` from category map using `t.categoryName`
   - Look up `accountId` from account map using `t.accountName`
   - Build `Omit<Transaction, 'id'>` objects
4. Call `addTransactions(allTxs)` in batches of 500 (Firestore batch limit is 500 per write)
5. For each parsed salary: call `upsertSalaryEntry(salary)`

**Full implementation:**

```typescript
'use client'
import { useState } from 'react'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { addTransactions } from '@/lib/firestore/transactions'
import { upsertSalaryEntry } from '@/lib/firestore/salary'
import type { Transaction, SalaryEntry } from '@/lib/types'

interface SeedSummary {
  months: string[]
  totalTransactions: number
  totalSalaries: number
  data: Array<{
    month: string
    transactions: Array<{
      date: string
      merchantName: string
      description: string
      amount: number
      categoryName: string
      accountName: string
      month: string
    }>
    salary: {
      month: string
      grossAmount: number
      incomeTax: number
      nationalInsurance: number
      healthInsurance: number
      pension: number
      trainingFund: number
      netAmount: number
    } | null
  }>
}

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<SeedSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ transactions: number; salaries: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/seed-data')
      if (!res.ok) throw new Error(await res.text())
      setSummary(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function importAll() {
    if (!summary) return
    setImporting(true); setError(null)
    try {
      const [categories, accounts] = await Promise.all([getCategories(), getAccounts()])
      const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))
      const accMap = Object.fromEntries(accounts.map(a => [a.name, a.id]))

      const allTxs: Omit<Transaction, 'id'>[] = []
      const salaryEntries: Omit<SalaryEntry, 'id'>[] = []

      for (const monthData of summary.data) {
        for (const t of monthData.transactions) {
          const accountId = accMap[t.accountName]
          if (!accountId) continue  // skip if account not in DB
          allTxs.push({
            date: t.date,
            merchantName: t.merchantName,
            description: t.description || undefined,
            amount: t.amount,
            currency: 'ILS',
            accountId,
            categoryId: catMap[t.categoryName] ?? undefined,
            source: 'csv_import',
            isImmediate: false,
            month: t.month,
          })
        }
        if (monthData.salary) {
          const s = monthData.salary
          salaryEntries.push({
            month: s.month,
            employerName: 'יד 2',
            grossAmount: s.grossAmount,
            deductions: {
              incomeTax: s.incomeTax,
              nationalInsurance: s.nationalInsurance,
              healthInsurance: s.healthInsurance,
              pension: s.pension,
              trainingFund: s.trainingFund,
            },
            netAmount: s.netAmount,
          })
        }
      }

      // Insert transactions in batches of 400 (safe under 500 limit)
      for (let i = 0; i < allTxs.length; i += 400) {
        await addTransactions(allTxs.slice(i, i + 400))
      }

      // Insert salary entries
      for (const entry of salaryEntries) {
        await upsertSalaryEntry(entry)
      }

      setDone({ transactions: allTxs.length, salaries: salaryEntries.length })
    } catch (e) {
      setError(String(e))
    } finally {
      setImporting(false)
    }
  }

  if (done) {
    return (
      <main className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">ייבוא הושלם</h1>
        <div className="bg-surface rounded-2xl p-4 space-y-2">
          <p className="text-sm">עסקאות שיובאו: <span className="font-bold">{done.transactions}</span></p>
          <p className="text-sm">משכורות שיובאו: <span className="font-bold">{done.salaries}</span></p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-2">ייבוא נתונים היסטוריים</h1>
      <p className="text-slate-400 text-sm mb-6">טוען נתונים מקבצי הדוגמה בתיקיית examples/</p>

      {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}

      {!summary ? (
        <button
          onClick={loadData}
          disabled={loading}
          className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
        >
          {loading ? 'טוען...' : 'טען נתונים'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-surface rounded-2xl p-4 space-y-2">
            <p className="text-sm">חודשים שנמצאו: <span className="font-bold">{summary.months.length}</span></p>
            <p className="text-sm">עסקאות: <span className="font-bold">{summary.totalTransactions}</span></p>
            <p className="text-sm">משכורות: <span className="font-bold">{summary.totalSalaries}</span></p>
            <div className="text-xs text-slate-500 mt-2">
              {summary.months.sort().join(' • ')}
            </div>
          </div>
          <button
            onClick={importAll}
            disabled={importing}
            className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
          >
            {importing ? 'מייבא...' : 'ייבא הכל לדאטה בייס'}
          </button>
        </div>
      )}
    </main>
  )
}
```

Note: The employer name is hardcoded as 'יד 2' because that's the user's employer as seen in the CSV category summary. Adjust if needed.

- [ ] **Step 1: Implement the seed page**

Create `src/app/(app)/admin/seed/page.tsx` with the content above.

No tests needed for this page — it's a one-time utility page with no complex logic (the logic lives in the parser and Firestore functions which are already tested).

- [ ] **Step 2: Run the full test suite**

```
npx jest --no-coverage
```
Expected: All tests pass.

- [ ] **Step 3: Commit**

```
git add src/app/(app)/admin/seed/page.tsx
git commit -m "feat: admin seed page for historical data import"
```

---

## How to use after implementation

1. Make sure the Firestore index for transactions is created (Firebase Console link from the error message)
2. Start the dev server: `npm run dev`
3. Sign in to the app
4. Navigate to `/admin/seed`
5. Click "טען נתונים" to parse the CSV files
6. Review the summary (months found, transaction count)
7. Click "ייבא הכל לדאטה בייס"
8. Done — historical data is now in Firestore
