# Plan 3: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the main dashboard screen showing monthly income/expense/savings/investment summary, category progress bars, bank reconciliation status, and dividends card — all driven by a testable pure compute function.

**Architecture:** Four new Firestore services (dividends, investments, bank-reconciliations, monthly-settings) feed a pure `computeDashboard()` function that produces typed summary data. Four small display components render the cards. The dashboard page (`page.tsx`) is the only stateful container — it owns month selection and all data loading. The `'use client'` directive is needed only on `page.tsx` because it uses `useState`/`useEffect`.

**Tech Stack:** Next.js App Router (`'use client'` page), Firebase Firestore modular SDK v9, React, Tailwind CSS v4 (`bg-surface`, `text-accent` etc.), Jest + Testing Library

---

## Firestore mock pattern (used in every service test)

Every service test uses this identical block at the top (before imports, due to jest hoisting):

```typescript
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (...a: unknown[]) => mockDoc(...a),
  writeBatch: (...a: unknown[]) => mockWriteBatch(...a),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))
```

---

## File Structure

**New files:**
```
src/lib/firestore/
  dividends.ts                getDividends(month), addDividend()
  dividends.test.ts
  monthly-settings.ts         getMonthlySettings(month), upsertMonthlySettings()
  monthly-settings.test.ts
  investments.ts              getInvestmentTypes(), addInvestmentType(), getInvestmentEntries(month), addInvestmentEntry()
  investments.test.ts
  bank-reconciliations.ts     getBankReconciliations(month), saveBankReconciliation()
  bank-reconciliations.test.ts

src/lib/dashboard/
  compute.ts                  computeDashboard() — pure function, no side effects
  compute.test.ts

src/components/dashboard/
  SummaryCard.tsx             Single metric card (label + formatted amount)
  SummaryCard.test.tsx
  CategoryProgress.tsx        Progress bars per category (actual vs target)
  CategoryProgress.test.tsx
  BankReconciliationCard.tsx  Balance verification status card
  BankReconciliationCard.test.tsx
  DividendsCard.tsx           Dividends list card
  DividendsCard.test.tsx
```

**Modified files:**
```
src/lib/types/index.ts          Add month: string to InvestmentEntry
src/app/(app)/dashboard/page.tsx  Replace placeholder with full dashboard
```

---

### Task 1: Firestore — dividends + monthly settings

**Files:**
- Create: `src/lib/firestore/dividends.ts`
- Create: `src/lib/firestore/dividends.test.ts`
- Create: `src/lib/firestore/monthly-settings.ts`
- Create: `src/lib/firestore/monthly-settings.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/firestore/dividends.test.ts`:
```typescript
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (...a: unknown[]) => mockDoc(...a),
  writeBatch: (...a: unknown[]) => mockWriteBatch(...a),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

import { getDividends, addDividend } from './dividends'

beforeEach(() => jest.clearAllMocks())

const divData = { month: '2026-06', investmentTypeId: 'msty', amount: 150, currency: 'USD', ilsEquivalent: 555, date: '2026-06-15' }

describe('getDividends', () => {
  it('returns dividends for the month', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'd1', data: () => divData }] })
    const divs = await getDividends('2026-06')
    expect(divs[0]).toEqual({ id: 'd1', ...divData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })

  it('returns empty array when no dividends', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    expect(await getDividends('2026-06')).toEqual([])
  })
})

describe('addDividend', () => {
  it('adds dividend and returns it with generated id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'd2' })
    const result = await addDividend(divData)
    expect(result).toEqual({ id: 'd2', ...divData })
  })
})
```

`src/lib/firestore/monthly-settings.test.ts`:
```typescript
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (...a: unknown[]) => mockDoc(...a),
  writeBatch: (...a: unknown[]) => mockWriteBatch(...a),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

import { getMonthlySettings, upsertMonthlySettings } from './monthly-settings'

beforeEach(() => jest.clearAllMocks())

const settingsData = { month: '2026-06', categoryTargets: { c1: 1500, c2: 800 } }

describe('getMonthlySettings', () => {
  it('returns null when no settings for the month', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    expect(await getMonthlySettings('2026-06')).toBeNull()
  })

  it('returns settings when they exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 's1', data: () => settingsData }] })
    const result = await getMonthlySettings('2026-06')
    expect(result).toEqual({ id: 's1', ...settingsData })
  })
})

describe('upsertMonthlySettings', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await upsertMonthlySettings(settingsData)
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', settingsData, { merge: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/firestore/dividends.test.ts src/lib/firestore/monthly-settings.test.ts --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

`src/lib/firestore/dividends.ts`:
```typescript
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Dividend } from '../types'

function getDb() { return getFirestore(app) }

export async function getDividends(month: string): Promise<Dividend[]> {
  const q = query(collection(getDb(), 'dividends'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Dividend))
}

export async function addDividend(dividend: Omit<Dividend, 'id'>): Promise<Dividend> {
  const ref = await addDoc(collection(getDb(), 'dividends'), dividend)
  return { id: ref.id, ...dividend }
}
```

`src/lib/firestore/monthly-settings.ts`:
```typescript
import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { MonthlySettings } from '../types'

function getDb() { return getFirestore(app) }

export async function getMonthlySettings(month: string): Promise<MonthlySettings | null> {
  const q = query(collection(getDb(), 'monthly_settings'), where('month', '==', month))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as MonthlySettings
}

export async function upsertMonthlySettings(settings: Omit<MonthlySettings, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = settings
  const docRef = id
    ? doc(getDb(), 'monthly_settings', id)
    : doc(collection(getDb(), 'monthly_settings'))
  await setDoc(docRef, data, { merge: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/firestore/dividends.test.ts src/lib/firestore/monthly-settings.test.ts --no-coverage
```

Expected: PASS (5 tests: 3 dividends + 2 monthly-settings)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all prior tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/firestore/dividends.ts src/lib/firestore/dividends.test.ts src/lib/firestore/monthly-settings.ts src/lib/firestore/monthly-settings.test.ts
git commit -m "feat: add dividends and monthly-settings Firestore services"
```

---

### Task 2: Firestore — investments + type update

**Files:**
- Modify: `src/lib/types/index.ts` (add `month` field to `InvestmentEntry`)
- Create: `src/lib/firestore/investments.ts`
- Create: `src/lib/firestore/investments.test.ts`

- [ ] **Step 1: Add `month` field to `InvestmentEntry` in `src/lib/types/index.ts`**

Find the `InvestmentEntry` interface and replace it with:
```typescript
export interface InvestmentEntry {
  id: string
  date: string // ISO date string
  month: string // YYYY-MM, derived from date, used for Firestore queries
  investmentTypeId: string
  amount: number
  currency: string
  notes?: string
}
```

- [ ] **Step 2: Write the failing test**

`src/lib/firestore/investments.test.ts`:
```typescript
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (...a: unknown[]) => mockDoc(...a),
  writeBatch: (...a: unknown[]) => mockWriteBatch(...a),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry } from './investments'

beforeEach(() => jest.clearAllMocks())

describe('getInvestmentTypes', () => {
  it('returns all investment types', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 't1', data: () => ({ name: 'MSTY', currency: 'USD' }) }],
    })
    const types = await getInvestmentTypes()
    expect(types[0]).toEqual({ id: 't1', name: 'MSTY', currency: 'USD' })
  })
})

describe('addInvestmentType', () => {
  it('adds type and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 't2' })
    const result = await addInvestmentType({ name: 'Headstart', currency: 'ILS' })
    expect(result).toEqual({ id: 't2', name: 'Headstart', currency: 'ILS' })
  })
})

describe('getInvestmentEntries', () => {
  it('queries by month and maps docs', async () => {
    const entryData = { date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 5000, currency: 'ILS' }
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'e1', data: () => entryData }] })
    const entries = await getInvestmentEntries('2026-06')
    expect(entries[0]).toEqual({ id: 'e1', ...entryData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })
})

describe('addInvestmentEntry', () => {
  it('adds entry and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'e2' })
    const entry = { date: '2026-06-10', month: '2026-06', investmentTypeId: 't1', amount: 1000, currency: 'ILS' }
    const result = await addInvestmentEntry(entry)
    expect(result).toEqual({ id: 'e2', ...entry })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest src/lib/firestore/investments.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

`src/lib/firestore/investments.ts`:
```typescript
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { InvestmentType, InvestmentEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getInvestmentTypes(): Promise<InvestmentType[]> {
  const snap = await getDocs(collection(getDb(), 'investment_types'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentType))
}

export async function addInvestmentType(type: Omit<InvestmentType, 'id'>): Promise<InvestmentType> {
  const ref = await addDoc(collection(getDb(), 'investment_types'), type)
  return { id: ref.id, ...type }
}

export async function getInvestmentEntries(month: string): Promise<InvestmentEntry[]> {
  const q = query(collection(getDb(), 'investment_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentEntry))
}

export async function addInvestmentEntry(entry: Omit<InvestmentEntry, 'id'>): Promise<InvestmentEntry> {
  const ref = await addDoc(collection(getDb(), 'investment_entries'), entry)
  return { id: ref.id, ...entry }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/lib/firestore/investments.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/index.ts src/lib/firestore/investments.ts src/lib/firestore/investments.test.ts
git commit -m "feat: add investments Firestore service; add month field to InvestmentEntry type"
```

---

### Task 3: Firestore — bank reconciliations

**Files:**
- Create: `src/lib/firestore/bank-reconciliations.ts`
- Create: `src/lib/firestore/bank-reconciliations.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/firestore/bank-reconciliations.test.ts`:
```typescript
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (...a: unknown[]) => mockDoc(...a),
  writeBatch: (...a: unknown[]) => mockWriteBatch(...a),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

import { getBankReconciliations, saveBankReconciliation } from './bank-reconciliations'

beforeEach(() => jest.clearAllMocks())

const recData = { month: '2026-06', accountId: 'a3', actualBalance: 12500, expectedBalance: 12480, date: '2026-06-03' }

describe('getBankReconciliations', () => {
  it('returns reconciliations for the month', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'r1', data: () => recData }] })
    const recs = await getBankReconciliations('2026-06')
    expect(recs[0]).toEqual({ id: 'r1', ...recData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })

  it('returns empty array when no reconciliations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    expect(await getBankReconciliations('2026-06')).toEqual([])
  })
})

describe('saveBankReconciliation', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await saveBankReconciliation(recData)
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', recData, { merge: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/firestore/bank-reconciliations.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

`src/lib/firestore/bank-reconciliations.ts`:
```typescript
import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { BankReconciliation } from '../types'

function getDb() { return getFirestore(app) }

export async function getBankReconciliations(month: string): Promise<BankReconciliation[]> {
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
}

export async function saveBankReconciliation(rec: Omit<BankReconciliation, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = rec
  const docRef = id
    ? doc(getDb(), 'bank_reconciliations', id)
    : doc(collection(getDb(), 'bank_reconciliations'))
  await setDoc(docRef, data, { merge: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/firestore/bank-reconciliations.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/firestore/bank-reconciliations.ts src/lib/firestore/bank-reconciliations.test.ts
git commit -m "feat: add bank-reconciliations Firestore service"
```

---

### Task 4: Dashboard compute function

**Files:**
- Create: `src/lib/dashboard/compute.ts`
- Create: `src/lib/dashboard/compute.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/dashboard/compute.test.ts`:
```typescript
import { computeDashboard } from './compute'
import type { DashboardInput } from './compute'

function emptyInput(): DashboardInput {
  return {
    transactions: [],
    salaryEntry: null,
    incomeEntries: [],
    dividends: [],
    investmentEntries: [],
    categories: [],
    monthlySettings: null,
  }
}

describe('computeDashboard', () => {
  it('returns zeros for empty input', () => {
    const result = computeDashboard(emptyInput())
    expect(result.totalIncome).toBe(0)
    expect(result.totalExpenses).toBe(0)
    expect(result.totalSavings).toBe(0)
    expect(result.totalInvestments).toBe(0)
    expect(result.categoryTotals).toEqual([])
    expect(result.uncategorizedTotal).toBe(0)
  })

  it('computes totalIncome from salary net + income entries + dividend ILS equivalent', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      salaryEntry: { id: 's1', month: '2026-06', employerName: 'חברה', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 100, pension: 1500, trainingFund: 750 }, netAmount: 10150 },
      incomeEntries: [
        { id: 'i1', month: '2026-06', sourceName: 'מילואים', amount: 3000, currency: 'ILS', date: '2026-06-15' },
      ],
      dividends: [
        { id: 'd1', month: '2026-06', investmentTypeId: 'msty', amount: 100, currency: 'USD', ilsEquivalent: 370, date: '2026-06-01' },
      ],
    }
    expect(computeDashboard(input).totalIncome).toBe(10150 + 3000 + 370)
  })

  it('counts dividends without ilsEquivalent as zero income', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      dividends: [{ id: 'd1', month: '2026-06', investmentTypeId: 'msty', amount: 100, currency: 'USD', date: '2026-06-01' }],
    }
    expect(computeDashboard(input).totalIncome).toBe(0)
  })

  it('computes totalExpenses as sum of all transactions', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
        { id: 't2', date: '2026-06-02', merchantName: 'YES', amount: 350, currency: 'ILS', accountId: 'a1', categoryId: 'c2', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    expect(computeDashboard(input).totalExpenses).toBe(550)
  })

  it('computes totalSavings as income minus expenses', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      salaryEntry: { id: 's1', month: '2026-06', employerName: 'חברה', grossAmount: 10000, deductions: { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }, netAmount: 10000 },
      transactions: [{ id: 't1', date: '2026-06-01', merchantName: 'test', amount: 3000, currency: 'ILS', accountId: 'a1', source: 'xlsx_import', isImmediate: false, month: '2026-06' }],
    }
    expect(computeDashboard(input).totalSavings).toBe(7000)
  })

  it('computes totalInvestments as sum of investment entries', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      investmentEntries: [
        { id: 'e1', date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 5000, currency: 'ILS' },
        { id: 'e2', date: '2026-06-15', month: '2026-06', investmentTypeId: 't1', amount: 2000, currency: 'ILS' },
      ],
    }
    expect(computeDashboard(input).totalInvestments).toBe(7000)
  })

  it('sums transactions per category', () => {
    const cats = [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true, monthlyTarget: 2000 }]
    const input: DashboardInput = {
      ...emptyInput(),
      categories: cats,
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
        { id: 't2', date: '2026-06-02', merchantName: 'רמי לוי', amount: 150, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    const result = computeDashboard(input)
    expect(result.categoryTotals[0]).toEqual({ id: 'c1', name: 'אוכל', color: '#ef4444', actual: 350, target: 2000 })
  })

  it('uses monthlySettings target over category default', () => {
    const cats = [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true, monthlyTarget: 2000 }]
    const input: DashboardInput = {
      ...emptyInput(),
      categories: cats,
      monthlySettings: { id: 'ms1', month: '2026-06', categoryTargets: { c1: 1800 } },
      transactions: [{ id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 100, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' }],
    }
    const result = computeDashboard(input)
    expect(result.categoryTotals[0].target).toBe(1800)
  })

  it('tracks uncategorized transactions separately', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'חנות', amount: 99, currency: 'ILS', accountId: 'a1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    expect(computeDashboard(input).uncategorizedTotal).toBe(99)
  })

  it('excludes categories with no actual and no target from results', () => {
    const cats = [
      { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
      { id: 'c2', name: 'חשבונות', color: '#f97316', isActive: true, monthlyTarget: 500 },
    ]
    const input: DashboardInput = { ...emptyInput(), categories: cats }
    const result = computeDashboard(input)
    expect(result.categoryTotals).toHaveLength(1)
    expect(result.categoryTotals[0].id).toBe('c2')
  })

  it('sorts categories by actual amount descending', () => {
    const cats = [
      { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
      { id: 'c2', name: 'חשבונות', color: '#f97316', isActive: true },
    ]
    const input: DashboardInput = {
      ...emptyInput(),
      categories: cats,
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 100, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
        { id: 't2', date: '2026-06-02', merchantName: 'YES', amount: 500, currency: 'ILS', accountId: 'a1', categoryId: 'c2', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    const result = computeDashboard(input)
    expect(result.categoryTotals[0].id).toBe('c2')
    expect(result.categoryTotals[1].id).toBe('c1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/dashboard/compute.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './compute'"

- [ ] **Step 3: Write the implementation**

`src/lib/dashboard/compute.ts`:
```typescript
import type { Transaction, SalaryEntry, IncomeEntry, Dividend, InvestmentEntry, Category, MonthlySettings } from '../types'

export interface CategorySummary {
  id: string
  name: string
  color: string
  actual: number
  target: number | null
}

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  totalInvestments: number
  categoryTotals: CategorySummary[]
  uncategorizedTotal: number
}

export interface DashboardInput {
  transactions: Transaction[]
  salaryEntry: SalaryEntry | null
  incomeEntries: IncomeEntry[]
  dividends: Dividend[]
  investmentEntries: InvestmentEntry[]
  categories: Category[]
  monthlySettings: MonthlySettings | null
}

export function computeDashboard(input: DashboardInput): DashboardSummary {
  const { transactions, salaryEntry, incomeEntries, dividends, investmentEntries, categories, monthlySettings } = input

  const salaryNet = salaryEntry?.netAmount ?? 0
  const incomeTotal = incomeEntries.reduce((s, e) => s + e.amount, 0)
  const dividendTotal = dividends.reduce((s, d) => s + (d.ilsEquivalent ?? 0), 0)
  const totalIncome = salaryNet + incomeTotal + dividendTotal

  const totalExpenses = transactions.reduce((s, t) => s + t.amount, 0)
  const totalSavings = totalIncome - totalExpenses
  const totalInvestments = investmentEntries.reduce((s, e) => s + e.amount, 0)

  const amountByCategory: Record<string, number> = {}
  let uncategorizedTotal = 0
  for (const tx of transactions) {
    if (tx.categoryId) {
      amountByCategory[tx.categoryId] = (amountByCategory[tx.categoryId] ?? 0) + tx.amount
    } else {
      uncategorizedTotal += tx.amount
    }
  }

  const categoryTotals: CategorySummary[] = categories
    .filter(c => c.isActive)
    .map(c => {
      const target = monthlySettings?.categoryTargets[c.id] ?? c.monthlyTarget ?? null
      return { id: c.id, name: c.name, color: c.color, actual: amountByCategory[c.id] ?? 0, target }
    })
    .filter(c => c.actual > 0 || c.target !== null)
    .sort((a, b) => b.actual - a.actual)

  return { totalIncome, totalExpenses, totalSavings, totalInvestments, categoryTotals, uncategorizedTotal }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/dashboard/compute.test.ts --no-coverage
```

Expected: PASS (9 tests)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/compute.ts src/lib/dashboard/compute.test.ts
git commit -m "feat: add dashboard compute function with income/expense/savings/category logic"
```

---

### Task 5: SummaryCard + CategoryProgress components

**Files:**
- Create: `src/components/dashboard/SummaryCard.tsx`
- Create: `src/components/dashboard/SummaryCard.test.tsx`
- Create: `src/components/dashboard/CategoryProgress.tsx`
- Create: `src/components/dashboard/CategoryProgress.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/components/dashboard/SummaryCard.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { SummaryCard } from './SummaryCard'

describe('SummaryCard', () => {
  it('renders the label', () => {
    render(<SummaryCard label="הכנסות" amount={10000} />)
    expect(screen.getByText('הכנסות')).toBeInTheDocument()
  })

  it('formats amount with locale separators', () => {
    render(<SummaryCard label="הכנסות" amount={10000} />)
    expect(screen.getByTestId('amount')).toHaveTextContent('10,000')
  })

  it('shows ₪ prefix by default', () => {
    render(<SummaryCard label="הכנסות" amount={500} />)
    expect(screen.getByTestId('amount').textContent).toContain('₪')
  })

  it('shows negative amount in red when amount is negative', () => {
    render(<SummaryCard label="חיסכון" amount={-500} />)
    expect(screen.getByTestId('amount').className).toContain('text-red-400')
  })

  it('accepts custom color class', () => {
    render(<SummaryCard label="הכנסות" amount={1000} color="text-green-400" />)
    expect(screen.getByTestId('amount').className).toContain('text-green-400')
  })
})
```

`src/components/dashboard/CategoryProgress.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { CategoryProgress } from './CategoryProgress'
import type { CategorySummary } from '@/lib/dashboard/compute'

const cats: CategorySummary[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', actual: 1200, target: 2000 },
  { id: 'c2', name: 'חשבונות', color: '#f97316', actual: 2200, target: 2000 },
  { id: 'c3', name: 'רפואה', color: '#84cc16', actual: 300, target: null },
]

describe('CategoryProgress', () => {
  it('renders all category names', () => {
    render(<CategoryProgress categories={cats} />)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText('חשבונות')).toBeInTheDocument()
    expect(screen.getByText('רפואה')).toBeInTheDocument()
  })

  it('shows actual amounts', () => {
    render(<CategoryProgress categories={cats} />)
    expect(screen.getByText(/1,200/)).toBeInTheDocument()
  })

  it('shows target when present', () => {
    render(<CategoryProgress categories={cats} />)
    expect(screen.getByText(/2,000/)).toBeInTheDocument()
  })

  it('renders progress bar for categories with a target', () => {
    render(<CategoryProgress categories={cats} />)
    const bars = document.querySelectorAll('[data-testid="progress-bar"]')
    expect(bars).toHaveLength(2)
  })

  it('marks over-budget category bar as red', () => {
    render(<CategoryProgress categories={cats} />)
    const bars = document.querySelectorAll('[data-testid="progress-bar"]')
    const overBudget = Array.from(bars).find(b => b.className.includes('bg-red'))
    expect(overBudget).toBeTruthy()
  })

  it('returns null when no categories', () => {
    const { container } = render(<CategoryProgress categories={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/components/dashboard/SummaryCard.test.tsx src/components/dashboard/CategoryProgress.test.tsx --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write SummaryCard**

`src/components/dashboard/SummaryCard.tsx`:
```typescript
interface Props {
  label: string
  amount: number
  color?: string
  prefix?: string
}

export function SummaryCard({ label, amount, color, prefix = '₪' }: Props) {
  const isNegative = amount < 0
  const colorClass = color ?? (isNegative ? 'text-red-400' : 'text-foreground')
  return (
    <div className="bg-surface rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span data-testid="amount" className={`text-xl font-bold tabular-nums ${colorClass}`}>
        {prefix}{Math.abs(amount).toLocaleString('he-IL')}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Write CategoryProgress**

`src/components/dashboard/CategoryProgress.tsx`:
```typescript
import type { CategorySummary } from '@/lib/dashboard/compute'

interface Props {
  categories: CategorySummary[]
}

export function CategoryProgress({ categories }: Props) {
  if (categories.length === 0) return null
  return (
    <div className="bg-surface rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-400">הוצאות לפי קטגוריה</h2>
      {categories.map(cat => {
        const pct = cat.target ? Math.min(100, (cat.actual / cat.target) * 100) : null
        const isOver = cat.target !== null && cat.actual > cat.target
        return (
          <div key={cat.id}>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </span>
              <span className={isOver ? 'text-red-400' : 'text-slate-300'}>
                ₪{cat.actual.toLocaleString('he-IL')}
                {cat.target !== null && (
                  <span className="text-slate-500"> / ₪{cat.target.toLocaleString('he-IL')}</span>
                )}
              </span>
            </div>
            {pct !== null && (
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  data-testid="progress-bar"
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/components/dashboard/SummaryCard.test.tsx src/components/dashboard/CategoryProgress.test.tsx --no-coverage
```

Expected: PASS (11 tests: 5 SummaryCard + 6 CategoryProgress)

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/SummaryCard.tsx src/components/dashboard/SummaryCard.test.tsx src/components/dashboard/CategoryProgress.tsx src/components/dashboard/CategoryProgress.test.tsx
git commit -m "feat: add SummaryCard and CategoryProgress dashboard components"
```

---

### Task 6: BankReconciliationCard + DividendsCard components

**Files:**
- Create: `src/components/dashboard/BankReconciliationCard.tsx`
- Create: `src/components/dashboard/BankReconciliationCard.test.tsx`
- Create: `src/components/dashboard/DividendsCard.tsx`
- Create: `src/components/dashboard/DividendsCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/components/dashboard/BankReconciliationCard.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { BankReconciliationCard } from './BankReconciliationCard'
import type { BankReconciliation } from '@/lib/types'

const matchRec: BankReconciliation = { id: 'r1', month: '2026-06', accountId: 'a3', actualBalance: 12500, expectedBalance: 12500, date: '2026-06-03' }
const gapRec: BankReconciliation = { id: 'r2', month: '2026-06', accountId: 'a3', actualBalance: 12000, expectedBalance: 12500, date: '2026-06-03' }

describe('BankReconciliationCard', () => {
  it('shows no-reconciliation message when null', () => {
    render(<BankReconciliationCard reconciliation={null} />)
    expect(screen.getByText(/לא בוצע אימות/)).toBeInTheDocument()
  })

  it('shows checkmark and "תואם" when balance matches', () => {
    render(<BankReconciliationCard reconciliation={matchRec} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText('תואם')).toBeInTheDocument()
  })

  it('shows X and gap amount when balance does not match', () => {
    render(<BankReconciliationCard reconciliation={gapRec} />)
    expect(screen.getByText('✗')).toBeInTheDocument()
    expect(screen.getByText(/פער/)).toBeInTheDocument()
    expect(screen.getByText(/500/)).toBeInTheDocument()
  })

  it('shows actual and expected balances', () => {
    render(<BankReconciliationCard reconciliation={gapRec} />)
    expect(screen.getByText(/12,000/)).toBeInTheDocument()
    expect(screen.getByText(/12,500/)).toBeInTheDocument()
  })
})
```

`src/components/dashboard/DividendsCard.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { DividendsCard } from './DividendsCard'
import type { Dividend, InvestmentType } from '@/lib/types'

const types: InvestmentType[] = [{ id: 't1', name: 'MSTY', currency: 'USD' }]
const divs: Dividend[] = [
  { id: 'd1', month: '2026-06', investmentTypeId: 't1', amount: 150, currency: 'USD', ilsEquivalent: 555, date: '2026-06-15' },
]

describe('DividendsCard', () => {
  it('shows empty state when no dividends', () => {
    render(<DividendsCard dividends={[]} investmentTypes={types} />)
    expect(screen.getByText(/אין דיבידנדים/)).toBeInTheDocument()
  })

  it('shows dividend amount with currency', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByText(/150/)).toBeInTheDocument()
    expect(screen.getByText(/USD/)).toBeInTheDocument()
  })

  it('shows ILS equivalent when present', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByText(/555/)).toBeInTheDocument()
  })

  it('shows total ILS amount in header', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByTestId('dividends-total')).toHaveTextContent('555')
  })

  it('shows investment type name', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByText('MSTY')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/components/dashboard/BankReconciliationCard.test.tsx src/components/dashboard/DividendsCard.test.tsx --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write BankReconciliationCard**

`src/components/dashboard/BankReconciliationCard.tsx`:
```typescript
import type { BankReconciliation } from '@/lib/types'

interface Props {
  reconciliation: BankReconciliation | null
}

export function BankReconciliationCard({ reconciliation }: Props) {
  if (!reconciliation) {
    return (
      <div className="bg-surface rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-2">אימות יתרת בנק</h2>
        <p className="text-slate-500 text-sm">לא בוצע אימות החודש</p>
      </div>
    )
  }
  const diff = reconciliation.actualBalance - reconciliation.expectedBalance
  const isMatch = Math.abs(diff) < 1
  return (
    <div className="bg-surface rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-slate-400 mb-3">אימות יתרת בנק</h2>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-lg font-bold ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
          {isMatch ? '✓' : '✗'}
        </span>
        <span className={`font-semibold text-sm ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
          {isMatch ? 'תואם' : `פער: ₪${Math.abs(diff).toLocaleString('he-IL')}`}
        </span>
      </div>
      <div className="text-xs text-slate-400 space-y-0.5">
        <div>יתרה בפועל: <span className="text-slate-200 tabular-nums">₪{reconciliation.actualBalance.toLocaleString('he-IL')}</span></div>
        <div>יתרה צפויה: <span className="text-slate-200 tabular-nums">₪{reconciliation.expectedBalance.toLocaleString('he-IL')}</span></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write DividendsCard**

`src/components/dashboard/DividendsCard.tsx`:
```typescript
import type { Dividend, InvestmentType } from '@/lib/types'

interface Props {
  dividends: Dividend[]
  investmentTypes: InvestmentType[]
}

export function DividendsCard({ dividends, investmentTypes }: Props) {
  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))
  const totalIls = dividends.reduce((s, d) => s + (d.ilsEquivalent ?? 0), 0)
  return (
    <div className="bg-surface rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-slate-400">דיבידנדים החודש</h2>
        {totalIls > 0 && (
          <span data-testid="dividends-total" className="text-sm font-bold text-green-400 tabular-nums">
            ₪{totalIls.toLocaleString('he-IL')}
          </span>
        )}
      </div>
      {dividends.length === 0 ? (
        <p className="text-slate-500 text-sm">אין דיבידנדים החודש</p>
      ) : (
        <div className="space-y-1.5">
          {dividends.map(d => (
            <div key={d.id} className="flex justify-between text-xs">
              <span className="text-slate-300">{typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId}</span>
              <span className="tabular-nums">
                {d.amount.toLocaleString('he-IL')} {d.currency}
                {d.ilsEquivalent !== undefined && (
                  <span className="text-slate-500 mr-1.5">(₪{d.ilsEquivalent.toLocaleString('he-IL')})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/components/dashboard/BankReconciliationCard.test.tsx src/components/dashboard/DividendsCard.test.tsx --no-coverage
```

Expected: PASS (9 tests: 4 BankReconciliationCard + 5 DividendsCard)

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/BankReconciliationCard.tsx src/components/dashboard/BankReconciliationCard.test.tsx src/components/dashboard/DividendsCard.tsx src/components/dashboard/DividendsCard.test.tsx
git commit -m "feat: add BankReconciliationCard and DividendsCard dashboard components"
```

---

### Task 7: Dashboard page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (replace placeholder)
- Create: `src/app/(app)/dashboard/page.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/app/(app)/dashboard/page.test.tsx`:
```typescript
jest.mock('@/lib/firestore/transactions', () => ({ getTransactions: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/salary', () => ({ getSalaryEntry: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/firestore/income', () => ({ getIncomeEntries: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/dividends', () => ({ getDividends: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/investments', () => ({
  getInvestmentEntries: jest.fn().mockResolvedValue([]),
  getInvestmentTypes: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/bank-reconciliations', () => ({ getBankReconciliations: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/monthly-settings', () => ({ getMonthlySettings: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/firestore/categories', () => ({ getCategories: jest.fn().mockResolvedValue([]) }))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DashboardPage from './page'

beforeEach(() => jest.clearAllMocks())

describe('DashboardPage', () => {
  it('shows loading state initially', () => {
    render(<DashboardPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows all 4 summary card labels after loading', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('הכנסות')).toBeInTheDocument())
    expect(screen.getByText('הוצאות')).toBeInTheDocument()
    expect(screen.getByText('חיסכון')).toBeInTheDocument()
    expect(screen.getByText('להשקעות')).toBeInTheDocument()
  })

  it('shows month navigation buttons', () => {
    render(<DashboardPage />)
    expect(screen.getByRole('button', { name: 'חודש קודם' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'חודש הבא' })).toBeInTheDocument()
  })

  it('shows bank reconciliation card after loading', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('אימות יתרת בנק')).toBeInTheDocument())
  })

  it('shows dividends card after loading', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('דיבידנדים החודש')).toBeInTheDocument())
  })

  it('reloads data when navigating to previous month', async () => {
    const { getTransactions } = require('@/lib/firestore/transactions')
    render(<DashboardPage />)
    await waitFor(() => screen.getByText('הכנסות'))
    const before = getTransactions.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'חודש קודם' }))
    await waitFor(() => expect(getTransactions.mock.calls.length).toBeGreaterThan(before))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/app/\\(app\\)/dashboard/page.test.tsx --no-coverage
```

Expected: FAIL — placeholder page has no summary cards

- [ ] **Step 3: Write the dashboard page**

Replace all content in `src/app/(app)/dashboard/page.tsx`:
```typescript
'use client'
import { useState, useEffect } from 'react'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntry } from '@/lib/firestore/salary'
import { getIncomeEntries } from '@/lib/firestore/income'
import { getDividends } from '@/lib/firestore/dividends'
import { getInvestmentEntries, getInvestmentTypes } from '@/lib/firestore/investments'
import { getBankReconciliations } from '@/lib/firestore/bank-reconciliations'
import { getMonthlySettings } from '@/lib/firestore/monthly-settings'
import { getCategories } from '@/lib/firestore/categories'
import { computeDashboard } from '@/lib/dashboard/compute'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { CategoryProgress } from '@/components/dashboard/CategoryProgress'
import { BankReconciliationCard } from '@/components/dashboard/BankReconciliationCard'
import { DividendsCard } from '@/components/dashboard/DividendsCard'
import type { BankReconciliation, Dividend, InvestmentType } from '@/lib/types'
import type { DashboardSummary } from '@/lib/dashboard/compute'

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

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null)
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])

  useEffect(() => {
    setLoading(true)
    async function load() {
      const [txs, salary, income, divs, invEntries, invTypes, recs, cats, settings] = await Promise.all([
        getTransactions(month),
        getSalaryEntry(month),
        getIncomeEntries(month),
        getDividends(month),
        getInvestmentEntries(month),
        getInvestmentTypes(),
        getBankReconciliations(month),
        getCategories(),
        getMonthlySettings(month),
      ])
      setSummary(computeDashboard({
        transactions: txs, salaryEntry: salary, incomeEntries: income,
        dividends: divs, investmentEntries: invEntries, categories: cats, monthlySettings: settings,
      }))
      setReconciliation(recs[0] ?? null)
      setDividends(divs)
      setInvestmentTypes(invTypes)
      setLoading(false)
    }
    load()
  }, [month])

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setMonth(m => addMonths(m, -1))} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => setMonth(m => addMonths(m, 1))} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="הכנסות" amount={summary.totalIncome} color="text-green-400" />
            <SummaryCard label="הוצאות" amount={summary.totalExpenses} color="text-red-400" />
            <SummaryCard label="חיסכון" amount={summary.totalSavings} />
            <SummaryCard label="להשקעות" amount={summary.totalInvestments} color="text-accent" />
          </div>
          <CategoryProgress categories={summary.categoryTotals} />
          <BankReconciliationCard reconciliation={reconciliation} />
          <DividendsCard dividends={dividends} investmentTypes={investmentTypes} />
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/app/\\(app\\)/dashboard/page.test.tsx --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/app/\(app\)/dashboard/page.test.tsx
git commit -m "feat: replace dashboard placeholder with full monthly summary page"
```

---

## Self-Review

### 1. Spec Coverage Check

| Spec requirement | Task |
|---|---|
| בוחר חודש בראש המסך | Task 7 |
| 4 כרטיסי סיכום: הכנסות / הוצאות / חיסכון / להשקעות | Tasks 4, 5, 7 |
| Progress bars לפי קטגוריה: בפועל vs נקודת ייחוס | Tasks 4, 5, 7 |
| אדום = עברת, ירוק = בטווח | Task 5 (CategoryProgress) |
| כרטיס אימות יתרת בנק — ✓ תואם / ✗ פער | Tasks 3, 6, 7 |
| כרטיס דיבידנדים החודש | Tasks 1, 6, 7 |
| הכנסות = משכורת נטו + הכנסות נוספות + דיבידנדים (ILS) | Task 4 |
| השקעות = ספר נפרד (מוצגות בכרטיס נפרד) | Tasks 2, 4, 7 |
| תמיכה ב-monthlySettings כעקיפת target קטגוריה | Tasks 1, 4 |

### 2. Placeholder Scan ✓
All steps include complete code. No TBD or "similar to" references.

### 3. Type Consistency ✓
- `CategorySummary` defined in `compute.ts`, imported by `CategoryProgress.tsx`
- `DashboardInput`/`DashboardSummary` defined in `compute.ts`, used in `page.tsx`
- `InvestmentEntry.month` added in Task 2, used in `investments.ts` query and `compute.ts`
- `BankReconciliation` from types, used in `BankReconciliationCard` and `page.tsx`
- `Dividend`/`InvestmentType` from types, used in `DividendsCard` and `page.tsx`
