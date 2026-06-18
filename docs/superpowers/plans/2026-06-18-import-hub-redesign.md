# Import Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear import wizard with an independent-flow hub where each flow (credit card, bank, salary, income, cash) saves immediately and shows status for the current month.

**Architecture:** New `ImportHub` component replaces `ImportWizard` as the entry point. Each flow lives in `src/components/import/flows/` and saves its data directly to Firestore on completion, with no accumulation step. Two new parsers handle One Zero XLS and Leumi PDF bank statement formats. Duplicate detection warns before saving.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, Firebase Firestore, SheetJS (xlsx — already installed), pdfjs-dist (new)

---

## File Map

**Create:**
- `src/lib/parsers/one-zero-xlsx-parser.ts` — parse One Zero bank XLS format
- `src/lib/parsers/leumi-pdf-parser.ts` — parse Leumi bank PDF format
- `src/lib/import/duplicate-detector.ts` — detect same-date/amount/merchant duplicates
- `src/components/import/ImportHub.tsx` — hub with flow buttons + status cards
- `src/components/import/flows/CreditFlow.tsx` — credit import (notes col, direction toggle, immediate save)
- `src/components/import/flows/BankFlow.tsx` — bank import (One Zero XLS or Leumi PDF)
- `src/components/import/flows/SalaryFlow.tsx` — multi-salary entry, show/edit existing
- `src/components/import/flows/IncomeFlow.tsx` — income transactions, show/add/delete existing
- `src/components/import/flows/CashFlow.tsx` — cash transactions, show/add/delete existing

**Modify:**
- `src/lib/types/index.ts` — add `direction` to `RawTransaction`/`ImportedTransaction`, add `'pdf_import'` to `TransactionSource`
- `src/lib/firestore/salary.ts` — add `getSalaryEntries(month)`, `deleteSalaryEntry(id)`
- `src/app/(app)/import/page.tsx` — replace `<ImportWizard />` with `<ImportHub />`

**Delete (Task 12):**
- `src/components/import/ImportWizard.tsx` + test
- `src/components/import/steps/CreditImportStep.tsx` + test
- `src/components/import/steps/SalaryStep.tsx` + test
- `src/components/import/steps/IncomeStep.tsx` + test
- `src/components/import/steps/CashStep.tsx` + test
- `src/components/import/steps/SummaryStep.tsx` + test

---

### Task 1: Type System Updates

**Files:**
- Modify: `src/lib/types/index.ts`
- Test: `src/lib/parsers/one-zero-xlsx-parser.test.ts` (written in Task 3 — just compile-check here)

- [ ] **Step 1: Update types**

In `src/lib/types/index.ts`, make these three changes:

```typescript
// Change TransactionSource (line 45):
export type TransactionSource = 'csv_import' | 'xlsx_import' | 'pdf_import' | 'manual'

// Add direction to RawTransaction (after notes field, ~line 160):
export interface RawTransaction {
  date: string
  merchantName: string
  bankCategory: string
  amount: number
  currency: string
  isImmediate: boolean
  notes: string
  direction?: 'income' | 'expense'  // add this line
}

// Add direction to ImportedTransaction (after categorizationSource, ~line 164):
export interface ImportedTransaction extends RawTransaction {
  categoryId: string | null
  categorizationSource: 'rule' | 'history' | 'manual' | null
  direction: 'income' | 'expense'  // required here (override optional from RawTransaction)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (the new `direction` field is additive)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: add direction field to RawTransaction/ImportedTransaction, add pdf_import source"
```

---

### Task 2: Salary Firestore — getSalaryEntries + deleteSalaryEntry

**Files:**
- Modify: `src/lib/firestore/salary.ts`
- Test: `src/lib/firestore/salary.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/lib/firestore/salary.test.ts`:

```typescript
import { getSalaryEntries, deleteSalaryEntry } from './salary'

jest.mock('@/lib/firebase/config', () => ({ app: {} }))
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
}))

import { getDocs, deleteDoc } from 'firebase/firestore'

describe('getSalaryEntries', () => {
  it('returns array of salary entries for a month', async () => {
    const mockEntry = { id: 'e1', month: '2026-06', employerName: 'Acme', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 200, pension: 1000, trainingFund: 500 }, netAmount: 10800 }
    ;(getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [{ id: 'e1', data: () => ({ ...mockEntry, id: undefined }) }],
    })
    const result = await getSalaryEntries('2026-06')
    expect(result).toHaveLength(1)
    expect(result[0].netAmount).toBe(10800)
  })

  it('returns empty array when no entries', async () => {
    ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] })
    const result = await getSalaryEntries('2026-06')
    expect(result).toEqual([])
  })
})

describe('deleteSalaryEntry', () => {
  it('calls deleteDoc', async () => {
    ;(deleteDoc as jest.Mock).mockResolvedValueOnce(undefined)
    await deleteSalaryEntry('entry-id-1')
    expect(deleteDoc).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/firestore/salary.test.ts --no-coverage`
Expected: FAIL — `getSalaryEntries is not a function`

- [ ] **Step 3: Add getSalaryEntries and deleteSalaryEntry to salary.ts**

In `src/lib/firestore/salary.ts`, add these two functions after `upsertSalaryEntry`:

```typescript
export async function getSalaryEntries(month: string): Promise<SalaryEntry[]> {
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryEntry))
}

export async function deleteSalaryEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'salary_entries', id))
  appCache.delPrefix('salary:')
}
```

Also add `deleteDoc` to the import at the top of `salary.ts` (it already imports from `firebase/firestore`):
```typescript
import { getFirestore, collection, getDocs, setDoc, doc, query, where, writeBatch, deleteDoc } from 'firebase/firestore'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/firestore/salary.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/salary.ts src/lib/firestore/salary.test.ts
git commit -m "feat: add getSalaryEntries and deleteSalaryEntry to salary firestore module"
```

---

### Task 3: One Zero XLS Parser

**Files:**
- Create: `src/lib/parsers/one-zero-xlsx-parser.ts`
- Create: `src/lib/parsers/one-zero-xlsx-parser.test.ts`

Format: column A = date (DD/MM/YYYY), col D = merchant name, col E = amount (negative=debit), col F = currency, col G = חיוב/זיכוי

- [ ] **Step 1: Write the failing test**

Create `src/lib/parsers/one-zero-xlsx-parser.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/parsers/one-zero-xlsx-parser.test.ts --no-coverage`
Expected: FAIL — `Cannot find module './one-zero-xlsx-parser'`

- [ ] **Step 3: Implement the parser**

Create `src/lib/parsers/one-zero-xlsx-parser.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/parsers/one-zero-xlsx-parser.test.ts --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/one-zero-xlsx-parser.ts src/lib/parsers/one-zero-xlsx-parser.test.ts
git commit -m "feat: add One Zero XLS bank statement parser"
```

---

### Task 4: Leumi PDF Parser

**Files:**
- Create: `src/lib/parsers/leumi-pdf-parser.ts`
- Create: `src/lib/parsers/leumi-pdf-parser.test.ts`

- [ ] **Step 1: Install pdfjs-dist**

Run: `npm install pdfjs-dist`
Expected: package installed, `pdfjs-dist` appears in `package.json` dependencies

- [ ] **Step 2: Write the failing test**

Create `src/lib/parsers/leumi-pdf-parser.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/lib/parsers/leumi-pdf-parser.test.ts --no-coverage`
Expected: FAIL — `Cannot find module`

- [ ] **Step 4: Implement the parser**

Create `src/lib/parsers/leumi-pdf-parser.ts`:

```typescript
import type { RawTransaction } from '../types'

export interface PdfTextItem {
  str: string
  x: number
  y: number
}

function parseLeumiDate(dateStr: string): string {
  const [d, m, y] = dateStr.split('.')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, '').trim()) || 0
}

function groupByY(items: PdfTextItem[]): PdfTextItem[][] {
  const rows: PdfTextItem[][] = []
  for (const item of items) {
    const existing = rows.find(row => Math.abs(row[0].y - item.y) <= 3)
    if (existing) {
      existing.push(item)
    } else {
      rows.push([item])
    }
  }
  return rows.sort((a, b) => b[0].y - a[0].y)
}

// Exported separately so it can be unit-tested without a real PDF
export function parseLeumiRows(items: PdfTextItem[]): RawTransaction[] {
  const rows = groupByY(items)

  // Find header row to calibrate column X positions
  const headerRow = rows.find(row =>
    row.some(item => item.str === 'זכות') && row.some(item => item.str === 'חובה')
  )
  if (!headerRow) return []

  const getColX = (label: string) => headerRow.find(i => i.str === label)?.x ?? -1
  const creditX = getColX('זכות')
  const debitX = getColX('חובה')
  const typeX = getColX('סוג תנועה')
  const dateX = getColX('תאריך')

  const COL_TOL = 25

  const getVal = (row: PdfTextItem[], refX: number) =>
    row.find(item => Math.abs(item.x - refX) <= COL_TOL)?.str ?? ''

  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/
  const result: RawTransaction[] = []

  for (const row of rows) {
    if (row === headerRow) continue
    const dateStr = getVal(row, dateX)
    if (!dateRegex.test(dateStr)) continue

    const merchantName = getVal(row, typeX)
    if (!merchantName) continue

    const creditStr = getVal(row, creditX)
    const debitStr = getVal(row, debitX)

    const creditAmount = parseAmount(creditStr)
    const debitAmount = parseAmount(debitStr)

    const isCredit = creditAmount > 0 && debitAmount === 0
    const amount = isCredit ? creditAmount : debitAmount
    if (amount === 0) continue

    result.push({
      date: parseLeumiDate(dateStr),
      merchantName,
      bankCategory: '',
      amount,
      currency: 'ILS',
      isImmediate: false,
      notes: '',
      direction: isCredit ? 'income' : 'expense',
    })
  }
  return result
}

// Called from browser component — loads pdfjs dynamically
export async function parseLeumiPdf(data: Uint8Array): Promise<RawTransaction[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: data.slice(0) }).promise
  const items: PdfTextItem[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        items.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] })
      }
    }
  }
  return parseLeumiRows(items)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/parsers/leumi-pdf-parser.test.ts --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/parsers/leumi-pdf-parser.ts src/lib/parsers/leumi-pdf-parser.test.ts package.json package-lock.json
git commit -m "feat: add Leumi PDF bank statement parser with pdfjs-dist"
```

---

### Task 5: Duplicate Detection Utility

**Files:**
- Create: `src/lib/import/duplicate-detector.ts`
- Create: `src/lib/import/duplicate-detector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/import/duplicate-detector.test.ts`:

```typescript
import { detectDuplicates } from './duplicate-detector'
import type { ImportedTransaction, Transaction } from '@/lib/types'

function makeImported(overrides: Partial<ImportedTransaction> = {}): ImportedTransaction {
  return {
    date: '2026-06-05',
    merchantName: 'SuperMarket',
    bankCategory: '',
    amount: 100,
    currency: 'ILS',
    isImmediate: false,
    notes: '',
    direction: 'expense',
    categoryId: null,
    categorizationSource: null,
    ...overrides,
  }
}

function makeExisting(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-06-05',
    merchantName: 'SuperMarket',
    amount: 100,
    currency: 'ILS',
    accountId: 'acc-1',
    source: 'xlsx_import',
    isImmediate: false,
    month: '2026-06',
    ...overrides,
  }
}

describe('detectDuplicates', () => {
  it('flags matching date + amount + merchantName as duplicate', () => {
    const incoming = [makeImported()]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(duplicates).toHaveLength(1)
    expect(clean).toHaveLength(0)
  })

  it('allows different date', () => {
    const incoming = [makeImported({ date: '2026-06-10' })]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(duplicates).toHaveLength(0)
    expect(clean).toHaveLength(1)
  })

  it('allows different amount', () => {
    const incoming = [makeImported({ amount: 200 })]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(clean).toHaveLength(1)
  })

  it('allows different merchantName', () => {
    const incoming = [makeImported({ merchantName: 'OtherStore' })]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(clean).toHaveLength(1)
  })

  it('handles mix of duplicates and clean', () => {
    const incoming = [
      makeImported({ merchantName: 'Dup', date: '2026-06-01', amount: 50 }),
      makeImported({ merchantName: 'New', date: '2026-06-02', amount: 75 }),
    ]
    const existing = [makeExisting({ merchantName: 'Dup', date: '2026-06-01', amount: 50 })]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(duplicates).toHaveLength(1)
    expect(clean).toHaveLength(1)
    expect(clean[0].merchantName).toBe('New')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/import/duplicate-detector.test.ts --no-coverage`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement**

Create `src/lib/import/duplicate-detector.ts`:

```typescript
import type { ImportedTransaction, Transaction } from '../types'

export interface DuplicateMatch {
  incoming: ImportedTransaction
  existing: Transaction
}

export interface DuplicateCheckResult {
  duplicates: DuplicateMatch[]
  clean: ImportedTransaction[]
}

export function detectDuplicates(
  incoming: ImportedTransaction[],
  existing: Transaction[],
): DuplicateCheckResult {
  const duplicates: DuplicateMatch[] = []
  const clean: ImportedTransaction[] = []

  for (const tx of incoming) {
    const match = existing.find(
      e =>
        e.date === tx.date &&
        Math.abs(e.amount) === tx.amount &&
        e.merchantName === tx.merchantName
    )
    if (match) {
      duplicates.push({ incoming: tx, existing: match })
    } else {
      clean.push(tx)
    }
  }
  return { duplicates, clean }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/import/duplicate-detector.test.ts --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/duplicate-detector.ts src/lib/import/duplicate-detector.test.ts
git commit -m "feat: add duplicate transaction detection utility"
```

---

### Task 6: CreditFlow Component

Refactored CreditImportStep: adds notes column, direction toggle per row, auto-marks negative amounts as income, saves immediately.

**Files:**
- Create: `src/components/import/flows/CreditFlow.tsx`
- Create: `src/components/import/flows/CreditFlow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/flows/CreditFlow.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreditFlow } from './CreditFlow'
import type { Category, CategorizationRule, Transaction } from '@/lib/types'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const categories: Category[] = [
  { id: 'cat1', name: 'מזון', color: '#f00', isActive: true },
]
const rules: CategorizationRule[] = []
const previousTxs: Transaction[] = []

describe('CreditFlow', () => {
  it('renders upload area and skip button', () => {
    render(
      <CreditFlow
        month="2026-06"
        accountId="acc1"
        accountName="כרטיס ויזה"
        categories={categories}
        rules={rules}
        previousTransactions={previousTxs}
        existingTransactions={[]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/כרטיס ויזה/)).toBeInTheDocument()
    expect(screen.getByText('דלג')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/flows/CreditFlow.test.tsx --no-coverage`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement CreditFlow**

Create `src/components/import/flows/CreditFlow.tsx`:

```typescript
'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Tag } from 'lucide-react'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { getSheetNames, parseSheet } from '@/lib/parsers/xlsx-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Category, CategorizationRule, ImportedTransaction, Transaction, TransactionSource } from '@/lib/types'

interface Props {
  month: string
  accountId: string
  accountName: string
  categories: Category[]
  rules: CategorizationRule[]
  previousTransactions: Transaction[]
  existingTransactions: Transaction[]
  onDone: () => void
  onBack: () => void
}

function toTransaction(t: ImportedTransaction, accountId: string, month: string): Omit<Transaction, 'id'> {
  return {
    date: t.date,
    merchantName: t.merchantName,
    description: t.notes || undefined,
    amount: t.amount,
    currency: t.currency,
    accountId,
    categoryId: t.direction === 'income' ? undefined : (t.categoryId ?? undefined),
    source: 'xlsx_import' as TransactionSource,
    isImmediate: t.isImmediate,
    month,
    direction: t.direction,
  }
}

export function CreditFlow({ month, accountId, accountName, categories, rules, previousTransactions, existingTransactions, onDone, onBack }: Props) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [xlsxData, setXlsxData] = useState<Uint8Array | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyCategories(raw: ReturnType<typeof mapRows>): ImportedTransaction[] {
    return raw.map(r => {
      const result = categorize(r.merchantName, rules, previousTransactions)
      const direction = (r.direction ?? (r.amount < 0 ? 'income' : 'expense')) as 'income' | 'expense'
      return {
        ...r,
        amount: Math.abs(r.amount),
        direction,
        categoryId: direction === 'income' ? null : result.categoryId,
        categorizationSource: direction === 'income' ? null : result.source,
      }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const mapped = applyCategories(mapRows(parseCSV(text)))
        const { duplicates, clean } = detectDuplicates(mapped, existingTransactions)
        setTransactions(mapped)
        setDuplicateWarning(duplicates.length)
        setXlsxData(null); setAvailableSheets([])
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buf = await file.arrayBuffer()
        const data = new Uint8Array(buf)
        const sheets = getSheetNames(data)
        setXlsxData(data); setAvailableSheets(sheets)
        setSelectedSheets(sheets.length > 0 ? [sheets[0]] : [])
        setTransactions([])
      } else {
        setError('פורמט לא נתמך. השתמש בקובץ CSV או XLSX.')
      }
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    }
  }

  function loadSheets() {
    if (!xlsxData || selectedSheets.length === 0) return
    const rows = selectedSheets.flatMap(s => parseSheet(xlsxData, s))
    const mapped = applyCategories(mapRows(rows))
    const { duplicates } = detectDuplicates(mapped, existingTransactions)
    setTransactions(mapped)
    setDuplicateWarning(duplicates.length)
  }

  function updateField(index: number, updates: Partial<ImportedTransaction>) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const { clean, duplicates } = detectDuplicates(transactions, existingTransactions)
      const toSave = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? transactions : clean)
        : transactions
      await addTransactions(toSave.map(t => toTransaction(t, accountId, month)))
      setSaved(true)
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">נשמר!</h2>
        <p className="text-slate-400 text-sm mb-6">{transactions.length} עסקאות יובאו</p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לרשימה</button>
      </div>
    )
  }

  const uncategorized = transactions.filter(t => !t.categoryId && t.direction !== 'income').length

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">{accountName}</h2>
      </div>

      <div
        className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-slate-400 text-sm">העלאת קובץ CSV או XLSX</p>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {duplicateWarning > 0 && (
        <p className="text-amber-400 text-xs mb-2">⚠️ {duplicateWarning} עסקאות עלולות להיות כפולות</p>
      )}

      {availableSheets.length > 0 && (
        <div className="bg-surface rounded-xl p-4 mb-4">
          <p className="text-sm font-medium mb-2">בחר גליונות לייבוא:</p>
          {availableSheets.map(sheet => (
            <label key={sheet} className="flex items-center gap-2 mb-1 cursor-pointer text-sm">
              <input type="checkbox" checked={selectedSheets.includes(sheet)}
                onChange={e => setSelectedSheets(p => e.target.checked ? [...p, sheet] : p.filter(s => s !== sheet))} />
              {sheet}
            </label>
          ))}
          <button onClick={loadSheets} className="mt-2 w-full py-2 bg-accent rounded-lg text-sm font-medium">טען גליונות</button>
        </div>
      )}

      {transactions.length > 0 && (
        <>
          {uncategorized > 0 && (
            <p className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <Tag size={12} />{uncategorized} עסקאות ממתינות לקיטלוג
            </p>
          )}
          <div className="overflow-x-auto rounded-xl mb-4">
            <table className="w-full text-sm" aria-label="עסקאות לייבוא">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">בית עסק</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className={`border-b border-slate-700/40 ${!tx.categoryId && tx.direction !== 'income' ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{tx.date}</td>
                    <td className="py-1.5 px-2 text-xs">{tx.merchantName}</td>
                    <td className="py-1.5 px-2">
                      <input
                        value={tx.notes ?? ''}
                        onChange={e => updateField(i, { notes: e.target.value })}
                        placeholder="תיאור"
                        className="w-full bg-background text-xs rounded px-1 py-0.5 min-w-16"
                        aria-label={`תיאור עבור ${tx.merchantName}`}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-left tabular-nums text-xs">{tx.amount.toFixed(2)} {tx.currency}</td>
                    <td className="py-1.5 px-2">
                      <select
                        value={tx.direction}
                        onChange={e => updateField(i, { direction: e.target.value as 'income' | 'expense', categoryId: e.target.value === 'income' ? null : tx.categoryId })}
                        className="bg-background text-xs rounded px-1 py-0.5"
                        aria-label={`כיוון עבור ${tx.merchantName}`}
                      >
                        <option value="expense">הוצאה</option>
                        <option value="income">הכנסה</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      {tx.direction === 'expense' ? (
                        <select
                          value={tx.categoryId ?? ''}
                          onChange={e => updateField(i, { categoryId: e.target.value || null, categorizationSource: 'manual' })}
                          className="bg-background text-foreground text-xs rounded px-1 py-0.5 w-full"
                          aria-label={`קטגוריה עבור ${tx.merchantName}`}
                        >
                          <option value="">— ללא —</option>
                          {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-green-400">הכנסה</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3"
          >
            {saving ? 'שומר...' : `שמור ${transactions.length} עסקאות`}
          </button>
        </>
      )}

      <button onClick={onBack} className="w-full py-2 text-slate-400 text-sm">← חזור</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/import/flows/CreditFlow.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/import/flows/CreditFlow.tsx src/components/import/flows/CreditFlow.test.tsx
git commit -m "feat: add CreditFlow with notes column, direction toggle, and immediate save"
```

---

### Task 7: BankFlow Component

Upload XLS (One Zero) or PDF (Leumi), parse, review in same table as CreditFlow, save.

**Files:**
- Create: `src/components/import/flows/BankFlow.tsx`
- Create: `src/components/import/flows/BankFlow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/flows/BankFlow.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { BankFlow } from './BankFlow'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

describe('BankFlow', () => {
  it('renders account name and upload area', () => {
    render(
      <BankFlow
        month="2026-06"
        accountId="bank1"
        accountName="One Zero"
        bankType="one-zero"
        categories={[]}
        existingTransactions={[]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/One Zero/)).toBeInTheDocument()
    expect(screen.getByText(/XLS/)).toBeInTheDocument()
  })

  it('renders Leumi PDF upload label for leumi bankType', () => {
    render(
      <BankFlow
        month="2026-06"
        accountId="bank2"
        accountName="לאומי"
        bankType="leumi"
        categories={[]}
        existingTransactions={[]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/PDF/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/flows/BankFlow.test.tsx --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement BankFlow**

Create `src/components/import/flows/BankFlow.tsx`:

```typescript
'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Tag } from 'lucide-react'
import { parseOneZeroXlsx } from '@/lib/parsers/one-zero-xlsx-parser'
import { parseLeumiPdf } from '@/lib/parsers/leumi-pdf-parser'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Category, CategorizationRule, ImportedTransaction, Transaction, TransactionSource } from '@/lib/types'

export type BankType = 'one-zero' | 'leumi' | 'generic'

interface Props {
  month: string
  accountId: string
  accountName: string
  bankType: BankType
  categories: Category[]
  rules?: CategorizationRule[]
  previousTransactions?: Transaction[]
  existingTransactions: Transaction[]
  onDone: () => void
  onBack: () => void
}

function toTransaction(t: ImportedTransaction, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  return {
    date: t.date,
    merchantName: t.merchantName,
    description: t.notes || undefined,
    amount: t.amount,
    currency: t.currency,
    accountId,
    categoryId: t.direction === 'income' ? undefined : (t.categoryId ?? undefined),
    source,
    isImmediate: t.isImmediate,
    month,
    direction: t.direction,
  }
}

const ACCEPT: Record<BankType, string> = {
  'one-zero': '.xls,.xlsx',
  'leumi': '.pdf',
  'generic': '.xls,.xlsx,.pdf',
}

const ACCEPT_LABEL: Record<BankType, string> = {
  'one-zero': 'XLS מ-One Zero',
  'leumi': 'PDF מ-לאומי',
  'generic': 'XLS / PDF',
}

export function BankFlow({ month, accountId, accountName, bankType, categories, rules = [], previousTransactions = [], existingTransactions, onDone, onBack }: Props) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyCategories(raw: { merchantName: string; direction?: 'income' | 'expense'; amount: number; [k: string]: unknown }[]): ImportedTransaction[] {
    return raw.map(r => {
      const res = categorize(r.merchantName, rules, previousTransactions)
      const direction = (r.direction ?? 'expense') as 'income' | 'expense'
      return {
        ...r,
        direction,
        categoryId: direction === 'income' ? null : res.categoryId,
        categorizationSource: direction === 'income' ? null : res.source,
      } as ImportedTransaction
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const data = new Uint8Array(buf)
      let raw: ReturnType<typeof applyCategories> extends Promise<infer T> ? never : ReturnType<typeof applyCategories>[number][] = []

      if (file.name.endsWith('.pdf')) {
        const parsed = await parseLeumiPdf(data)
        raw = applyCategories(parsed)
      } else {
        const parsed = parseOneZeroXlsx(data)
        raw = applyCategories(parsed)
      }

      const { duplicates } = detectDuplicates(raw, existingTransactions)
      setTransactions(raw)
      setDuplicateWarning(duplicates.length)
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    } finally {
      setParsing(false)
    }
  }

  function updateField(index: number, updates: Partial<ImportedTransaction>) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const { clean, duplicates } = detectDuplicates(transactions, existingTransactions)
      const source: TransactionSource = bankType === 'leumi' ? 'pdf_import' : 'xlsx_import'
      const toSave = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? transactions : clean)
        : transactions
      await addTransactions(toSave.map(t => toTransaction(t, accountId, month, source)))
      setSaved(true)
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">נשמר!</h2>
        <p className="text-slate-400 text-sm mb-6">{transactions.length} עסקאות יובאו</p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לרשימה</button>
      </div>
    )
  }

  const uncategorized = transactions.filter(t => !t.categoryId && t.direction !== 'income').length

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">{accountName}</h2>
      </div>

      <div
        className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-slate-400 text-sm">העלאת קובץ {ACCEPT_LABEL[bankType]}</p>
        <input ref={fileInputRef} type="file" accept={ACCEPT[bankType]} className="hidden" onChange={handleFileChange} />
      </div>

      {parsing && <p className="text-slate-400 text-sm text-center mb-3">מנתח קובץ...</p>}
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {duplicateWarning > 0 && (
        <p className="text-amber-400 text-xs mb-2">⚠️ {duplicateWarning} עסקאות עלולות להיות כפולות</p>
      )}

      {transactions.length > 0 && (
        <>
          {uncategorized > 0 && (
            <p className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <Tag size={12} />{uncategorized} עסקאות ממתינות לקיטלוג
            </p>
          )}
          <div className="overflow-x-auto rounded-xl mb-4">
            <table className="w-full text-sm" aria-label="עסקאות בנק לייבוא">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-right py-2 px-2">הערה</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className={`border-b border-slate-700/40 ${!tx.categoryId && tx.direction !== 'income' ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{tx.date}</td>
                    <td className="py-1.5 px-2 text-xs">{tx.merchantName}</td>
                    <td className="py-1.5 px-2">
                      <input
                        value={tx.notes ?? ''}
                        onChange={e => updateField(i, { notes: e.target.value })}
                        placeholder="הערה"
                        className="w-full bg-background text-xs rounded px-1 py-0.5 min-w-16"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-left tabular-nums text-xs">{tx.amount.toFixed(2)} {tx.currency}</td>
                    <td className="py-1.5 px-2">
                      <select
                        value={tx.direction}
                        onChange={e => updateField(i, { direction: e.target.value as 'income' | 'expense', categoryId: e.target.value === 'income' ? null : tx.categoryId })}
                        className="bg-background text-xs rounded px-1 py-0.5"
                      >
                        <option value="expense">הוצאה</option>
                        <option value="income">הכנסה</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      {tx.direction === 'expense' ? (
                        <select
                          value={tx.categoryId ?? ''}
                          onChange={e => updateField(i, { categoryId: e.target.value || null, categorizationSource: 'manual' })}
                          className="bg-background text-foreground text-xs rounded px-1 py-0.5 w-full"
                        >
                          <option value="">— ללא —</option>
                          {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-green-400">הכנסה</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
            {saving ? 'שומר...' : `שמור ${transactions.length} עסקאות`}
          </button>
        </>
      )}

      <button onClick={onBack} className="w-full py-2 text-slate-400 text-sm">← חזור</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/import/flows/BankFlow.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/import/flows/BankFlow.tsx src/components/import/flows/BankFlow.test.tsx
git commit -m "feat: add BankFlow component for One Zero XLS and Leumi PDF import"
```

---

### Task 8: SalaryFlow Component

Shows existing salary entries for the month. Allows adding a new one or editing existing. Saves each entry individually on confirm.

**Files:**
- Create: `src/components/import/flows/SalaryFlow.tsx`
- Create: `src/components/import/flows/SalaryFlow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/flows/SalaryFlow.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { SalaryFlow } from './SalaryFlow'
import type { Account, SalaryEntry } from '@/lib/types'

jest.mock('@/lib/firestore/salary', () => ({
  upsertSalaryEntry: jest.fn().mockResolvedValue(undefined),
  deleteSalaryEntry: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  updateTransaction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const bankAccounts: Account[] = [
  { id: 'bank1', name: 'לאומי', type: 'bank', color: '#00f', isActive: true },
]

describe('SalaryFlow', () => {
  it('shows empty state when no existing entries', () => {
    render(
      <SalaryFlow
        month="2026-06"
        existingEntries={[]}
        bankAccounts={bankAccounts}
        previousSalary={null}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/אין משכורות/i)).toBeInTheDocument()
    expect(screen.getByText(/הוסף משכורת/i)).toBeInTheDocument()
  })

  it('shows existing salary entry', () => {
    const entry: SalaryEntry = {
      id: 'sal1', month: '2026-06', employerName: 'Acme Corp',
      grossAmount: 15000,
      deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 200, pension: 1000, trainingFund: 500 },
      netAmount: 10800,
    }
    render(
      <SalaryFlow
        month="2026-06"
        existingEntries={[entry]}
        bankAccounts={bankAccounts}
        previousSalary={null}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText(/10,800/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/flows/SalaryFlow.test.tsx --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement SalaryFlow**

Create `src/components/import/flows/SalaryFlow.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { upsertSalaryEntry, deleteSalaryEntry } from '@/lib/firestore/salary'
import { addTransactions, updateTransaction } from '@/lib/firestore/transactions'
import type { SalaryEntry, SalaryDeductions, Account, Transaction } from '@/lib/types'

const EMPTY_DEDUCTIONS: SalaryDeductions = { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }
const DEDUCTION_LABELS: [keyof SalaryDeductions, string][] = [
  ['incomeTax', 'מס הכנסה'], ['nationalInsurance', 'ביטוח לאומי'],
  ['healthInsurance', 'ביטוח בריאות'], ['pension', 'פנסיה'], ['trainingFund', 'קרן השתלמות'],
]

interface Props {
  month: string
  existingEntries: SalaryEntry[]
  bankAccounts: Account[]
  previousSalary: Omit<SalaryEntry, 'id'> | null
  onDone: () => void
  onBack: () => void
}

interface SalaryFormState {
  entryId?: string
  employerName: string
  grossAmount: number
  deductions: SalaryDeductions
  bankAccountId: string
  salaryTxId?: string
}

function entryToForm(entry: SalaryEntry, defaultBankId: string): SalaryFormState {
  return {
    entryId: entry.id,
    employerName: entry.employerName,
    grossAmount: entry.grossAmount,
    deductions: entry.deductions,
    bankAccountId: defaultBankId,
  }
}

function emptyForm(defaultBankId: string, prev: Omit<SalaryEntry, 'id'> | null): SalaryFormState {
  return {
    employerName: prev?.employerName ?? '',
    grossAmount: prev?.grossAmount ?? 0,
    deductions: prev?.deductions ?? EMPTY_DEDUCTIONS,
    bankAccountId: defaultBankId,
  }
}

function SalaryForm({ form, bankAccounts, month, onChange, onSave, onCancel, saving }: {
  form: SalaryFormState
  bankAccounts: Account[]
  month: string
  onChange: (updates: Partial<SalaryFormState>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const totalDeductions = Object.values(form.deductions).reduce((s, v) => s + v, 0)
  const netAmount = Math.max(0, form.grossAmount - totalDeductions)

  return (
    <div className="bg-surface rounded-xl p-4 space-y-3">
      <input
        type="text"
        placeholder="שם מעסיק"
        value={form.employerName}
        onChange={e => onChange({ employerName: e.target.value })}
        className="w-full bg-background rounded-lg px-3 py-2 text-sm"
        aria-label="שם מעסיק"
      />
      <div>
        <label className="block text-xs text-slate-400 mb-1">ברוטו</label>
        <input
          type="number"
          value={form.grossAmount || ''}
          onChange={e => onChange({ grossAmount: parseFloat(e.target.value) || 0 })}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm tabular-nums"
          aria-label="ברוטו"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">ניכויים</p>
        {DEDUCTION_LABELS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="flex-1 text-xs">{label}</span>
            <input
              type="number"
              value={form.deductions[key] || ''}
              onChange={e => onChange({ deductions: { ...form.deductions, [key]: parseFloat(e.target.value) || 0 } })}
              className="w-24 bg-background rounded px-2 py-1 text-xs tabular-nums text-left"
              aria-label={label}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center bg-accent/10 rounded-xl px-3 py-2">
        <span className="text-xs font-semibold">נטו</span>
        <span className="font-bold tabular-nums text-sm" dir="ltr">₪{netAmount.toLocaleString('he-IL')}</span>
      </div>
      {bankAccounts.length > 0 && (
        <select
          value={form.bankAccountId}
          onChange={e => onChange({ bankAccountId: e.target.value })}
          className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2"
          aria-label="חשבון בנק"
        >
          {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button onClick={onSave} disabled={saving || !form.grossAmount}
          className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

export function SalaryFlow({ month, existingEntries, bankAccounts, previousSalary, onDone, onBack }: Props) {
  const defaultBankId = bankAccounts[0]?.id ?? ''
  const [entries, setEntries] = useState<SalaryEntry[]>(existingEntries)
  const [form, setForm] = useState<SalaryFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!form || !form.grossAmount) return
    setSaving(true); setError(null)
    try {
      const totalDed = Object.values(form.deductions).reduce((s, v) => s + v, 0)
      const netAmount = Math.max(0, form.grossAmount - totalDed)
      const entryData: Omit<SalaryEntry, 'id'> = {
        month,
        employerName: form.employerName,
        grossAmount: form.grossAmount,
        deductions: form.deductions,
        netAmount,
      }
      await upsertSalaryEntry(form.entryId ? { ...entryData, id: form.entryId } : entryData)
      // Save/update salary transaction
      const txData = {
        date: `${month}-01`,
        merchantName: form.employerName || 'משכורת',
        amount: netAmount,
        currency: 'ILS',
        accountId: form.bankAccountId || defaultBankId,
        source: 'manual' as const,
        isImmediate: true,
        month,
        direction: 'income' as const,
        salaryDetails: { grossAmount: form.grossAmount, deductions: form.deductions, netAmount, employerName: form.employerName },
      }
      if (form.salaryTxId) {
        await updateTransaction(form.salaryTxId, txData)
      } else {
        await addTransactions([txData])
      }
      // Refresh entries list
      const updated: SalaryEntry = { id: form.entryId ?? `tmp-${Date.now()}`, ...entryData }
      setEntries(prev => form.entryId ? prev.map(e => e.id === form.entryId ? updated : e) : [...prev, updated])
      setForm(null)
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('למחוק משכורת זו?')) return
    setSaving(true)
    try {
      await deleteSalaryEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">משכורות — {month}</h2>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-3 mb-4">
        {entries.length === 0 && !form && (
          <p className="text-slate-400 text-sm text-center py-4">אין משכורות לחודש זה</p>
        )}
        {entries.map(entry => {
          const isEditing = form?.entryId === entry.id
          if (isEditing && form) {
            return (
              <SalaryForm key={entry.id} form={form} bankAccounts={bankAccounts} month={month}
                onChange={u => setForm(prev => prev ? { ...prev, ...u } : prev)}
                onSave={handleSave} onCancel={() => setForm(null)} saving={saving} />
            )
          }
          return (
            <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{entry.employerName || 'משכורת'}</div>
                <div className="text-xs text-slate-400">נטו: <span className="tabular-nums text-foreground">₪{entry.netAmount.toLocaleString('he-IL')}</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(entryToForm(entry, defaultBankId))}
                  className="text-xs text-accent hover:underline">ערוך</button>
                <button onClick={() => handleDelete(entry.id)}
                  className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
        {form && !form.entryId && (
          <SalaryForm form={form} bankAccounts={bankAccounts} month={month}
            onChange={u => setForm(prev => prev ? { ...prev, ...u } : prev)}
            onSave={handleSave} onCancel={() => setForm(null)} saving={saving} />
        )}
      </div>

      {!form && (
        <button
          onClick={() => setForm(emptyForm(defaultBankId, previousSalary))}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4"
        >
          <Plus size={16} />הוסף משכורת
        </button>
      )}

      <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/import/flows/SalaryFlow.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/import/flows/SalaryFlow.tsx src/components/import/flows/SalaryFlow.test.tsx
git commit -m "feat: add SalaryFlow with multi-entry support and existing entry display"
```

---

### Task 9: IncomeFlow Component

Shows existing income transactions (direction='income', no salaryDetails) for the month. Allows adding new income transactions manually. Saves immediately.

**Files:**
- Create: `src/components/import/flows/IncomeFlow.tsx`
- Create: `src/components/import/flows/IncomeFlow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/flows/IncomeFlow.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IncomeFlow } from './IncomeFlow'
import type { Account, Transaction } from '@/lib/types'
import { addTransactions, deleteTransaction } from '@/lib/firestore/transactions'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const bankAccounts: Account[] = [
  { id: 'bank1', name: 'לאומי', type: 'bank', color: '#00f', isActive: true },
]

const existingIncomeTx: Transaction = {
  id: 'tx1', date: '2026-06-10', merchantName: 'בונוס שנתי',
  amount: 3000, currency: 'ILS', accountId: 'bank1',
  source: 'manual', isImmediate: true, month: '2026-06', direction: 'income',
}

describe('IncomeFlow', () => {
  it('shows existing income entry', () => {
    render(
      <IncomeFlow
        month="2026-06"
        existingTransactions={[existingIncomeTx]}
        bankAccounts={bankAccounts}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText('בונוס שנתי')).toBeInTheDocument()
    expect(screen.getByText(/3,000/)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(
      <IncomeFlow
        month="2026-06"
        existingTransactions={[]}
        bankAccounts={bankAccounts}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/אין הכנסות/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/flows/IncomeFlow.test.tsx --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement IncomeFlow**

Create `src/components/import/flows/IncomeFlow.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { addTransactions, deleteTransaction } from '@/lib/firestore/transactions'
import type { Account, Transaction } from '@/lib/types'

interface IncomeFormRow {
  sourceName: string
  amount: number
  date: string
  bankAccountId: string
}

function emptyRow(month: string, defaultBankId: string): IncomeFormRow {
  return { sourceName: '', amount: 0, date: `${month}-01`, bankAccountId: defaultBankId }
}

interface Props {
  month: string
  existingTransactions: Transaction[]
  bankAccounts: Account[]
  onDone: () => void
  onBack: () => void
}

export function IncomeFlow({ month, existingTransactions, bankAccounts, onDone, onBack }: Props) {
  const defaultBankId = bankAccounts[0]?.id ?? ''
  const [entries, setEntries] = useState<Transaction[]>(existingTransactions)
  const [newRows, setNewRows] = useState<IncomeFormRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRow() {
    setNewRows(prev => [...prev, emptyRow(month, defaultBankId)])
  }

  function updateRow(i: number, updates: Partial<IncomeFormRow>) {
    setNewRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...updates } : r))
  }

  function removeNewRow(i: number) {
    setNewRows(prev => prev.filter((_, idx) => idx !== i))
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('למחוק הכנסה זו?')) return
    setSaving(true)
    try {
      await deleteTransaction(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } finally {
      setSaving(false)
    }
  }

  async function saveNewRows() {
    const valid = newRows.filter(r => r.sourceName.trim() && r.amount > 0)
    if (valid.length === 0) return
    setSaving(true); setError(null)
    try {
      await addTransactions(valid.map(r => ({
        date: r.date,
        merchantName: r.sourceName.trim(),
        amount: r.amount,
        currency: 'ILS',
        accountId: r.bankAccountId || defaultBankId,
        source: 'manual' as const,
        isImmediate: true,
        month,
        direction: 'income' as const,
      })))
      setNewRows([])
      onDone()
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">הכנסות נוספות — {month}</h2>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-2 mb-4">
        {entries.length === 0 && newRows.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-4">אין הכנסות נוספות לחודש זה</p>
        )}

        {entries.map(entry => (
          <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium">{entry.merchantName}</div>
              <div className="text-xs text-slate-400">{entry.date}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-sm text-green-400">₪{entry.amount.toLocaleString('he-IL')}</span>
              <button onClick={() => deleteEntry(entry.id)} className="text-red-400 hover:text-red-300">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {newRows.map((row, i) => (
          <div key={i} className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">הכנסה חדשה</span>
              <button onClick={() => removeNewRow(i)} className="text-red-400"><Trash2 size={14} /></button>
            </div>
            <input type="text" placeholder="מקור ההכנסה" value={row.sourceName}
              onChange={e => updateRow(i, { sourceName: e.target.value })}
              className="w-full bg-background rounded px-3 py-2 text-sm"
              aria-label={`שם מקור הכנסה ${i + 1}`}
            />
            <div className="flex gap-2">
              <input type="number" placeholder="סכום" value={row.amount || ''}
                onChange={e => updateRow(i, { amount: parseFloat(e.target.value) || 0 })}
                className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums"
                aria-label={`סכום הכנסה ${i + 1}`}
              />
              <input type="date" value={row.date}
                onChange={e => updateRow(i, { date: e.target.value })}
                className="flex-1 bg-background rounded px-3 py-2 text-sm"
                aria-label={`תאריך הכנסה ${i + 1}`}
              />
            </div>
            {bankAccounts.length > 0 && (
              <select value={row.bankAccountId} onChange={e => updateRow(i, { bankAccountId: e.target.value })}
                className="w-full bg-background text-foreground text-sm rounded px-3 py-2"
                aria-label={`חשבון בנק הכנסה ${i + 1}`}>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הכנסה
      </button>

      {newRows.length > 0 ? (
        <button onClick={saveNewRows} disabled={saving}
          className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
          {saving ? 'שומר...' : `שמור ${newRows.filter(r => r.sourceName && r.amount > 0).length} הכנסות`}
        </button>
      ) : (
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/import/flows/IncomeFlow.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/import/flows/IncomeFlow.tsx src/components/import/flows/IncomeFlow.test.tsx
git commit -m "feat: add IncomeFlow with existing entry display and immediate save"
```

---

### Task 10: CashFlow Component

Shows existing cash transactions for the month. Allows adding new cash expenses. Saves immediately.

**Files:**
- Create: `src/components/import/flows/CashFlow.tsx`
- Create: `src/components/import/flows/CashFlow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/flows/CashFlow.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { CashFlow } from './CashFlow'
import type { Category, Transaction } from '@/lib/types'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const categories: Category[] = [
  { id: 'cat1', name: 'מזון', color: '#f00', isActive: true },
]

const existingCashTx: Transaction = {
  id: 'tx1', date: '2026-06-05', merchantName: 'שוק הכרמל',
  amount: 120, currency: 'ILS', accountId: 'cash1',
  source: 'manual', isImmediate: true, month: '2026-06',
}

describe('CashFlow', () => {
  it('shows existing cash transaction', () => {
    render(
      <CashFlow
        month="2026-06"
        cashAccountId="cash1"
        categories={categories}
        existingTransactions={[existingCashTx]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText('שוק הכרמל')).toBeInTheDocument()
    expect(screen.getByText(/120/)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(
      <CashFlow
        month="2026-06"
        cashAccountId="cash1"
        categories={categories}
        existingTransactions={[]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/אין הוצאות מזומן/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/flows/CashFlow.test.tsx --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement CashFlow**

Create `src/components/import/flows/CashFlow.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { addTransactions, deleteTransaction } from '@/lib/firestore/transactions'
import type { Category, Transaction } from '@/lib/types'

interface CashRow {
  description: string
  amount: number
  date: string
  categoryId: string | null
}

function emptyRow(month: string): CashRow {
  return { description: '', amount: 0, date: `${month}-01`, categoryId: null }
}

interface Props {
  month: string
  cashAccountId: string
  categories: Category[]
  existingTransactions: Transaction[]
  onDone: () => void
  onBack: () => void
}

export function CashFlow({ month, cashAccountId, categories, existingTransactions, onDone, onBack }: Props) {
  const [entries, setEntries] = useState<Transaction[]>(existingTransactions)
  const [newRows, setNewRows] = useState<CashRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRow() { setNewRows(prev => [...prev, emptyRow(month)]) }
  function updateRow(i: number, u: Partial<CashRow>) { setNewRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...u } : r)) }
  function removeRow(i: number) { setNewRows(prev => prev.filter((_, idx) => idx !== i)) }

  async function deleteEntry(id: string) {
    if (!window.confirm('למחוק הוצאה זו?')) return
    setSaving(true)
    try {
      await deleteTransaction(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } finally {
      setSaving(false)
    }
  }

  async function saveNewRows() {
    const valid = newRows.filter(r => r.description.trim() && r.amount > 0)
    if (valid.length === 0) return
    setSaving(true); setError(null)
    try {
      await addTransactions(valid.map(r => ({
        date: r.date,
        merchantName: r.description.trim(),
        amount: r.amount,
        currency: 'ILS',
        accountId: cashAccountId,
        categoryId: r.categoryId ?? undefined,
        source: 'manual' as const,
        isImmediate: true,
        month,
      })))
      setNewRows([])
      onDone()
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">מזומן — {month}</h2>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-2 mb-4">
        {entries.length === 0 && newRows.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-4">אין הוצאות מזומן לחודש זה</p>
        )}

        {entries.map(entry => (
          <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium">{entry.merchantName}</div>
              <div className="text-xs text-slate-400">{entry.date}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-sm text-red-400">₪{entry.amount.toLocaleString('he-IL')}</span>
              <button onClick={() => deleteEntry(entry.id)} className="text-red-400 hover:text-red-300">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {newRows.map((row, i) => (
          <div key={i} className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">הוצאה חדשה</span>
              <button onClick={() => removeRow(i)} className="text-red-400"><Trash2 size={14} /></button>
            </div>
            <input type="text" placeholder="תיאור" value={row.description}
              onChange={e => updateRow(i, { description: e.target.value })}
              className="w-full bg-background rounded px-3 py-2 text-sm"
              aria-label={`תיאור הוצאה ${i + 1}`}
            />
            <div className="flex gap-2">
              <input type="number" placeholder="סכום" value={row.amount || ''}
                onChange={e => updateRow(i, { amount: parseFloat(e.target.value) || 0 })}
                className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums"
                aria-label={`סכום הוצאה ${i + 1}`}
              />
              <input type="date" value={row.date}
                onChange={e => updateRow(i, { date: e.target.value })}
                className="flex-1 bg-background rounded px-3 py-2 text-sm"
                aria-label={`תאריך הוצאה ${i + 1}`}
              />
            </div>
            <select value={row.categoryId ?? ''} onChange={e => updateRow(i, { categoryId: e.target.value || null })}
              className="w-full bg-background rounded px-3 py-2 text-sm"
              aria-label={`קטגוריה הוצאה ${i + 1}`}>
              <option value="">— ללא קטגוריה —</option>
              {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הוצאה
      </button>

      {newRows.length > 0 ? (
        <button onClick={saveNewRows} disabled={saving}
          className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
          {saving ? 'שומר...' : `שמור ${newRows.filter(r => r.description && r.amount > 0).length} הוצאות`}
        </button>
      ) : (
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/import/flows/CashFlow.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/import/flows/CashFlow.tsx src/components/import/flows/CashFlow.test.tsx
git commit -m "feat: add CashFlow with existing entry display and immediate save"
```

---

### Task 11: ImportHub Component

Hub screen showing all available flows as cards with status. Navigates into each flow. Refreshes status on return.

**Files:**
- Create: `src/components/import/ImportHub.tsx`
- Create: `src/components/import/ImportHub.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/ImportHub.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { ImportHub } from './ImportHub'

jest.mock('@/lib/firestore/accounts', () => ({
  getAccounts: jest.fn().mockResolvedValue([
    { id: 'cc1', name: 'ויזה', type: 'credit', color: '#f00', isActive: true },
    { id: 'bk1', name: 'לאומי', type: 'bank', color: '#00f', isActive: true },
    { id: 'cash1', name: 'מזומן', type: 'cash', color: '#0f0', isActive: true },
    { id: 'bk2', name: 'One Zero', type: 'bank', color: '#0ff', isActive: true, csvIdentifier: 'one-zero' },
  ]),
  seedDefaultAccounts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  seedDefaultCategories: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/categorization-rules', () => ({
  getRules: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/salary', () => ({
  getSalaryEntries: jest.fn().mockResolvedValue([]),
  getSalaryEntry: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/firestore/income', () => ({
  getIncomeEntries: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/hooks/usePersistedMonth', () => ({
  usePersistedMonth: () => ['2026-06', jest.fn()],
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

describe('ImportHub', () => {
  it('shows hub cards after loading', async () => {
    render(<ImportHub />)
    await waitFor(() => {
      expect(screen.getByText('ויזה')).toBeInTheDocument()
    })
    expect(screen.getByText('משכורות')).toBeInTheDocument()
    expect(screen.getByText('הכנסות נוספות')).toBeInTheDocument()
    expect(screen.getByText('מזומן')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/import/ImportHub.test.tsx --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement ImportHub**

Create `src/components/import/ImportHub.tsx`:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { seedDefaultAccounts, getAccounts } from '@/lib/firestore/accounts'
import { seedDefaultCategories, getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntries, getSalaryEntry } from '@/lib/firestore/salary'
import { CreditFlow } from './flows/CreditFlow'
import { BankFlow, type BankType } from './flows/BankFlow'
import { SalaryFlow } from './flows/SalaryFlow'
import { IncomeFlow } from './flows/IncomeFlow'
import { CashFlow } from './flows/CashFlow'
import type { Account, Category, CategorizationRule, SalaryEntry, Transaction } from '@/lib/types'

type FlowId =
  | { type: 'credit'; accountId: string }
  | { type: 'bank'; accountId: string; bankType: BankType }
  | { type: 'salary' }
  | { type: 'income' }
  | { type: 'cash' }

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function detectBankType(account: Account): BankType {
  const id = (account.csvIdentifier ?? account.name).toLowerCase()
  if (id.includes('one-zero') || id.includes('one zero')) return 'one-zero'
  if (id.includes('leumi') || id.includes('לאומי')) return 'leumi'
  return 'generic'
}

interface HubStatus {
  transactions: Transaction[]
  salaryEntries: SalaryEntry[]
}

function txCount(txs: Transaction[], accountId: string) {
  return txs.filter(t => t.accountId === accountId).length
}

export function ImportHub() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [status, setStatus] = useState<HubStatus>({ transactions: [], salaryEntries: [] })
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)
  const [activeFlow, setActiveFlow] = useState<FlowId | null>(null)

  const loadStatus = useCallback(async (m: string) => {
    const [txs, salaries] = await Promise.all([
      getTransactions(m),
      getSalaryEntries(m),
    ])
    setStatus({ transactions: txs, salaryEntries: salaries })
  }, [])

  useEffect(() => {
    setLoading(true)
    setActiveFlow(null)
    async function init() {
      try {
        await Promise.all([seedDefaultAccounts(), seedDefaultCategories()])
        const [accs, cats, rls, prevSal] = await Promise.all([
          getAccounts(),
          getCategories(),
          getRules(),
          getSalaryEntry(prevMonthStr(month)),
        ])
        setAccounts(accs)
        setCategories(cats)
        setRules(rls)
        if (prevSal) { const { id: _, ...rest } = prevSal; setPreviousSalary(rest) }
        await loadStatus(month)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [month, loadStatus])

  function handleFlowDone() {
    setActiveFlow(null)
    loadStatus(month)
  }

  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.isActive)
  const bankAccounts = accounts.filter(a => a.type === 'bank' && a.isActive)
  const cashAccount = accounts.find(a => a.type === 'cash' && a.isActive)
  const salaryBankAccounts = bankAccounts

  if (loading) {
    return (
      <main className="p-4 max-w-lg mx-auto">
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      </main>
    )
  }

  // Render active flow
  if (activeFlow) {
    if (activeFlow.type === 'credit') {
      const account = accounts.find(a => a.id === activeFlow.accountId)!
      return (
        <main className="p-4 max-w-lg mx-auto">
          <CreditFlow
            month={month}
            accountId={activeFlow.accountId}
            accountName={account.name}
            categories={categories}
            rules={rules}
            previousTransactions={status.transactions}
            existingTransactions={status.transactions.filter(t => t.accountId === activeFlow.accountId)}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'bank') {
      const account = accounts.find(a => a.id === activeFlow.accountId)!
      return (
        <main className="p-4 max-w-lg mx-auto">
          <BankFlow
            month={month}
            accountId={activeFlow.accountId}
            accountName={account.name}
            bankType={activeFlow.bankType}
            categories={categories}
            rules={rules}
            previousTransactions={status.transactions}
            existingTransactions={status.transactions.filter(t => t.accountId === activeFlow.accountId)}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'salary') {
      return (
        <main className="p-4 max-w-lg mx-auto">
          <SalaryFlow
            month={month}
            existingEntries={status.salaryEntries}
            bankAccounts={salaryBankAccounts}
            previousSalary={previousSalary}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'income') {
      const incomeTxs = status.transactions.filter(t => t.direction === 'income' && !t.salaryDetails)
      return (
        <main className="p-4 max-w-lg mx-auto">
          <IncomeFlow
            month={month}
            existingTransactions={incomeTxs}
            bankAccounts={salaryBankAccounts}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'cash') {
      const cashTxs = cashAccount
        ? status.transactions.filter(t => t.accountId === cashAccount.id)
        : []
      return (
        <main className="p-4 max-w-lg mx-auto">
          <CashFlow
            month={month}
            cashAccountId={cashAccount?.id ?? ''}
            categories={categories}
            existingTransactions={cashTxs}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
  }

  // Hub screen
  const incomeTxCount = status.transactions.filter(t => t.direction === 'income' && !t.salaryDetails).length
  const cashTxCount = cashAccount ? txCount(status.transactions, cashAccount.id) : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={m => { setMonth(m); setActiveFlow(null) }} />
      <p className="text-sm text-slate-400 mb-4">בחר תהליך ייבוא:</p>

      <div className="space-y-2">
        {creditAccounts.map(acc => {
          const count = txCount(status.transactions, acc.id)
          return (
            <button
              key={acc.id}
              onClick={() => setActiveFlow({ type: 'credit', accountId: acc.id })}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
                <span className="text-sm font-medium">{acc.name}</span>
              </div>
              <span className="text-xs text-slate-400">{count > 0 ? `${count} עסקאות` : 'לא יובא'}</span>
            </button>
          )
        })}

        {bankAccounts.map(acc => {
          const count = txCount(status.transactions, acc.id)
          const bankType = detectBankType(acc)
          return (
            <button
              key={acc.id}
              onClick={() => setActiveFlow({ type: 'bank', accountId: acc.id, bankType })}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
                <span className="text-sm font-medium">{acc.name}</span>
                <span className="text-xs text-slate-500">בנק</span>
              </div>
              <span className="text-xs text-slate-400">{count > 0 ? `${count} עסקאות` : 'לא יובא'}</span>
            </button>
          )
        })}

        <button
          onClick={() => setActiveFlow({ type: 'salary' })}
          className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
        >
          <span className="text-sm font-medium">משכורות</span>
          <span className="text-xs text-slate-400">
            {status.salaryEntries.length > 0
              ? `${status.salaryEntries.length} משכורות — נטו ₪${status.salaryEntries.reduce((s, e) => s + e.netAmount, 0).toLocaleString('he-IL')}`
              : 'לא הוזן'}
          </span>
        </button>

        <button
          onClick={() => setActiveFlow({ type: 'income' })}
          className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
        >
          <span className="text-sm font-medium">הכנסות נוספות</span>
          <span className="text-xs text-slate-400">{incomeTxCount > 0 ? `${incomeTxCount} הכנסות` : 'אין'}</span>
        </button>

        {cashAccount && (
          <button
            onClick={() => setActiveFlow({ type: 'cash' })}
            className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
          >
            <span className="text-sm font-medium">מזומן</span>
            <span className="text-xs text-slate-400">{cashTxCount > 0 ? `${cashTxCount} הוצאות` : 'אין'}</span>
          </button>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/import/ImportHub.test.tsx --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/import/ImportHub.tsx src/components/import/ImportHub.test.tsx
git commit -m "feat: add ImportHub with status cards and flow navigation"
```

---

### Task 12: Wire Up and Clean Up

Replace `ImportWizard` with `ImportHub` in the import page. Delete old wizard files.

**Files:**
- Modify: `src/app/(app)/import/page.tsx`
- Delete: `src/components/import/ImportWizard.tsx`
- Delete: `src/components/import/ImportWizard.test.tsx`
- Delete: `src/components/import/steps/CreditImportStep.tsx`
- Delete: `src/components/import/steps/CreditImportStep.test.tsx`
- Delete: `src/components/import/steps/SalaryStep.tsx`
- Delete: `src/components/import/steps/SalaryStep.test.tsx`
- Delete: `src/components/import/steps/IncomeStep.tsx`
- Delete: `src/components/import/steps/IncomeStep.test.tsx`
- Delete: `src/components/import/steps/CashStep.tsx`
- Delete: `src/components/import/steps/CashStep.test.tsx`
- Delete: `src/components/import/steps/SummaryStep.tsx`
- Delete: `src/components/import/steps/SummaryStep.test.tsx`

- [ ] **Step 1: Update import page**

Replace the full content of `src/app/(app)/import/page.tsx`:

```typescript
import { ImportHub } from '@/components/import/ImportHub'

export default function ImportPage() {
  return <ImportHub />
}
```

- [ ] **Step 2: Run full test suite to check for breakage**

Run: `npx jest --no-coverage`
Expected: All new tests pass, old wizard tests may fail (we will delete them next)

- [ ] **Step 3: Delete old wizard files**

Run:
```bash
rm src/components/import/ImportWizard.tsx
rm src/components/import/ImportWizard.test.tsx
rm src/components/import/steps/CreditImportStep.tsx
rm src/components/import/steps/CreditImportStep.test.tsx
rm src/components/import/steps/SalaryStep.tsx
rm src/components/import/steps/SalaryStep.test.tsx
rm src/components/import/steps/IncomeStep.tsx
rm src/components/import/steps/IncomeStep.test.tsx
rm src/components/import/steps/CashStep.tsx
rm src/components/import/steps/CashStep.test.tsx
rm src/components/import/steps/SummaryStep.tsx
rm src/components/import/steps/SummaryStep.test.tsx
```

- [ ] **Step 4: Run full test suite — expect all pass**

Run: `npx jest --no-coverage`
Expected: All tests pass

- [ ] **Step 5: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace ImportWizard with ImportHub — independent flows, bank import, duplicate detection"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Hub with list of buttons/cards per flow | Task 11 |
| Each credit card separate, each bank separate | Task 11 |
| Each flow saves independently/immediately | Tasks 6, 7, 8, 9, 10 |
| Status on hub (transaction count, salary net) | Task 11 |
| Description/notes field editable during import | Tasks 6, 7 |
| Direction (income/expense) selectable per row | Tasks 6, 7 |
| Credit negative amounts auto-marked as income | Task 6 (applyCategories) |
| One Zero XLS bank import | Tasks 3, 7 |
| Leumi PDF bank import | Tasks 4, 7 |
| Salary: multiple entries per month | Tasks 2, 8 |
| Salary: shows existing entries | Task 8 |
| Income: shows existing entries, add/edit | Task 9 |
| Cash: shows existing entries, add/delete | Task 10 |
| Duplicate detection with warning | Tasks 5, 6, 7 |
| Proceed if user confirms duplicates | Tasks 6, 7 (window.confirm) |

All requirements covered. No placeholders detected.

**Type consistency:**
- `ImportedTransaction.direction: 'income' | 'expense'` — defined in Task 1, used in Tasks 6, 7, 8, 9, 10
- `BankType` — defined and exported from `BankFlow.tsx`, imported in `ImportHub.tsx`
- `getSalaryEntries(month)` — defined in Task 2, used in Tasks 8, 11
- `deleteSalaryEntry(id)` — defined in Task 2, used in Task 8
- `parseLeumiRows(items)` — exported from `leumi-pdf-parser.ts`, tested in Task 4
- `parseOneZeroXlsx(data)` — exported from `one-zero-xlsx-parser.ts`, used in Task 7
- `detectDuplicates(incoming, existing)` — defined in Task 5, used in Tasks 6, 7
