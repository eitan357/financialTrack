# Transactions Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/transactions` page — list monthly transactions with inline category editing, delete support, and categorization rules management modal.

**Architecture:** The page is a `'use client'` component that loads transactions, categories, and rules in parallel on mount. Category changes call `updateTransaction` immediately (optimistic local state update). A `RulesModal` (slide-up sheet) shows and manages categorization rules. A filter toggle shows all vs. uncategorized transactions.

**Tech Stack:** Next.js App Router (`'use client'`), Firebase Firestore, React, Tailwind CSS v4, Jest + React Testing Library

---

## File Structure

New files:
- `src/components/transactions/CategorySelect.tsx` — reusable `<select>` for category assignment
- `src/components/transactions/CategorySelect.test.tsx`
- `src/components/transactions/TransactionRow.tsx` — one row: date, merchant, amount, category select, delete
- `src/components/transactions/TransactionRow.test.tsx`
- `src/components/transactions/RulesModal.tsx` — slide-up modal for viewing/adding/deleting categorization rules
- `src/components/transactions/RulesModal.test.tsx`
- `src/app/(app)/transactions/page.test.tsx`

Modified files:
- `src/lib/firestore/transactions.ts` — add `deleteTransaction(id)`
- `src/lib/firestore/transactions.test.ts` — add test for `deleteTransaction`
- `src/app/(app)/transactions/page.tsx` — replace placeholder with full implementation

---

### Task 1: Add deleteTransaction to Firestore service

**Files:**
- Modify: `src/lib/firestore/transactions.ts`
- Modify: `src/lib/firestore/transactions.test.ts`

**Context:**
Current `transactions.ts` imports from `firebase/firestore`: `getFirestore, collection, getDocs, writeBatch, updateDoc, doc, query, where, orderBy`. The test file already declares `mockDeleteDoc` and mocks `deleteDoc` in the `firebase/firestore` mock. The import line in the test is:
```typescript
import { getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction } from './transactions'
```

- [ ] **Step 1: Add test for deleteTransaction**

In `src/lib/firestore/transactions.test.ts`:

Change the import line (line 34) from:
```typescript
import { getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction } from './transactions'
```
to:
```typescript
import { getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction, deleteTransaction } from './transactions'
```

Add this describe block after the `describe('updateTransaction')` block:
```typescript
describe('deleteTransaction', () => {
  it('calls deleteDoc on the correct document', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await deleteTransaction('tx1')
    expect(mockDoc).toHaveBeenCalledWith({}, 'transactions', 'tx1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/lib/firestore/transactions.test.ts --no-coverage
```

Expected: FAIL — `deleteTransaction is not exported` or similar.

- [ ] **Step 3: Implement deleteTransaction**

In `src/lib/firestore/transactions.ts`, change the import line from:
```typescript
import { getFirestore, collection, getDocs, writeBatch, updateDoc, doc, query, where, orderBy } from 'firebase/firestore'
```
to:
```typescript
import { getFirestore, collection, getDocs, writeBatch, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore'
```

Add at the end of the file:
```typescript
export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'transactions', id))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/lib/firestore/transactions.test.ts --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/firestore/transactions.ts src/lib/firestore/transactions.test.ts
git commit -m "feat: add deleteTransaction to Firestore service"
```

---

### Task 2: CategorySelect component

**Files:**
- Create: `src/components/transactions/CategorySelect.tsx`
- Create: `src/components/transactions/CategorySelect.test.tsx`

**Context:**
A reusable `<select>` dropdown for picking a category. Shows "ללא קטגוריה" as the first option (empty value). Used in both `TransactionRow` and `RulesModal`.

`Category` type from `src/lib/types/index.ts`:
```typescript
interface Category {
  id: string
  name: string
  monthlyTarget?: number
  color: string
  isActive: boolean
}
```

- [ ] **Step 1: Write the test**

Create `src/components/transactions/CategorySelect.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { CategorySelect } from './CategorySelect'
import type { Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
  { id: 'c2', name: 'תחבורה', color: '#3b82f6', isActive: true },
]

describe('CategorySelect', () => {
  it('renders "ללא קטגוריה" as first option', () => {
    render(<CategorySelect value={undefined} categories={cats} onChange={jest.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('ללא קטגוריה')).toBeInTheDocument()
  })

  it('renders all category options', () => {
    render(<CategorySelect value={undefined} categories={cats} onChange={jest.fn()} />)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText('תחבורה')).toBeInTheDocument()
  })

  it('shows the selected category', () => {
    render(<CategorySelect value="c1" categories={cats} onChange={jest.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('c1')
  })

  it('calls onChange with undefined when blank option is selected', () => {
    const onChange = jest.fn()
    render(<CategorySelect value="c1" categories={cats} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('calls onChange with categoryId when a category is selected', () => {
    const onChange = jest.fn()
    render(<CategorySelect value={undefined} categories={cats} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c2' } })
    expect(onChange).toHaveBeenCalledWith('c2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/transactions/CategorySelect.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement CategorySelect**

Create `src/components/transactions/CategorySelect.tsx`:
```typescript
import type { Category } from '@/lib/types'

interface Props {
  value?: string
  categories: Category[]
  onChange: (categoryId: string | undefined) => void
  className?: string
}

export function CategorySelect({ value, categories, onChange, className = '' }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
      className={`bg-slate-800 border border-slate-700 rounded-lg text-xs px-2 py-1 text-foreground ${className}`}
    >
      <option value="">ללא קטגוריה</option>
      {categories.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/transactions/CategorySelect.test.tsx --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/transactions/CategorySelect.tsx src/components/transactions/CategorySelect.test.tsx
git commit -m "feat: add CategorySelect component"
```

---

### Task 3: TransactionRow component

**Files:**
- Create: `src/components/transactions/TransactionRow.tsx`
- Create: `src/components/transactions/TransactionRow.test.tsx`

**Context:**
Displays one transaction as a flex row: date (DD/MM format), merchant name, amount (₪), a `CategorySelect` dropdown, and a delete button. Merchant shown in amber when there is no category.

`Transaction` type (relevant fields):
```typescript
interface Transaction {
  id: string
  date: string       // ISO YYYY-MM-DD  (e.g. '2026-06-15')
  merchantName: string
  amount: number
  currency: string
  accountId: string
  categoryId?: string
  source: TransactionSource
  isImmediate: boolean
  month: string
}
```

Date format: split `'2026-06-15'` by `'-'` → `[, mm, dd]` → render as `dd/mm` = `'15/06'`.

- [ ] **Step 1: Write the test**

Create `src/components/transactions/TransactionRow.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionRow } from './TransactionRow'
import type { Transaction, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]

const tx: Transaction = {
  id: 'tx1',
  date: '2026-06-15',
  merchantName: 'שופרסל',
  amount: 250,
  currency: 'ILS',
  accountId: 'a1',
  source: 'csv_import',
  isImmediate: false,
  month: '2026-06',
}

describe('TransactionRow', () => {
  it('renders date in DD/MM format', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByText('15/06')).toBeInTheDocument()
  })

  it('renders merchant name', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByText('שופרסל')).toBeInTheDocument()
  })

  it('renders formatted amount with ₪', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByText(/250/)).toBeInTheDocument()
  })

  it('calls onCategoryChange with transactionId and new categoryId', () => {
    const onCategoryChange = jest.fn()
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={onCategoryChange} onDelete={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    expect(onCategoryChange).toHaveBeenCalledWith('tx1', 'c1')
  })

  it('calls onCategoryChange with undefined when blank is selected', () => {
    const onCategoryChange = jest.fn()
    const txWithCat = { ...tx, categoryId: 'c1' }
    render(<TransactionRow transaction={txWithCat} categories={cats} onCategoryChange={onCategoryChange} onDelete={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onCategoryChange).toHaveBeenCalledWith('tx1', undefined)
  })

  it('calls onDelete with transactionId when delete button clicked', () => {
    const onDelete = jest.fn()
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'מחק עסקה' }))
    expect(onDelete).toHaveBeenCalledWith('tx1')
  })

  it('shows the current category in the select', () => {
    const txWithCat = { ...tx, categoryId: 'c1' }
    render(<TransactionRow transaction={txWithCat} categories={cats} onCategoryChange={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('c1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/transactions/TransactionRow.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TransactionRow**

Create `src/components/transactions/TransactionRow.tsx`:
```typescript
import type { Transaction, Category } from '@/lib/types'
import { CategorySelect } from './CategorySelect'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryChange: (transactionId: string, categoryId: string | undefined) => void
  onDelete: (transactionId: string) => void
}

export function TransactionRow({ transaction, categories, onCategoryChange, onDelete }: Props) {
  const [, mm, dd] = transaction.date.split('-')
  const hasCategory = !!transaction.categoryId
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 w-10 flex-shrink-0 tabular-nums">{dd}/{mm}</span>
      <span className={`flex-1 text-sm truncate ${!hasCategory ? 'text-amber-400' : 'text-foreground'}`}>
        {transaction.merchantName}
      </span>
      <span className="text-sm tabular-nums flex-shrink-0">₪{transaction.amount.toLocaleString('he-IL')}</span>
      <CategorySelect
        value={transaction.categoryId}
        categories={categories}
        onChange={categoryId => onCategoryChange(transaction.id, categoryId)}
        className="w-28 flex-shrink-0"
      />
      <button
        onClick={() => onDelete(transaction.id)}
        aria-label="מחק עסקה"
        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 text-sm px-1"
      >✕</button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/transactions/TransactionRow.test.tsx --no-coverage
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/transactions/TransactionRow.tsx src/components/transactions/TransactionRow.test.tsx
git commit -m "feat: add TransactionRow component"
```

---

### Task 4: RulesModal component

**Files:**
- Create: `src/components/transactions/RulesModal.tsx`
- Create: `src/components/transactions/RulesModal.test.tsx`

**Context:**
A slide-up bottom sheet modal. Lists existing categorization rules (keyword → category name) and an add form (keyword input + category select + submit). Close button and backdrop dismiss.

Relevant types from `src/lib/types/index.ts`:
```typescript
interface CategorizationRule {
  id: string
  keyword: string
  matchType: 'contains' | 'exact' | 'startsWith'
  categoryId: string
  priority: number
  createdAt: string // ISO date string
}
interface Category { id: string; name: string; color: string; isActive: boolean }
```

- [ ] **Step 1: Write the test**

Create `src/components/transactions/RulesModal.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { RulesModal } from './RulesModal'
import type { CategorizationRule, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]

const rules: CategorizationRule[] = [
  { id: 'r1', keyword: 'שופרסל', matchType: 'contains', categoryId: 'c1', priority: 10, createdAt: '2026-01-01T00:00:00Z' },
]

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  rules,
  categories: cats,
  onAdd: jest.fn(),
  onDelete: jest.fn(),
}

describe('RulesModal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<RulesModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders title when isOpen is true', () => {
    render(<RulesModal {...defaultProps} />)
    expect(screen.getByText('חוקי קטגוריזציה')).toBeInTheDocument()
  })

  it('shows existing rule keyword and category name', () => {
    render(<RulesModal {...defaultProps} />)
    expect(screen.getByText('שופרסל')).toBeInTheDocument()
    expect(screen.getByText('אוכל')).toBeInTheDocument()
  })

  it('shows empty state when rules list is empty', () => {
    render(<RulesModal {...defaultProps} rules={[]} />)
    expect(screen.getByText('אין חוקים עדיין')).toBeInTheDocument()
  })

  it('calls onDelete with ruleId when delete button clicked', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'מחק חוק' }))
    expect(defaultProps.onDelete).toHaveBeenCalledWith('r1')
  })

  it('calls onAdd with correct data when form submitted', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('למשל: שופרסל'), { target: { value: 'רמי לוי' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(defaultProps.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'רמי לוי', categoryId: 'c1', matchType: 'contains' })
    )
  })

  it('calls onClose when close button clicked', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('does not call onAdd when keyword is empty', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(defaultProps.onAdd).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/transactions/RulesModal.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RulesModal**

Create `src/components/transactions/RulesModal.tsx`:
```typescript
'use client'
import { useState } from 'react'
import type { CategorizationRule, Category } from '@/lib/types'
import { CategorySelect } from './CategorySelect'

interface NewRule {
  keyword: string
  matchType: 'contains'
  categoryId: string
  priority: number
  createdAt: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  rules: CategorizationRule[]
  categories: Category[]
  onAdd: (rule: NewRule) => void
  onDelete: (ruleId: string) => void
}

export function RulesModal({ isOpen, onClose, rules, categories, onAdd, onDelete }: Props) {
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()

  if (!isOpen) return null

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim() || !categoryId) return
    onAdd({ keyword: keyword.trim(), matchType: 'contains', categoryId, priority: 10, createdAt: new Date().toISOString() })
    setKeyword('')
    setCategoryId(undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-slate-900 w-full max-h-[80vh] rounded-t-2xl overflow-y-auto">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900">
          <h2 className="font-semibold">חוקי קטגוריזציה</h2>
          <button onClick={onClose} aria-label="סגור" className="text-slate-400 text-lg px-2">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-32">
              <label className="text-xs text-slate-400 block mb-1">מילת מפתח</label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="למשל: שופרסל"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">קטגוריה</label>
              <CategorySelect value={categoryId} categories={categories} onChange={setCategoryId} />
            </div>
            <button
              type="submit"
              aria-label="הוסף"
              disabled={!keyword.trim() || !categoryId}
              className="bg-accent text-white px-3 py-2 rounded-lg text-sm disabled:opacity-40"
            >הוסף</button>
          </form>
          <div className="space-y-2">
            {rules.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">אין חוקים עדיין</p>
            ) : rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2">
                <span className="text-sm">{rule.keyword}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{categoryMap[rule.categoryId]?.name ?? rule.categoryId}</span>
                  <button
                    onClick={() => onDelete(rule.id)}
                    aria-label="מחק חוק"
                    className="text-slate-600 hover:text-red-400 text-sm"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/transactions/RulesModal.test.tsx --no-coverage
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/transactions/RulesModal.tsx src/components/transactions/RulesModal.test.tsx
git commit -m "feat: add RulesModal component"
```

---

### Task 5: Transactions page

**Files:**
- Modify: `src/app/(app)/transactions/page.tsx` (replace placeholder)
- Create: `src/app/(app)/transactions/page.test.tsx`

**Context:**
Currently `src/app/(app)/transactions/page.tsx` contains only a placeholder `<h1>עסקאות</h1>`.

Imports needed:
- `getTransactions`, `updateTransaction`, `deleteTransaction` from `@/lib/firestore/transactions`
- `getCategories` from `@/lib/firestore/categories`
- `getRules`, `addRule`, `deleteRule` from `@/lib/firestore/categorization-rules`
- `TransactionRow` from `@/components/transactions/TransactionRow`
- `RulesModal` from `@/components/transactions/RulesModal`
- Types: `Transaction`, `Category`, `CategorizationRule` from `@/lib/types`

`addRule` signature: `addRule(rule: Omit<CategorizationRule, 'id'>): Promise<CategorizationRule>`

`CategorizationRule` type:
```typescript
{ id: string; keyword: string; matchType: 'contains' | 'exact' | 'startsWith'; categoryId: string; priority: number; createdAt: string }
```

Month utility functions (same pattern as dashboard page at `src/app/(app)/dashboard/page.tsx`):
```typescript
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
```

- [ ] **Step 1: Write the test**

Create `src/app/(app)/transactions/page.test.tsx`:
```typescript
const mockGetTransactions = jest.fn()
const mockGetCategories = jest.fn()
const mockGetRules = jest.fn()
const mockUpdateTransaction = jest.fn()
const mockDeleteTransaction = jest.fn()
const mockAddRule = jest.fn()
const mockDeleteRule = jest.fn()

jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: (...a: unknown[]) => mockGetTransactions(...a),
  updateTransaction: (...a: unknown[]) => mockUpdateTransaction(...a),
  deleteTransaction: (...a: unknown[]) => mockDeleteTransaction(...a),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: (...a: unknown[]) => mockGetCategories(...a),
}))
jest.mock('@/lib/firestore/categorization-rules', () => ({
  getRules: (...a: unknown[]) => mockGetRules(...a),
  addRule: (...a: unknown[]) => mockAddRule(...a),
  deleteRule: (...a: unknown[]) => mockDeleteRule(...a),
}))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TransactionsPage from './page'
import type { Transaction, Category, CategorizationRule } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]
const txs: Transaction[] = [
  { id: 'tx1', date: '2026-06-15', merchantName: 'שופרסל', amount: 250, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
  { id: 'tx2', date: '2026-06-14', merchantName: 'רמי לוי', amount: 150, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06' },
]
const rules: CategorizationRule[] = []

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTransactions.mockResolvedValue(txs)
  mockGetCategories.mockResolvedValue(cats)
  mockGetRules.mockResolvedValue(rules)
})

describe('TransactionsPage', () => {
  it('shows loading state initially', () => {
    mockGetTransactions.mockImplementation(() => new Promise(() => {}))
    render(<TransactionsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('renders transactions after loading', async () => {
    render(<TransactionsPage />)
    await waitFor(() => expect(screen.getByText('שופרסל')).toBeInTheDocument())
    expect(screen.getByText('רמי לוי')).toBeInTheDocument()
  })

  it('shows uncategorized count in filter button', async () => {
    render(<TransactionsPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /ללא קטגוריה \(1\)/ })).toBeInTheDocument())
  })

  it('filters to uncategorized only when filter button clicked', async () => {
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    fireEvent.click(screen.getByRole('button', { name: /ללא קטגוריה/ }))
    expect(screen.queryByText('שופרסל')).not.toBeInTheDocument()
    expect(screen.getByText('רמי לוי')).toBeInTheDocument()
  })

  it('calls updateTransaction when category is changed', async () => {
    mockUpdateTransaction.mockResolvedValue(undefined)
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'c1' } })
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledWith('tx1', { categoryId: 'c1' }))
  })

  it('calls deleteTransaction and removes row on delete click', async () => {
    mockDeleteTransaction.mockResolvedValue(undefined)
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    const deleteButtons = screen.getAllByRole('button', { name: 'מחק עסקה' })
    fireEvent.click(deleteButtons[0])
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith('tx1'))
    await waitFor(() => expect(screen.queryByText('שופרסל')).not.toBeInTheDocument())
  })

  it('shows empty state when no transactions', async () => {
    mockGetTransactions.mockResolvedValue([])
    render(<TransactionsPage />)
    await waitFor(() => expect(screen.getByText('אין עסקאות בחודש זה')).toBeInTheDocument())
  })

  it('shows "כל העסקאות מקוטלגות!" when filter=uncategorized and all are categorized', async () => {
    mockGetTransactions.mockResolvedValue([txs[0]])
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    fireEvent.click(screen.getByRole('button', { name: /ללא קטגוריה/ }))
    expect(screen.getByText('כל העסקאות מקוטלגות!')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest "src/app/(app)/transactions/page.test.tsx" --no-coverage
```

Expected: FAIL — placeholder page doesn't implement the required behavior.

- [ ] **Step 3: Implement the Transactions page**

Overwrite `src/app/(app)/transactions/page.tsx` completely:
```typescript
'use client'
import { useState, useEffect } from 'react'
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { getRules, addRule, deleteRule } from '@/lib/firestore/categorization-rules'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { RulesModal } from '@/components/transactions/RulesModal'
import type { Transaction, Category, CategorizationRule } from '@/lib/types'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Filter = 'all' | 'uncategorized'

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [rulesOpen, setRulesOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    async function load() {
      try {
        const [txs, cats, rls] = await Promise.all([
          getTransactions(month),
          getCategories(),
          getRules(),
        ])
        setTransactions(txs)
        setCategories(cats)
        setRules(rls)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  async function handleCategoryChange(transactionId: string, categoryId: string | undefined) {
    await updateTransaction(transactionId, { categoryId })
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, categoryId } : t))
  }

  async function handleDelete(transactionId: string) {
    await deleteTransaction(transactionId)
    setTransactions(prev => prev.filter(t => t.id !== transactionId))
  }

  async function handleAddRule(rule: Omit<CategorizationRule, 'id'>) {
    const newRule = await addRule(rule)
    setRules(prev => [...prev, newRule])
  }

  async function handleDeleteRule(ruleId: string) {
    await deleteRule(ruleId)
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  const uncategorizedCount = transactions.filter(t => !t.categoryId).length
  const displayed = filter === 'uncategorized'
    ? transactions.filter(t => !t.categoryId)
    : transactions
  const total = displayed.reduce((s, t) => s + t.amount, 0)

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(m => addMonths(m, -1))} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => setMonth(m => addMonths(m, 1))} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full ${filter === 'all' ? 'bg-accent text-white' : 'bg-surface text-slate-400'}`}
          >הכל ({transactions.length})</button>
          <button
            onClick={() => setFilter('uncategorized')}
            className={`text-xs px-3 py-1.5 rounded-full ${filter === 'uncategorized' ? 'bg-amber-600 text-white' : 'bg-surface text-slate-400'}`}
          >ללא קטגוריה ({uncategorizedCount})</button>
        </div>
        <button onClick={() => setRulesOpen(true)} className="text-xs text-accent">חוקים</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {filter === 'uncategorized' ? 'כל העסקאות מקוטלגות!' : 'אין עסקאות בחודש זה'}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl px-4">
          {displayed.map(tx => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              categories={categories}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDelete}
            />
          ))}
          <div className="py-3 flex justify-between text-sm font-semibold border-t border-slate-700">
            <span>סה&quot;כ</span>
            <span className="tabular-nums">₪{total.toLocaleString('he-IL')}</span>
          </div>
        </div>
      )}

      <RulesModal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
        rules={rules}
        categories={categories}
        onAdd={handleAddRule}
        onDelete={handleDeleteRule}
      />
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest "src/app/(app)/transactions/page.test.tsx" --no-coverage
```

Expected: 8 tests pass.

- [ ] **Step 5: Run full test suite**

```
npx jest --no-coverage
```

Expected: All tests pass (was 154 before this plan; should now be 154 + new tests).

- [ ] **Step 6: Commit**

```
git add src/app/(app)/transactions/page.tsx src/app/(app)/transactions/page.test.tsx
git commit -m "feat: implement transactions page with filter, inline category editing, and rules modal"
```
