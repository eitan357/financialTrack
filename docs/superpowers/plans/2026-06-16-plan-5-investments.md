# Investments Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/investments` page — view and add monthly investment contributions and dividends, and manage investment type definitions.

**Architecture:** The page is a `'use client'` component with three sections: monthly contributions (investment entries), dividends, and investment type management. Each section has an inline add form toggled by a button. The page loads all data in parallel on mount and on month change.

**Tech Stack:** Next.js App Router (`'use client'`), Firebase Firestore, React, Tailwind CSS v4, Jest + React Testing Library

---

## File Structure

New files:
- `src/components/investments/AddInvestmentEntryForm.tsx` — form to add a monthly investment contribution
- `src/components/investments/AddInvestmentEntryForm.test.tsx`
- `src/components/investments/AddDividendForm.tsx` — form to add a dividend entry
- `src/components/investments/AddDividendForm.test.tsx`
- `src/components/investments/AddInvestmentTypeForm.tsx` — form to add a new investment type
- `src/components/investments/AddInvestmentTypeForm.test.tsx`
- `src/app/(app)/investments/page.test.tsx`

Modified files:
- `src/app/(app)/investments/page.tsx` — replace placeholder with full implementation

---

### Task 1: AddInvestmentEntryForm component

**Files:**
- Create: `src/components/investments/AddInvestmentEntryForm.tsx`
- Create: `src/components/investments/AddInvestmentEntryForm.test.tsx`

**Context:**
Form for adding a monthly investment contribution (e.g. depositing into Headstart). The user selects an investment type, enters an amount, and picks a date. Currency is derived from the selected investment type.

Relevant types from `src/lib/types/index.ts`:
```typescript
interface InvestmentType { id: string; name: string; currency: string; notes?: string }
interface InvestmentEntry {
  id: string
  date: string   // ISO YYYY-MM-DD
  month: string  // YYYY-MM
  investmentTypeId: string
  amount: number
  currency: string
  notes?: string
}
```

The `month` field of the entry is derived from the `date` field: `date.slice(0, 7)`.

- [ ] **Step 1: Write the test**

Create `src/components/investments/AddInvestmentEntryForm.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AddInvestmentEntryForm } from './AddInvestmentEntryForm'
import type { InvestmentType } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS' },
  { id: 't2', name: 'MSTY', currency: 'USD' },
]

describe('AddInvestmentEntryForm', () => {
  it('renders type select with all investment types', () => {
    render(<AddInvestmentEntryForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('הראל')).toBeInTheDocument()
    expect(screen.getByText('MSTY')).toBeInTheDocument()
  })

  it('renders amount input and date input', () => {
    render(<AddInvestmentEntryForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
    expect(screen.getByLabelText('תאריך')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn()
    render(<AddInvestmentEntryForm types={types} onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit with correct data when form submitted', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentEntryForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      investmentTypeId: 't1',
      amount: 500,
      currency: 'ILS',
      date: '2026-06-10',
      month: '2026-06',
    }))
  })

  it('does not call onSubmit when no type is selected', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentEntryForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/investments/AddInvestmentEntryForm.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement AddInvestmentEntryForm**

Create `src/components/investments/AddInvestmentEntryForm.tsx`:
```typescript
import { useState } from 'react'
import type { InvestmentType, InvestmentEntry } from '@/lib/types'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  types: InvestmentType[]
  onSubmit: (entry: Omit<InvestmentEntry, 'id'>) => void
  onCancel: () => void
}

export function AddInvestmentEntryForm({ types, onSubmit, onCancel }: Props) {
  const [typeId, setTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)

  const selectedType = types.find(t => t.id === typeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeId || !amount || !date || !selectedType) return
    onSubmit({
      investmentTypeId: typeId,
      amount: parseFloat(amount),
      currency: selectedType.currency,
      date,
      month: date.slice(0, 7),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div>
        <label htmlFor="inv-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
        <select
          id="inv-type"
          value={typeId}
          onChange={e => setTypeId(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="">בחר סוג...</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.currency})</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="inv-amount" className="text-xs text-slate-400 block mb-1">סכום</label>
          <input
            id="inv-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="inv-date" className="text-xs text-slate-400 block mb-1">תאריך</label>
          <input
            id="inv-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" className="bg-accent text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40" disabled={!typeId || !amount}>הוסף</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/investments/AddInvestmentEntryForm.test.tsx --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/investments/AddInvestmentEntryForm.tsx src/components/investments/AddInvestmentEntryForm.test.tsx
git commit -m "feat: add AddInvestmentEntryForm component"
```

---

### Task 2: AddDividendForm component

**Files:**
- Create: `src/components/investments/AddDividendForm.tsx`
- Create: `src/components/investments/AddDividendForm.test.tsx`

**Context:**
Form for adding a dividend receipt. The user picks the investment type, enters the foreign amount and currency (auto-filled from type), and optionally enters the ILS equivalent.

Relevant type:
```typescript
interface Dividend {
  id: string
  month: string          // YYYY-MM
  investmentTypeId: string
  amount: number
  currency: string
  ilsEquivalent?: number
  date: string           // ISO YYYY-MM-DD
  notes?: string
}
```

- [ ] **Step 1: Write the test**

Create `src/components/investments/AddDividendForm.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AddDividendForm } from './AddDividendForm'
import type { InvestmentType } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'MSTY', currency: 'USD' },
]

describe('AddDividendForm', () => {
  it('renders all required fields', () => {
    render(<AddDividendForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
    expect(screen.getByLabelText('תאריך')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn()
    render(<AddDividendForm types={types} onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit with correct data including ilsEquivalent', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '45.5' } })
    fireEvent.change(screen.getByLabelText('שווי ב-₪'), { target: { value: '165' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      investmentTypeId: 't1',
      amount: 45.5,
      currency: 'USD',
      ilsEquivalent: 165,
      date: '2026-06-10',
      month: '2026-06',
    }))
  })

  it('calls onSubmit without ilsEquivalent when ILS field is empty', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '45.5' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    const call = onSubmit.mock.calls[0][0]
    expect(call.ilsEquivalent).toBeUndefined()
  })

  it('does not call onSubmit when no type or amount', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/investments/AddDividendForm.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement AddDividendForm**

Create `src/components/investments/AddDividendForm.tsx`:
```typescript
import { useState } from 'react'
import type { InvestmentType, Dividend } from '@/lib/types'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  types: InvestmentType[]
  onSubmit: (dividend: Omit<Dividend, 'id'>) => void
  onCancel: () => void
}

export function AddDividendForm({ types, onSubmit, onCancel }: Props) {
  const [typeId, setTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [ilsEquivalent, setIlsEquivalent] = useState('')
  const [date, setDate] = useState(todayISO)

  const selectedType = types.find(t => t.id === typeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeId || !amount || !date || !selectedType) return
    const result: Omit<Dividend, 'id'> = {
      investmentTypeId: typeId,
      amount: parseFloat(amount),
      currency: selectedType.currency,
      date,
      month: date.slice(0, 7),
    }
    if (ilsEquivalent) result.ilsEquivalent = parseFloat(ilsEquivalent)
    onSubmit(result)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div>
        <label htmlFor="div-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
        <select
          id="div-type"
          value={typeId}
          onChange={e => setTypeId(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="">בחר סוג...</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.currency})</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="div-amount" className="text-xs text-slate-400 block mb-1">סכום</label>
          <input
            id="div-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="div-ils" className="text-xs text-slate-400 block mb-1">שווי ב-₪</label>
          <input
            id="div-ils"
            type="number"
            min="0"
            step="0.01"
            value={ilsEquivalent}
            onChange={e => setIlsEquivalent(e.target.value)}
            placeholder="אופציונלי"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>
      <div>
        <label htmlFor="div-date" className="text-xs text-slate-400 block mb-1">תאריך</label>
        <input
          id="div-date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" className="bg-accent text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40" disabled={!typeId || !amount}>הוסף</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/investments/AddDividendForm.test.tsx --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/investments/AddDividendForm.tsx src/components/investments/AddDividendForm.test.tsx
git commit -m "feat: add AddDividendForm component"
```

---

### Task 3: AddInvestmentTypeForm component

**Files:**
- Create: `src/components/investments/AddInvestmentTypeForm.tsx`
- Create: `src/components/investments/AddInvestmentTypeForm.test.tsx`

**Context:**
Simple form for adding a new investment type (e.g. "MSTY" with currency "USD").

`InvestmentType` type:
```typescript
interface InvestmentType { id: string; name: string; currency: string; notes?: string }
```

- [ ] **Step 1: Write the test**

Create `src/components/investments/AddInvestmentTypeForm.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AddInvestmentTypeForm } from './AddInvestmentTypeForm'

describe('AddInvestmentTypeForm', () => {
  it('renders name and currency inputs', () => {
    render(<AddInvestmentTypeForm onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('שם')).toBeInTheDocument()
    expect(screen.getByLabelText('מטבע')).toBeInTheDocument()
  })

  it('defaults currency to USD', () => {
    render(<AddInvestmentTypeForm onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('מטבע')).toHaveValue('USD')
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = jest.fn()
    render(<AddInvestmentTypeForm onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit with name and currency when submitted', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentTypeForm onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('שם'), { target: { value: 'MSTY' } })
    fireEvent.change(screen.getByLabelText('מטבע'), { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'MSTY', currency: 'USD' })
  })

  it('does not call onSubmit when name is empty', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentTypeForm onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/components/investments/AddInvestmentTypeForm.test.tsx --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement AddInvestmentTypeForm**

Create `src/components/investments/AddInvestmentTypeForm.tsx`:
```typescript
import { useState } from 'react'
import type { InvestmentType } from '@/lib/types'

interface Props {
  onSubmit: (type: Omit<InvestmentType, 'id'>) => void
  onCancel: () => void
}

export function AddInvestmentTypeForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !currency.trim()) return
    onSubmit({ name: name.trim(), currency: currency.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="type-name" className="text-xs text-slate-400 block mb-1">שם</label>
          <input
            id="type-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="למשל: MSTY"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="type-currency" className="text-xs text-slate-400 block mb-1">מטבע</label>
          <input
            id="type-currency"
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            placeholder="USD"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" disabled={!name.trim()} className="bg-accent text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40">הוסף</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/components/investments/AddInvestmentTypeForm.test.tsx --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/investments/AddInvestmentTypeForm.tsx src/components/investments/AddInvestmentTypeForm.test.tsx
git commit -m "feat: add AddInvestmentTypeForm component"
```

---

### Task 4: Investments page

**Files:**
- Modify: `src/app/(app)/investments/page.tsx` (replace placeholder)
- Create: `src/app/(app)/investments/page.test.tsx`

**Context:**
Currently `src/app/(app)/investments/page.tsx` contains only a placeholder `<h1>השקעות ודיבידנדים</h1>`.

Firestore imports to use:
- `getInvestmentTypes`, `addInvestmentType`, `getInvestmentEntries`, `addInvestmentEntry` from `@/lib/firestore/investments`
- `getDividends`, `addDividend` from `@/lib/firestore/dividends`

Form component imports:
- `AddInvestmentEntryForm` from `@/components/investments/AddInvestmentEntryForm`
- `AddDividendForm` from `@/components/investments/AddDividendForm`
- `AddInvestmentTypeForm` from `@/components/investments/AddInvestmentTypeForm`

Types: `InvestmentType`, `InvestmentEntry`, `Dividend` from `@/lib/types`

Month utility functions (same as other pages):
```typescript
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function currentMonth(): string { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }
function formatMonth(m: string): string { const [y, mo] = m.split('-'); return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}` }
function addMonths(m: string, delta: number): string { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
```

- [ ] **Step 1: Write the test**

Create `src/app/(app)/investments/page.test.tsx`:
```typescript
const mockGetInvestmentTypes = jest.fn()
const mockAddInvestmentType = jest.fn()
const mockGetInvestmentEntries = jest.fn()
const mockAddInvestmentEntry = jest.fn()
const mockGetDividends = jest.fn()
const mockAddDividend = jest.fn()

jest.mock('@/lib/firestore/investments', () => ({
  getInvestmentTypes: (...a: unknown[]) => mockGetInvestmentTypes(...a),
  addInvestmentType: (...a: unknown[]) => mockAddInvestmentType(...a),
  getInvestmentEntries: (...a: unknown[]) => mockGetInvestmentEntries(...a),
  addInvestmentEntry: (...a: unknown[]) => mockAddInvestmentEntry(...a),
}))
jest.mock('@/lib/firestore/dividends', () => ({
  getDividends: (...a: unknown[]) => mockGetDividends(...a),
  addDividend: (...a: unknown[]) => mockAddDividend(...a),
}))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import InvestmentsPage from './page'
import type { InvestmentType, InvestmentEntry, Dividend } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS' },
]
const entries: InvestmentEntry[] = [
  { id: 'e1', date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 1000, currency: 'ILS' },
]
const dividends: Dividend[] = [
  { id: 'd1', month: '2026-06', investmentTypeId: 't1', amount: 45, currency: 'USD', ilsEquivalent: 165, date: '2026-06-10' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInvestmentTypes.mockResolvedValue(types)
  mockGetInvestmentEntries.mockResolvedValue(entries)
  mockGetDividends.mockResolvedValue(dividends)
})

describe('InvestmentsPage', () => {
  it('shows loading state initially', () => {
    mockGetInvestmentTypes.mockImplementation(() => new Promise(() => {}))
    render(<InvestmentsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows investment entries after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getByText('הראל')).toBeInTheDocument())
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
  })

  it('shows dividends after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getByText(/45/)).toBeInTheDocument())
    expect(screen.getByText(/165/)).toBeInTheDocument()
  })

  it('shows add entry form when "הוסף תרומה" is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => screen.getByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תרומה' }))
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
  })

  it('shows add dividend form when "הוסף דיבידנד" is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => screen.getByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: 'הוסף דיבידנד' }))
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
  })

  it('calls addInvestmentEntry and updates list on submit', async () => {
    const newEntry: InvestmentEntry = { id: 'e2', date: '2026-06-15', month: '2026-06', investmentTypeId: 't1', amount: 500, currency: 'ILS' }
    mockAddInvestmentEntry.mockResolvedValue(newEntry)
    render(<InvestmentsPage />)
    await waitFor(() => screen.getByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תרומה' }))
    fireEvent.change(screen.getByRole('combobox', { name: /סוג/ }), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    await waitFor(() => expect(mockAddInvestmentEntry).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest "src/app/(app)/investments/page.test.tsx" --no-coverage
```

Expected: FAIL — placeholder page doesn't implement required behavior.

- [ ] **Step 3: Implement the Investments page**

Overwrite `src/app/(app)/investments/page.tsx` completely:
```typescript
'use client'
import { useState, useEffect } from 'react'
import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry } from '@/lib/firestore/investments'
import { getDividends, addDividend } from '@/lib/firestore/dividends'
import { AddInvestmentEntryForm } from '@/components/investments/AddInvestmentEntryForm'
import { AddDividendForm } from '@/components/investments/AddDividendForm'
import { AddInvestmentTypeForm } from '@/components/investments/AddInvestmentTypeForm'
import type { InvestmentType, InvestmentEntry, Dividend } from '@/lib/types'

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

export default function InvestmentsPage() {
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showAddDividend, setShowAddDividend] = useState(false)
  const [showAddType, setShowAddType] = useState(false)

  useEffect(() => {
    setLoading(true)
    async function load() {
      try {
        const [types, ents, divs] = await Promise.all([
          getInvestmentTypes(),
          getInvestmentEntries(month),
          getDividends(month),
        ])
        setInvestmentTypes(types)
        setEntries(ents)
        setDividends(divs)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  async function handleAddEntry(entry: Omit<InvestmentEntry, 'id'>) {
    const newEntry = await addInvestmentEntry(entry)
    setEntries(prev => [...prev, newEntry])
    setShowAddEntry(false)
  }

  async function handleAddDividend(dividend: Omit<Dividend, 'id'>) {
    const newDividend = await addDividend(dividend)
    setDividends(prev => [...prev, newDividend])
    setShowAddDividend(false)
  }

  async function handleAddType(type: Omit<InvestmentType, 'id'>) {
    const newType = await addInvestmentType(type)
    setInvestmentTypes(prev => [...prev, newType])
    setShowAddType(false)
  }

  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))
  const totalEntries = entries.reduce((s, e) => s + e.amount, 0)
  const totalDividendsILS = dividends.reduce((s, d) => s + (d.ilsEquivalent ?? 0), 0)

  return (
    <main className="p-4 max-w-lg mx-auto pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(m => addMonths(m, -1))} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => setMonth(m => addMonths(m, 1))} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : (
        <>
          {/* Investment Entries Section */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">תרומות החודש</h2>
              <div className="flex items-center gap-3">
                {totalEntries > 0 && <span className="text-sm font-mono tabular-nums text-accent">₪{totalEntries.toLocaleString('he-IL')}</span>}
                <button onClick={() => setShowAddEntry(v => !v)} aria-label="הוסף תרומה" className="text-xs text-accent">
                  {showAddEntry ? 'ביטול' : '+ הוסף תרומה'}
                </button>
              </div>
            </div>
            {showAddEntry && (
              <div className="mb-3">
                <AddInvestmentEntryForm types={investmentTypes} onSubmit={handleAddEntry} onCancel={() => setShowAddEntry(false)} />
              </div>
            )}
            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {entries.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין תרומות החודש</p>
              ) : entries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
                    <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
                  </div>
                  <span className="text-sm tabular-nums">{e.amount.toLocaleString('he-IL')} {e.currency}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Dividends Section */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">דיבידנדים החודש</h2>
              <div className="flex items-center gap-3">
                {totalDividendsILS > 0 && <span className="text-sm font-mono tabular-nums text-green-400">₪{totalDividendsILS.toLocaleString('he-IL')}</span>}
                <button onClick={() => setShowAddDividend(v => !v)} aria-label="הוסף דיבידנד" className="text-xs text-accent">
                  {showAddDividend ? 'ביטול' : '+ הוסף דיבידנד'}
                </button>
              </div>
            </div>
            {showAddDividend && (
              <div className="mb-3">
                <AddDividendForm types={investmentTypes} onSubmit={handleAddDividend} onCancel={() => setShowAddDividend(false)} />
              </div>
            )}
            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {dividends.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין דיבידנדים החודש</p>
              ) : dividends.map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm">{typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId}</span>
                    <span className="text-xs text-slate-500 mr-2">{d.date.slice(5).replace('-', '/')}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-sm tabular-nums">{d.amount.toLocaleString('he-IL')} {d.currency}</span>
                    {d.ilsEquivalent && <span className="text-xs text-slate-400 block">₪{d.ilsEquivalent.toLocaleString('he-IL')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Investment Types Section */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">סוגי השקעות</h2>
              <button onClick={() => setShowAddType(v => !v)} aria-label="הוסף סוג" className="text-xs text-accent">
                {showAddType ? 'ביטול' : '+ הוסף סוג'}
              </button>
            </div>
            {showAddType && (
              <div className="mb-3">
                <AddInvestmentTypeForm onSubmit={handleAddType} onCancel={() => setShowAddType(false)} />
              </div>
            )}
            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {investmentTypes.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין סוגי השקעות עדיין</p>
              ) : investmentTypes.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">{t.name}</span>
                  <span className="text-xs text-slate-400">{t.currency}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest "src/app/(app)/investments/page.test.tsx" --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

```
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add src/app/(app)/investments/page.tsx src/app/(app)/investments/page.test.tsx
git commit -m "feat: implement investments page with entries, dividends, and type management"
```
