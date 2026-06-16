# Dynamic Credit Accounts in ImportWizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded "אשראי בהצדעה" and "אשראי One Zero" in the ImportWizard with a dynamic list of credit accounts fetched from Firestore, so any number of credit cards works automatically.

**Architecture:** Filter accounts by `type === 'credit' && isActive` after loading. Store credit transactions as `creditTransactions: {accountId, accountName, transactions}[]` (one entry per credit account). Generate credit import steps dynamically (steps 1..N), followed by fixed steps for salary, income, cash, summary (N+1..N+4). Update SummaryStep to accept the new data shape.

**Tech Stack:** TypeScript, React, Next.js App Router, Firebase Firestore, Tailwind CSS v4, Jest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/import/ImportWizard.tsx` | Modify | Dynamic credit steps, new WizardData shape |
| `src/components/import/steps/SummaryStep.tsx` | Modify | Accept credit array instead of hardcoded account IDs |
| `src/components/import/steps/SummaryStep.test.tsx` | Modify | Update tests for new props |
| `src/components/import/ImportWizard.test.tsx` | Modify | Update tests for new WizardData shape if needed |

---

## Task 1: Refactor SummaryStep to use dynamic credit data

**Files:**
- Modify: `src/components/import/steps/SummaryStep.tsx`
- Modify: `src/components/import/steps/SummaryStep.test.tsx`

The `SummaryStep` currently has:
```typescript
interface WizardData {
  step1Transactions: ImportedTransaction[]
  step2Transactions: ImportedTransaction[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}
interface Props {
  month: string
  data: WizardData
  hatzlaadaAccountId: string
  oneZeroAccountId: string
  cashAccountId: string
  onDone: () => void
}
```

Replace with:
```typescript
export interface CreditAccountData {
  accountId: string
  accountName: string
  transactions: ImportedTransaction[]
}
export interface WizardData {
  creditAccounts: CreditAccountData[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}
interface Props {
  month: string
  data: WizardData
  cashAccountId: string
  onDone: () => void
}
```

Note: Export `CreditAccountData` and `WizardData` from SummaryStep so ImportWizard can import them.

New save logic:
```typescript
const allCreditTxs = data.creditAccounts.flatMap(ca =>
  ca.transactions.map(t => toTx(t, ca.accountId, month, 'xlsx_import'))
)
const allTxs: Omit<Transaction, 'id'>[] = [
  ...allCreditTxs,
  ...data.cashExpenses.map(e => ({
    date: e.date, merchantName: e.description, amount: e.amount, currency: 'ILS',
    accountId: cashAccountId, categoryId: e.categoryId ?? undefined,
    source: 'manual' as TransactionSource, isImmediate: true, month,
  })),
]
```

New summary rows for credit accounts:
```typescript
{data.creditAccounts.map(ca => (
  <div key={ca.accountId} className="flex justify-between bg-surface rounded-xl px-4 py-3">
    <span className="text-sm">עסקאות {ca.accountName}</span>
    <span className="text-sm text-slate-400">{ca.transactions.length} פריטים</span>
  </div>
))}
```

Fixed rows for income and cash (keep as is):
```typescript
{[
  ['הכנסות נוספות', data.incomeEntries.length],
  ['הוצאות מזומן', data.cashExpenses.length],
].map(([label, count]) => (
  <div key={label as string} className="flex justify-between bg-surface rounded-xl px-4 py-3">
    <span className="text-sm">{label}</span>
    <span className="text-sm text-slate-400">{count} פריטים</span>
  </div>
))}
```

Success message total count:
```typescript
const totalCreditTxs = data.creditAccounts.reduce((s, ca) => s + ca.transactions.length, 0)
// Then: {totalCreditTxs + data.cashExpenses.length} עסקאות יובאו
```

- [ ] **Step 1: Write the failing tests**

Replace the content of `src/components/import/steps/SummaryStep.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SummaryStep } from './SummaryStep'

jest.mock('@/lib/firestore/transactions', () => ({ addTransactions: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/firestore/salary', () => ({ upsertSalaryEntry: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/firestore/income', () => ({ addIncomeEntry: jest.fn().mockResolvedValue({ id: 'i1' }) }))

const mockImportedTx = {
  date: '2026-06-01', merchantName: 'שופרסל', bankCategory: '', amount: 150,
  currency: 'ILS', isImmediate: false, notes: '', categoryId: 'c1', categorizationSource: 'rule' as const,
}

const baseProps = {
  month: '2026-06',
  data: {
    creditAccounts: [
      { accountId: 'a1', accountName: 'אשראי בהצדעה', transactions: [mockImportedTx] },
      { accountId: 'a2', accountName: 'אשראי One Zero', transactions: [] },
    ],
    salary: null,
    incomeEntries: [],
    cashExpenses: [],
  },
  cashAccountId: 'a5',
  onDone: jest.fn(),
}

describe('SummaryStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('displays a row for each credit account', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('עסקאות אשראי בהצדעה')).toBeInTheDocument()
    expect(screen.getByText('עסקאות אשראי One Zero')).toBeInTheDocument()
  })

  it('displays fixed rows for income and cash', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('הכנסות נוספות')).toBeInTheDocument()
    expect(screen.getByText('הוצאות מזומן')).toBeInTheDocument()
  })

  it('shows the Save button', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('שמור הכל')).toBeInTheDocument()
  })

  it('calls addTransactions with correct accountId per credit account', async () => {
    const { addTransactions } = require('@/lib/firestore/transactions')
    render(<SummaryStep {...baseProps} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => expect(addTransactions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ merchantName: 'שופרסל', accountId: 'a1' })])
    ))
  })

  it('shows success screen after saving', async () => {
    render(<SummaryStep {...baseProps} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => expect(screen.getByText('הנתונים נשמרו בהצלחה!')).toBeInTheDocument())
  })

  it('calls onDone after success when button clicked', async () => {
    const onDone = jest.fn()
    render(<SummaryStep {...baseProps} onDone={onDone} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => screen.getByText('חזור לייבוא'))
    fireEvent.click(screen.getByText('חזור לייבוא'))
    expect(onDone).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest src/components/import/steps/SummaryStep.test.tsx --no-coverage
```
Expected: FAIL (props mismatch)

- [ ] **Step 3: Implement the new SummaryStep**

Replace `src/components/import/steps/SummaryStep.tsx` in full:

```typescript
'use client'
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { addTransactions } from '@/lib/firestore/transactions'
import { upsertSalaryEntry } from '@/lib/firestore/salary'
import { addIncomeEntry } from '@/lib/firestore/income'
import type { ImportedTransaction, SalaryEntry, IncomeEntry, Transaction, TransactionSource } from '@/lib/types'
import type { CashExpense } from '../ImportWizard'

export interface CreditAccountData {
  accountId: string
  accountName: string
  transactions: ImportedTransaction[]
}

export interface WizardData {
  creditAccounts: CreditAccountData[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}

interface Props {
  month: string
  data: WizardData
  cashAccountId: string
  onDone: () => void
}

function toTx(t: ImportedTransaction, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  return {
    date: t.date, merchantName: t.merchantName, description: t.notes || undefined,
    amount: t.amount, currency: t.currency, accountId,
    categoryId: t.categoryId ?? undefined, source, isImmediate: t.isImmediate, month,
  }
}

export function SummaryStep({ month, data, cashAccountId, onDone }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const allTxs: Omit<Transaction, 'id'>[] = [
        ...data.creditAccounts.flatMap(ca =>
          ca.transactions.map(t => toTx(t, ca.accountId, month, 'xlsx_import'))
        ),
        ...data.cashExpenses.map(e => ({
          date: e.date, merchantName: e.description, amount: e.amount, currency: 'ILS',
          accountId: cashAccountId, categoryId: e.categoryId ?? undefined,
          source: 'manual' as TransactionSource, isImmediate: true, month,
        })),
      ]
      await addTransactions(allTxs)
      if (data.salary) await upsertSalaryEntry(data.salary)
      for (const entry of data.incomeEntries) await addIncomeEntry(entry)
      setSaved(true)
    } catch {
      setError('שגיאה בשמירת הנתונים. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  const totalCreditTxs = data.creditAccounts.reduce((s, ca) => s + ca.transactions.length, 0)

  if (saved) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">הנתונים נשמרו בהצלחה!</h2>
        <p className="text-slate-400 text-sm mb-6">
          {totalCreditTxs + data.cashExpenses.length} עסקאות יובאו
        </p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לייבוא</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">סיכום — מה ייובא?</h2>
      <div className="space-y-2 mb-6">
        {data.creditAccounts.map(ca => (
          <div key={ca.accountId} className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">עסקאות {ca.accountName}</span>
            <span className="text-sm text-slate-400">{ca.transactions.length} פריטים</span>
          </div>
        ))}
        {[
          ['הכנסות נוספות', data.incomeEntries.length] as const,
          ['הוצאות מזומן', data.cashExpenses.length] as const,
        ].map(([label, count]) => (
          <div key={label} className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">{label}</span>
            <span className="text-sm text-slate-400">{count} פריטים</span>
          </div>
        ))}
        {data.salary && (
          <div className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">משכורת</span>
            <span className="text-sm tabular-nums">{data.salary.netAmount.toLocaleString('he-IL')} ₪ נטו</span>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50">
        {saving ? 'שומר...' : 'שמור הכל'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest src/components/import/steps/SummaryStep.test.tsx --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```
git add src/components/import/steps/SummaryStep.tsx src/components/import/steps/SummaryStep.test.tsx
git commit -m "refactor: dynamic credit accounts in SummaryStep"
```

---

## Task 2: Refactor ImportWizard to use dynamic credit steps

**Files:**
- Modify: `src/components/import/ImportWizard.tsx`
- Modify: `src/components/import/ImportWizard.test.tsx`

The ImportWizard currently:
- Hardcodes 2 credit steps for specific account names
- Uses `WizardData.step1Transactions` and `step2Transactions`

After refactor:
- `creditAccounts = accounts.filter(a => a.type === 'credit' && a.isActive)`
- Step N (1-based) = credit card N-1 (0-indexed)
- Steps after credit = `creditAccounts.length + 1` (salary), `+2` (income), `+3` (cash), `+4` (summary)
- `WizardData.creditAccounts: CreditAccountData[]` replaces step1/step2 transactions
- Total steps shown in "שלב X מתוך Y" = `creditAccounts.length + 4`

Import the exported types from SummaryStep:
```typescript
import { SummaryStep, type WizardData, type CreditAccountData } from './steps/SummaryStep'
```

Remove the old `CashExpense` export from ImportWizard and keep it there (it's already exported and used by SummaryStep's import).

Wait — `CashExpense` is defined in `ImportWizard.tsx` and imported by `SummaryStep.tsx`. Keep `CashExpense` in `ImportWizard.tsx`. Import `WizardData` and `CreditAccountData` from `SummaryStep.tsx` into `ImportWizard.tsx`.

New state:
```typescript
const [data, setData] = useState<WizardData>({
  creditAccounts: [], salary: null, incomeEntries: [], cashExpenses: [],
})
```

Derived constants (compute inside the component after accounts are loaded):
```typescript
const creditAccounts = accounts.filter(a => a.type === 'credit' && a.isActive)
const SALARY_STEP = creditAccounts.length + 1
const INCOME_STEP = creditAccounts.length + 2
const CASH_STEP = creditAccounts.length + 3
const SUMMARY_STEP = creditAccounts.length + 4
const TOTAL_STEPS = creditAccounts.length + 4
```

The WizardStep type should accommodate any number: change from `type WizardStep = 1 | 2 | 3 | 4 | 5 | 6` to `type WizardStep = number`.

Step rendering:
```typescript
{creditAccounts.map((account, idx) => (
  step === idx + 1 && (
    <CreditImportStep
      key={account.id}
      stepNumber={idx + 1}
      accountName={account.name}
      accountId={account.id}
      categories={categories}
      rules={rules}
      previousTransactions={previousTransactions}
      initialTransactions={data.creditAccounts[idx]?.transactions ?? []}
      onComplete={txs => {
        const next: CreditAccountData[] = [...data.creditAccounts]
        next[idx] = { accountId: account.id, accountName: account.name, transactions: txs }
        setData(d => ({ ...d, creditAccounts: next }))
        setStep(idx + 2)
      }}
      onSkip={() => setStep(idx + 2)}
      onBack={idx > 0 ? () => setStep(idx) : undefined}
    />
  )
))}
{step === SALARY_STEP && (
  <SalaryStep ... onBack={() => setStep(creditAccounts.length)} />
)}
{step === INCOME_STEP && (
  <IncomeStep ... onBack={() => setStep(SALARY_STEP)} />
)}
{step === CASH_STEP && (
  <CashStep ... onBack={() => setStep(INCOME_STEP)} />
)}
{step === SUMMARY_STEP && (
  <SummaryStep month={month} data={data} cashAccountId={cash?.id ?? ''} onDone={() => {
    setStep(1)
    setData({ creditAccounts: [], salary: null, incomeEntries: [], cashExpenses: [] })
  }} />
)}
```

The step counter display:
```typescript
{step < SUMMARY_STEP && (
  <p className="text-center text-sm text-slate-400 mb-4">שלב {step} מתוך {TOTAL_STEPS - 1}</p>
)}
```

The `changeMonth` reset:
```typescript
setData({ creditAccounts: [], salary: null, incomeEntries: [], cashExpenses: [] })
```

Remove these no-longer-needed variables:
```typescript
// DELETE these:
const hatzlaada = accounts.find(a => a.name === 'אשראי בהצדעה')
const oneZero   = accounts.find(a => a.name === 'אשראי One Zero')
```

Keep `cash`:
```typescript
const cash = accounts.find(a => a.name === 'מזומן')
```

- [ ] **Step 1: Read the current ImportWizard.test.tsx to understand what needs updating**

Read `src/components/import/ImportWizard.test.tsx` and identify any assertions that reference `step1Transactions`, `step2Transactions`, `hatzlaadaAccountId`, or `oneZeroAccountId`.

- [ ] **Step 2: Update ImportWizard.test.tsx**

The ImportWizard test mocks accounts and renders the wizard. Check what assertions exist and update any that reference the old data shape. Typically ImportWizard tests check step navigation and rendering, not the internal WizardData shape directly.

- [ ] **Step 3: Implement the new ImportWizard**

Full file content for `src/components/import/ImportWizard.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { seedDefaultAccounts, getAccounts } from '@/lib/firestore/accounts'
import { seedDefaultCategories, getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntry } from '@/lib/firestore/salary'
import { CreditImportStep } from './steps/CreditImportStep'
import { SalaryStep } from './steps/SalaryStep'
import { IncomeStep } from './steps/IncomeStep'
import { CashStep } from './steps/CashStep'
import { SummaryStep, type WizardData, type CreditAccountData } from './steps/SummaryStep'
import type { Account, Category, CategorizationRule, SalaryEntry, IncomeEntry, Transaction } from '@/lib/types'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface CashExpense {
  description: string
  amount: number
  date: string
  categoryId: string | null
}

const EMPTY_DATA: WizardData = { creditAccounts: [], salary: null, incomeEntries: [], cashExpenses: [] }

export function ImportWizard() {
  const [month, setMonth] = useState(currentMonth)
  const [step, setStep] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)
  const [data, setData] = useState<WizardData>(EMPTY_DATA)

  useEffect(() => {
    setLoading(true)
    async function init() {
      try {
        await Promise.all([seedDefaultAccounts(), seedDefaultCategories()])
        const [accs, cats, rls, txs, prevSal] = await Promise.all([
          getAccounts(),
          getCategories(),
          getRules(),
          getTransactions(month),
          getSalaryEntry(prevMonthStr(month)),
        ])
        setAccounts(accs)
        setCategories(cats)
        setRules(rls)
        setPreviousTransactions(txs)
        if (prevSal) {
          const { id: _id, ...rest } = prevSal
          setPreviousSalary(rest)
        }
      } catch (e) {
        console.error('Failed to initialize import wizard', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [month])

  function changeMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setStep(1)
    setData(EMPTY_DATA)
  }

  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.isActive)
  const cash = accounts.find(a => a.name === 'מזומן')

  const SALARY_STEP  = creditAccounts.length + 1
  const INCOME_STEP  = creditAccounts.length + 2
  const CASH_STEP    = creditAccounts.length + 3
  const SUMMARY_STEP = creditAccounts.length + 4
  const TOTAL_STEPS  = creditAccounts.length + 4

  if (loading) {
    return <main className="p-4 flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></main>
  }

  return (
    <main className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => changeMonth(-1)} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => changeMonth(1)} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      {step < SUMMARY_STEP && (
        <p className="text-center text-sm text-slate-400 mb-4">שלב {step} מתוך {TOTAL_STEPS - 1}</p>
      )}

      {creditAccounts.map((account, idx) =>
        step === idx + 1 ? (
          <CreditImportStep
            key={account.id}
            stepNumber={idx + 1}
            accountName={account.name}
            accountId={account.id}
            categories={categories}
            rules={rules}
            previousTransactions={previousTransactions}
            initialTransactions={data.creditAccounts[idx]?.transactions ?? []}
            onComplete={txs => {
              const next: CreditAccountData[] = [...data.creditAccounts]
              next[idx] = { accountId: account.id, accountName: account.name, transactions: txs }
              setData(d => ({ ...d, creditAccounts: next }))
              setStep(idx + 2)
            }}
            onSkip={() => setStep(idx + 2)}
            onBack={idx > 0 ? () => setStep(idx) : undefined}
          />
        ) : null
      )}

      {step === SALARY_STEP && (
        <SalaryStep month={month} initialSalary={data.salary ?? previousSalary}
          onComplete={sal => { setData(d => ({ ...d, salary: sal })); setStep(INCOME_STEP) }}
          onSkip={() => setStep(INCOME_STEP)} onBack={() => setStep(creditAccounts.length)} />
      )}
      {step === INCOME_STEP && (
        <IncomeStep month={month} initialEntries={data.incomeEntries}
          onComplete={entries => { setData(d => ({ ...d, incomeEntries: entries })); setStep(CASH_STEP) }}
          onBack={() => setStep(SALARY_STEP)} />
      )}
      {step === CASH_STEP && (
        <CashStep month={month} categories={categories} initialExpenses={data.cashExpenses}
          onComplete={expenses => { setData(d => ({ ...d, cashExpenses: expenses })); setStep(SUMMARY_STEP) }}
          onBack={() => setStep(INCOME_STEP)} />
      )}
      {step === SUMMARY_STEP && (
        <SummaryStep month={month} data={data} cashAccountId={cash?.id ?? ''}
          onDone={() => { setStep(1); setData(EMPTY_DATA) }} />
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run the full test suite**

```
npx jest --no-coverage
```

Expected: All tests pass (same count as before or more).

If ImportWizard.test.tsx fails because it uses old props (like `hatzlaadaAccountId`), update those tests to match the new structure. The wizard test typically mocks accounts and checks step navigation — update mock accounts to include `type: 'credit'` and `isActive: true` fields and update any assertions about WizardData shape.

- [ ] **Step 5: Commit**

```
git add src/components/import/ImportWizard.tsx src/components/import/ImportWizard.test.tsx
git commit -m "refactor: dynamic credit accounts in ImportWizard"
```
