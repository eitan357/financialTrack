# Reports Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/reports` page — a 6-month comparison table showing total expenses per month and top spending categories.

**Architecture:** A new Firestore service function loads transactions for multiple months in one query (using Firestore's `in` operator). A pure `computeMonthlyReports` function transforms raw transactions into per-month expense summaries. The page loads the last 6 months of data, loads categories, and renders a comparison table.

**Tech Stack:** Next.js App Router (`'use client'`), Firebase Firestore, React, Tailwind CSS v4, Jest + React Testing Library

---

## File Structure

New files:
- `src/lib/reports/compute.ts` — pure function: `computeMonthlyReports(transactions, months, categories)`
- `src/lib/reports/compute.test.ts`
- `src/components/reports/MonthSummaryRow.tsx` — one row in the comparison table
- `src/components/reports/MonthSummaryRow.test.tsx`
- `src/app/(app)/reports/page.test.tsx`

Modified files:
- `src/lib/firestore/transactions.ts` — add `getTransactionsForMonths(months: string[])`
- `src/lib/firestore/transactions.test.ts` — add test for `getTransactionsForMonths`
- `src/app/(app)/reports/page.tsx` — replace placeholder with full implementation

---

### Task 1: Add getTransactionsForMonths to Firestore service

**Files:**
- Modify: `src/lib/firestore/transactions.ts`
- Modify: `src/lib/firestore/transactions.test.ts`

**Context:**
The existing `transactions.ts` queries by a single `month` field. We need a bulk query for multiple months using Firestore's `where('month', 'in', months)`. The mock in the test file already handles `where` calls.

Current import line in `transactions.ts`:
```typescript
import { getFirestore, collection, getDocs, writeBatch, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore'
```
(Note: `deleteDoc` was added in Plan 4. If it's not there yet, include it.)

- [ ] **Step 1: Add the test**

In `src/lib/firestore/transactions.test.ts`, add `getTransactionsForMonths` to the import (line 34):
```typescript
import { getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction, deleteTransaction, getTransactionsForMonths } from './transactions'
```

Add after the `describe('deleteTransaction')` block:
```typescript
describe('getTransactionsForMonths', () => {
  it('returns empty array for empty months list', async () => {
    const result = await getTransactionsForMonths([])
    expect(result).toEqual([])
    expect(mockGetDocs).not.toHaveBeenCalled()
  })

  it('queries with in operator for multiple months', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => mockTxData }] })
    const result = await getTransactionsForMonths(['2026-05', '2026-06'])
    expect(mockWhere).toHaveBeenCalledWith('month', 'in', ['2026-05', '2026-06'])
    expect(result[0]).toEqual({ id: 't1', ...mockTxData })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/lib/firestore/transactions.test.ts --no-coverage
```

Expected: FAIL — `getTransactionsForMonths is not exported`.

- [ ] **Step 3: Implement getTransactionsForMonths**

Add at the end of `src/lib/firestore/transactions.ts`:
```typescript
export async function getTransactionsForMonths(months: string[]): Promise<Transaction[]> {
  if (months.length === 0) return []
  const q = query(
    collection(getDb(), 'transactions'),
    where('month', 'in', months)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/lib/firestore/transactions.test.ts --no-coverage
```

Expected: All tests pass (now 7 tests in this file).

- [ ] **Step 5: Commit**

```
git add src/lib/firestore/transactions.ts src/lib/firestore/transactions.test.ts
git commit -m "feat: add getTransactionsForMonths to Firestore service"
```

---

### Task 2: computeMonthlyReports pure function

**Files:**
- Create: `src/lib/reports/compute.ts`
- Create: `src/lib/reports/compute.test.ts`

**Context:**
A pure function (no Firebase) that takes a flat list of transactions, a list of months to report on, and the category definitions. It returns one `MonthlyExpenseSummary` per month, sorted by month descending (most recent first).

Types used:
```typescript
// From src/lib/types/index.ts:
interface Transaction { id: string; month: string; amount: number; categoryId?: string; /* ... */ }
interface Category { id: string; name: string; color: string; isActive: boolean }
```

- [ ] **Step 1: Write the test**

Create `src/lib/reports/compute.test.ts`:
```typescript
import { computeMonthlyReports } from './compute'
import type { Transaction, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
  { id: 'c2', name: 'תחבורה', color: '#3b82f6', isActive: true },
]

const txs: Transaction[] = [
  { id: 'a', date: '2026-06-01', merchantName: 'שופרסל', amount: 300, currency: 'ILS', accountId: 'x', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
  { id: 'b', date: '2026-06-05', merchantName: 'גט', amount: 100, currency: 'ILS', accountId: 'x', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c2' },
  { id: 'c', date: '2026-05-10', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'x', source: 'csv_import', isImmediate: false, month: '2026-05', categoryId: 'c1' },
]

describe('computeMonthlyReports', () => {
  it('returns one entry per requested month', () => {
    const result = computeMonthlyReports(txs, ['2026-06', '2026-05'], cats)
    expect(result).toHaveLength(2)
  })

  it('returns months in descending order (most recent first)', () => {
    const result = computeMonthlyReports(txs, ['2026-05', '2026-06'], cats)
    expect(result[0].month).toBe('2026-06')
    expect(result[1].month).toBe('2026-05')
  })

  it('computes correct total expenses per month', () => {
    const result = computeMonthlyReports(txs, ['2026-06', '2026-05'], cats)
    expect(result.find(r => r.month === '2026-06')?.totalExpenses).toBe(400)
    expect(result.find(r => r.month === '2026-05')?.totalExpenses).toBe(200)
  })

  it('computes category totals sorted by amount desc', () => {
    const result = computeMonthlyReports(txs, ['2026-06'], cats)
    const june = result[0]
    expect(june.byCategory[0].categoryId).toBe('c1')
    expect(june.byCategory[0].total).toBe(300)
    expect(june.byCategory[0].name).toBe('אוכל')
  })

  it('returns zero total for months with no transactions', () => {
    const result = computeMonthlyReports(txs, ['2026-04'], cats)
    expect(result[0].totalExpenses).toBe(0)
    expect(result[0].byCategory).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/lib/reports/compute.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeMonthlyReports**

Create `src/lib/reports/compute.ts`:
```typescript
import type { Transaction, Category } from '@/lib/types'

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  total: number
}

export interface MonthlyExpenseSummary {
  month: string
  totalExpenses: number
  byCategory: CategoryTotal[]
}

export function computeMonthlyReports(
  transactions: Transaction[],
  months: string[],
  categories: Category[]
): MonthlyExpenseSummary[] {
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))

  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map(month => {
      const monthTxs = transactions.filter(t => t.month === month)
      const totalExpenses = monthTxs.reduce((s, t) => s + t.amount, 0)

      const totals: Record<string, number> = {}
      for (const tx of monthTxs) {
        if (tx.categoryId) {
          totals[tx.categoryId] = (totals[tx.categoryId] ?? 0) + tx.amount
        }
      }

      const byCategory: CategoryTotal[] = Object.entries(totals)
        .map(([categoryId, total]) => {
          const cat = categoryMap[categoryId]
          return { categoryId, name: cat?.name ?? categoryId, color: cat?.color ?? '#64748b', total }
        })
        .sort((a, b) => b.total - a.total)

      return { month, totalExpenses, byCategory }
    })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/lib/reports/compute.test.ts --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/reports/compute.ts src/lib/reports/compute.test.ts
git commit -m "feat: add computeMonthlyReports pure function"
```

---

### Task 3: MonthSummaryRow component

**Files:**
- Create: `src/components/reports/MonthSummaryRow.tsx`
- Create: `src/components/reports/MonthSummaryRow.test.tsx`

**Context:**
Renders one row of the reports table. Shows: month label (Hebrew), total expenses, and the top 3 categories as small colored chips.

`MonthlyExpenseSummary` type (from `src/lib/reports/compute.ts`):
```typescript
interface MonthlyExpenseSummary {
  month: string           // YYYY-MM
  totalExpenses: number
  byCategory: { categoryId: string; name: string; color: string; total: number }[]
}
```

Hebrew month names (same array as other pages):
```typescript
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
```

- [ ] **Step 1: Write the test**

Create `src/components/reports/MonthSummaryRow.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { MonthSummaryRow } from './MonthSummaryRow'
import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

const summary: MonthlyExpenseSummary = {
  month: '2026-06',
  totalExpenses: 3500,
  byCategory: [
    { categoryId: 'c1', name: 'אוכל', color: '#ef4444', total: 2000 },
    { categoryId: 'c2', name: 'תחבורה', color: '#3b82f6', total: 1000 },
    { categoryId: 'c3', name: 'בידור', color: '#a855f7', total: 500 },
    { categoryId: 'c4', name: 'בריאות', color: '#22c55e', total: 100 },
  ],
}

describe('MonthSummaryRow', () => {
  it('renders the Hebrew month name', () => {
    render(<MonthSummaryRow summary={summary} />)
    expect(screen.getByText(/יוני/)).toBeInTheDocument()
  })

  it('renders total expenses formatted', () => {
    render(<MonthSummaryRow summary={summary} />)
    expect(screen.getByText(/3,500/)).toBeInTheDocument()
  })

  it('renders top 3 categories only', () => {
    render(<MonthSummaryRow summary={summary} />)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText('תחבורה')).toBeInTheDocument()
    expect(screen.getByText('בידור')).toBeInTheDocument()
    expect(screen.queryByText('בריאות')).not.toBeInTheDocument()
  })

  it('renders empty categories gracefully', () => {
    const empty = { ...summary, byCategory: [] }
    render(<MonthSummaryRow summary={empty} />)
    expect(screen.getByText(/יוני/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/reports/MonthSummaryRow.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement MonthSummaryRow**

Create `src/components/reports/MonthSummaryRow.tsx`:
```typescript
import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

interface Props {
  summary: MonthlyExpenseSummary
}

export function MonthSummaryRow({ summary }: Props) {
  const [y, mo] = summary.month.split('-')
  const monthLabel = `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
  const top3 = summary.byCategory.slice(0, 3)

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className="w-24 flex-shrink-0">
        <span className="text-sm font-medium">{monthLabel}</span>
      </div>
      <div className="w-24 flex-shrink-0 text-left">
        <span className="text-sm tabular-nums font-mono">₪{summary.totalExpenses.toLocaleString('he-IL')}</span>
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        {top3.map(cat => (
          <span
            key={cat.categoryId}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: cat.color + '33', color: cat.color }}
          >
            {cat.name}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/reports/MonthSummaryRow.test.tsx --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/reports/MonthSummaryRow.tsx src/components/reports/MonthSummaryRow.test.tsx
git commit -m "feat: add MonthSummaryRow component"
```

---

### Task 4: Reports page

**Files:**
- Modify: `src/app/(app)/reports/page.tsx` (replace placeholder)
- Create: `src/app/(app)/reports/page.test.tsx`

**Context:**
Currently `src/app/(app)/reports/page.tsx` contains only a placeholder `<h1>דוחות</h1>`.

The page computes the last 6 months on mount (no month navigation — always shows history), loads all relevant transactions in one query, loads categories, and renders a `MonthSummaryRow` per month.

Imports to use:
- `getTransactionsForMonths` from `@/lib/firestore/transactions`
- `getCategories` from `@/lib/firestore/categories`
- `computeMonthlyReports` from `@/lib/reports/compute`
- `MonthSummaryRow` from `@/components/reports/MonthSummaryRow`
- Types: `Category` from `@/lib/types`
- Type: `MonthlyExpenseSummary` from `@/lib/reports/compute`

Helper to compute last N months (returns array of YYYY-MM strings, most recent first):
```typescript
function lastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}
```

- [ ] **Step 1: Write the test**

Create `src/app/(app)/reports/page.test.tsx`:
```typescript
const mockGetTransactionsForMonths = jest.fn()
const mockGetCategories = jest.fn()

jest.mock('@/lib/firestore/transactions', () => ({
  getTransactionsForMonths: (...a: unknown[]) => mockGetTransactionsForMonths(...a),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: (...a: unknown[]) => mockGetCategories(...a),
}))

import { render, screen, waitFor } from '@testing-library/react'
import ReportsPage from './page'
import type { Transaction, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]
const txs: Transaction[] = [
  { id: 'tx1', date: '2026-06-01', merchantName: 'שופרסל', amount: 500, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTransactionsForMonths.mockResolvedValue(txs)
  mockGetCategories.mockResolvedValue(cats)
})

describe('ReportsPage', () => {
  it('shows loading state initially', () => {
    mockGetTransactionsForMonths.mockImplementation(() => new Promise(() => {}))
    render(<ReportsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('renders the page title', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText('דוחות')).toBeInTheDocument())
  })

  it('calls getTransactionsForMonths with 6 months', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(mockGetTransactionsForMonths).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringMatching(/^\d{4}-\d{2}$/)])
    ))
    expect(mockGetTransactionsForMonths.mock.calls[0][0]).toHaveLength(6)
  })

  it('renders month summary rows after loading', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText(/יוני/)).toBeInTheDocument())
  })

  it('shows total expenses for a month', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText(/500/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest "src/app/(app)/reports/page.test.tsx" --no-coverage
```

Expected: FAIL — placeholder page doesn't implement required behavior.

- [ ] **Step 3: Implement the Reports page**

Overwrite `src/app/(app)/reports/page.tsx` completely:
```typescript
'use client'
import { useState, useEffect } from 'react'
import { getTransactionsForMonths } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { computeMonthlyReports } from '@/lib/reports/compute'
import { MonthSummaryRow } from '@/components/reports/MonthSummaryRow'
import type { Category } from '@/lib/types'
import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

function lastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [summaries, setSummaries] = useState<MonthlyExpenseSummary[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    setLoading(true)
    const months = lastNMonths(6)
    async function load() {
      try {
        const [txs, cats] = await Promise.all([
          getTransactionsForMonths(months),
          getCategories(),
        ])
        setCategories(cats)
        setSummaries(computeMonthlyReports(txs, months, cats))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalAllMonths = summaries.reduce((s, m) => s + m.totalExpenses, 0)
  const avgMonthly = summaries.length > 0 ? Math.round(totalAllMonths / summaries.length) : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <h1 className="text-lg font-bold mb-4">דוחות</h1>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">ממוצע חודשי</p>
              <p className="text-xl font-bold tabular-nums">₪{avgMonthly.toLocaleString('he-IL')}</p>
            </div>
            <div className="bg-surface rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">סה&quot;כ 6 חודשים</p>
              <p className="text-xl font-bold tabular-nums">₪{totalAllMonths.toLocaleString('he-IL')}</p>
            </div>
          </div>

          <div className="bg-surface rounded-2xl px-4">
            <div className="flex gap-3 py-2 border-b border-slate-700 text-xs text-slate-400">
              <span className="w-24">חודש</span>
              <span className="w-24">הוצאות</span>
              <span className="flex-1">קטגוריות מובילות</span>
            </div>
            {summaries.map(s => (
              <MonthSummaryRow key={s.month} summary={s} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest "src/app/(app)/reports/page.test.tsx" --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Run full test suite**

```
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add src/app/(app)/reports/page.tsx src/app/(app)/reports/page.test.tsx
git commit -m "feat: implement reports page with 6-month expense comparison"
```
