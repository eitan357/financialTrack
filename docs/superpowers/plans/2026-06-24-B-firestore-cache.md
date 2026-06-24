# Firestore Cache Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `appCache` caching to all Firestore modules that currently re-fetch on every render, reducing unnecessary reads and improving perceived performance.

**Architecture:** Follow the exact pattern already used in `transactions.ts` and `accounts.ts`: check cache before fetching, populate cache after fetch, invalidate cache on every write mutation. Use `appCache.delPrefix` when the exact key is unknown (e.g., in delete operations). All cache keys use a consistent `module:identifier` format.

**Tech Stack:** TypeScript, Firebase Firestore, `appCache` from `src/lib/cache.ts`

---

## File Structure

- **Modify:** `src/lib/firestore/salary.ts` — add cache to `getSalaryEntries`, update invalidation in `upsertSalaryEntry` and `deleteSalaryEntry` and `deleteAllSalaryEntries`
- **Modify:** `src/lib/firestore/income.ts` — add `appCache` to all three functions
- **Modify:** `src/lib/firestore/dividends.ts` — add `appCache` to both functions
- **Modify:** `src/lib/firestore/monthly-settings.ts` — add `appCache` to both functions
- **Modify:** `src/lib/firestore/investments.ts` — add `appCache` for types and entries
- **Modify:** `src/lib/firestore/bank-reconciliations.ts` — add `appCache` for month-keyed reconciliations
- **Modify:** `src/lib/firestore/salary.test.ts` — add test for getSalaryEntries cache hit
- **Modify:** `src/lib/firestore/income.test.ts` — add test for getIncomeEntries cache hit
- **Modify:** `src/lib/firestore/dividends.test.ts` — add test for getDividends cache hit

---

### Task 1: Cache getSalaryEntries in salary.ts

`getSalaryEntry` (singular) already caches at key `salary:${month}`. `getSalaryEntries` (plural) — used by the dashboard — has no cache. This task adds a separate cache for the array version and ensures all mutations invalidate both keys.

**Files:**
- Modify: `src/lib/firestore/salary.ts`
- Modify: `src/lib/firestore/salary.test.ts`

- [ ] **Step 1: Write failing cache test**

Add to `src/lib/firestore/salary.test.ts`, inside `describe('getSalaryEntries')`:

```ts
describe('getSalaryEntries', () => {
  it('returns array of salary entries for a month', async () => {
    const mockEntry = { month: '2026-06', employerName: 'Acme', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 200, pension: 1000, trainingFund: 500 }, netAmount: 10800 }
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'e1', data: () => mockEntry }],
    })
    const result = await getSalaryEntries('2026-06')
    expect(result).toHaveLength(1)
    expect(result[0].netAmount).toBe(10800)
    expect(result[0].id).toBe('e1')
  })

  it('returns empty array when no entries', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] })
    const result = await getSalaryEntries('2026-06')
    expect(result).toEqual([])
  })

  it('uses cache on second call — getDocs called only once', async () => {
    const { appCache } = require('@/lib/cache')
    appCache.get.mockReturnValueOnce(undefined) // first call: cache miss
    appCache.get.mockReturnValueOnce([{ id: 'e1', month: '2026-06', netAmount: 500, employerName: 'X', grossAmount: 700, deductions: { incomeTax: 100, nationalInsurance: 50, healthInsurance: 25, pension: 25, trainingFund: 0 } }]) // second call: cache hit

    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'e1', data: () => ({ month: '2026-06', netAmount: 500, employerName: 'X', grossAmount: 700, deductions: { incomeTax: 100, nationalInsurance: 50, healthInsurance: 25, pension: 25, trainingFund: 0 } }) }] })

    await getSalaryEntries('2026-06')
    await getSalaryEntries('2026-06')
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to confirm cache test fails**

```powershell
npx jest --testPathPattern="salary.test" --no-coverage
```

Expected: the "uses cache" test FAILS — `getDocs` is called twice

- [ ] **Step 3: Update salary.ts**

Full replacement of `src/lib/firestore/salary.ts`:

```ts
import { getFirestore, collection, getDocs, setDoc, doc, query, where, writeBatch, deleteDoc } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { SalaryEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getSalaryEntry(month: string): Promise<SalaryEntry | null> {
  const key = `salary:${month}`
  const cached = appCache.get<SalaryEntry | null>(key)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as SalaryEntry)
  appCache.set(key, result)
  return result
}

export async function getSalaryEntries(month: string): Promise<SalaryEntry[]> {
  const key = `salary_arr:${month}`
  const cached = appCache.get<SalaryEntry[]>(key)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryEntry))
  appCache.set(key, result)
  return result
}

export async function getAllSalaryEntries(): Promise<SalaryEntry[]> {
  const snap = await getDocs(collection(getDb(), 'salary_entries'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryEntry))
}

export async function upsertSalaryEntry(entry: Omit<SalaryEntry, 'id'> & { id?: string }): Promise<SalaryEntry> {
  const { id, ...data } = entry
  const docRef = id
    ? doc(getDb(), 'salary_entries', id)
    : doc(collection(getDb(), 'salary_entries'))
  const cleanData = JSON.parse(JSON.stringify(data))
  await setDoc(docRef, cleanData, { merge: true })
  appCache.del(`salary:${data.month}`)
  appCache.del(`salary_arr:${data.month}`)
  return { id: docRef.id, ...data } as SalaryEntry
}

export async function deleteSalaryEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'salary_entries', id))
  appCache.delPrefix('salary:')
  appCache.delPrefix('salary_arr:')
}

export async function deleteAllSalaryEntries(): Promise<number> {
  const db = getDb()
  const snap = await getDocs(collection(db, 'salary_entries'))
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  appCache.delPrefix('salary:')
  appCache.delPrefix('salary_arr:')
  return snap.size
}
```

- [ ] **Step 4: Run all salary tests**

```powershell
npx jest --testPathPattern="salary.test" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```powershell
git add src/lib/firestore/salary.ts src/lib/firestore/salary.test.ts
git commit -m "feat: add cache to getSalaryEntries, update all invalidation paths"
```

---

### Task 2: Add cache to income.ts, dividends.ts, and monthly-settings.ts

These three modules currently hit Firestore on every call. They follow the same month-keyed pattern.

**Files:**
- Modify: `src/lib/firestore/income.ts`
- Modify: `src/lib/firestore/dividends.ts`
- Modify: `src/lib/firestore/monthly-settings.ts`
- Modify: `src/lib/firestore/income.test.ts`
- Modify: `src/lib/firestore/dividends.test.ts`

- [ ] **Step 1: Add cache test to income.test.ts**

Add inside `describe('getIncomeEntries')` after the existing test:

```ts
it('caches results — getDocs called only once on second call', async () => {
  const { appCache } = jest.requireMock('@/lib/cache')
  appCache.get
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce([{ id: 'i1', month: '2026-06', sourceName: 'מילואים', amount: 3000, currency: 'ILS', date: '2026-06-15' }])

  mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'i1', data: () => incomeData }] })

  await getIncomeEntries('2026-06')
  await getIncomeEntries('2026-06')
  expect(mockGetDocs).toHaveBeenCalledTimes(1)
})
```

Also add the cache mock to the top of income.test.ts (after the firebase mock):
```ts
jest.mock('@/lib/cache', () => ({
  appCache: {
    get: jest.fn(() => undefined),
    set: jest.fn(),
    del: jest.fn(),
    delPrefix: jest.fn(),
  },
}))
```

- [ ] **Step 2: Run income test to confirm it fails**

```powershell
npx jest --testPathPattern="income.test" --no-coverage
```

Expected: cache test FAILS — module doesn't import appCache yet

- [ ] **Step 3: Rewrite income.ts**

```ts
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { IncomeEntry } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `income:${month}`

export async function getIncomeEntries(month: string): Promise<IncomeEntry[]> {
  const k = key(month)
  const cached = appCache.get<IncomeEntry[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'income_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeEntry))
  appCache.set(k, result)
  return result
}

export async function addIncomeEntry(entry: Omit<IncomeEntry, 'id'>): Promise<IncomeEntry> {
  const ref = await addDoc(collection(getDb(), 'income_entries'), entry)
  appCache.del(key(entry.month))
  return { id: ref.id, ...entry }
}

export async function deleteIncomeEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'income_entries', id))
  appCache.delPrefix('income:')
}

export async function deleteAllIncomeEntries(): Promise<number> {
  const db = getDb()
  const snap = await getDocs(collection(db, 'income_entries'))
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  appCache.delPrefix('income:')
  return snap.size
}
```

- [ ] **Step 4: Add cache test to dividends.test.ts**

Add the cache mock at the top of dividends.test.ts (after the firebase mock):
```ts
jest.mock('@/lib/cache', () => ({
  appCache: {
    get: jest.fn(() => undefined),
    set: jest.fn(),
    del: jest.fn(),
    delPrefix: jest.fn(),
  },
}))
```

Add inside `describe('getDividends')`:
```ts
it('caches results on second call', async () => {
  const { appCache } = jest.requireMock('@/lib/cache')
  appCache.get
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce([{ id: 'd1', ...divData }])

  mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'd1', data: () => divData }] })

  await getDividends('2026-06')
  await getDividends('2026-06')
  expect(mockGetDocs).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 5: Rewrite dividends.ts**

```ts
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { Dividend } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `dividends:${month}`

export async function getDividends(month: string): Promise<Dividend[]> {
  const k = key(month)
  const cached = appCache.get<Dividend[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'dividends'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as Dividend))
  appCache.set(k, result)
  return result
}

export async function addDividend(dividend: Omit<Dividend, 'id'>): Promise<Dividend> {
  const ref = await addDoc(collection(getDb(), 'dividends'), dividend)
  appCache.del(key(dividend.month))
  return { id: ref.id, ...dividend }
}
```

- [ ] **Step 6: Rewrite monthly-settings.ts**

```ts
import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { MonthlySettings } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `monthly_settings:${month}`

export async function getMonthlySettings(month: string): Promise<MonthlySettings | null> {
  const k = key(month)
  const cached = appCache.get<MonthlySettings | null>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'monthly_settings'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as MonthlySettings)
  appCache.set(k, result)
  return result
}

export async function upsertMonthlySettings(settings: Omit<MonthlySettings, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = settings
  const docRef = id
    ? doc(getDb(), 'monthly_settings', id)
    : doc(collection(getDb(), 'monthly_settings'))
  await setDoc(docRef, data, { merge: true })
  appCache.del(key(data.month))
}
```

- [ ] **Step 7: Run all three test files**

```powershell
npx jest --testPathPattern="income.test|dividends.test|monthly-settings.test" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```powershell
git add src/lib/firestore/income.ts src/lib/firestore/dividends.ts src/lib/firestore/monthly-settings.ts src/lib/firestore/income.test.ts src/lib/firestore/dividends.test.ts
git commit -m "feat: add appCache to income, dividends, and monthly-settings firestore modules"
```

---

### Task 3: Add cache to investments.ts and bank-reconciliations.ts

**Files:**
- Modify: `src/lib/firestore/investments.ts`
- Modify: `src/lib/firestore/bank-reconciliations.ts`
- Modify: `src/lib/firestore/investments.test.ts`
- Modify: `src/lib/firestore/bank-reconciliations.test.ts`

- [ ] **Step 1: Add cache mock to investments.test.ts**

Add after the firebase/firestore mock:
```ts
jest.mock('@/lib/cache', () => ({
  appCache: {
    get: jest.fn(() => undefined),
    set: jest.fn(),
    del: jest.fn(),
    delPrefix: jest.fn(),
  },
}))
```

Add inside `describe('getInvestmentTypes')`:
```ts
it('uses cache on second call', async () => {
  const { appCache } = jest.requireMock('@/lib/cache')
  const cached = [{ id: 't1', name: 'MSTY', currency: 'USD' }]
  appCache.get
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce(cached)
  mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 't1', data: () => ({ name: 'MSTY', currency: 'USD' }) }] })

  await getInvestmentTypes()
  await getInvestmentTypes()
  expect(mockGetDocs).toHaveBeenCalledTimes(1)
})
```

Add inside `describe('getInvestmentEntries')`:
```ts
it('uses cache on second call', async () => {
  const { appCache } = jest.requireMock('@/lib/cache')
  const entryData = { date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 5000, currency: 'ILS' }
  appCache.get
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce([{ id: 'e1', ...entryData }])
  mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'e1', data: () => entryData }] })

  await getInvestmentEntries('2026-06')
  await getInvestmentEntries('2026-06')
  expect(mockGetDocs).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Rewrite investments.ts**

```ts
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { InvestmentType, InvestmentEntry } from '../types'

function getDb() { return getFirestore(app) }

const TYPES_KEY = 'investment_types'
const entryKey = (month: string) => `investment_entries:${month}`

export async function getInvestmentTypes(): Promise<InvestmentType[]> {
  const cached = appCache.get<InvestmentType[]>(TYPES_KEY)
  if (cached) return cached
  const snap = await getDocs(collection(getDb(), 'investment_types'))
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentType))
  appCache.set(TYPES_KEY, result)
  return result
}

export async function addInvestmentType(type: Omit<InvestmentType, 'id'>): Promise<InvestmentType> {
  const ref = await addDoc(collection(getDb(), 'investment_types'), type)
  appCache.del(TYPES_KEY)
  return { id: ref.id, ...type }
}

export async function getInvestmentEntries(month: string): Promise<InvestmentEntry[]> {
  const k = entryKey(month)
  const cached = appCache.get<InvestmentEntry[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'investment_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentEntry))
  appCache.set(k, result)
  return result
}

export async function addInvestmentEntry(entry: Omit<InvestmentEntry, 'id'>): Promise<InvestmentEntry> {
  const ref = await addDoc(collection(getDb(), 'investment_entries'), entry)
  appCache.del(entryKey(entry.month))
  return { id: ref.id, ...entry }
}
```

- [ ] **Step 3: Add cache to bank-reconciliations.ts**

Read `src/lib/firestore/bank-reconciliations.test.ts` to check existing mock setup, then add the cache mock and a cache-hit test.

Add to the top of bank-reconciliations.test.ts (after firebase mock):
```ts
jest.mock('@/lib/cache', () => ({
  appCache: {
    get: jest.fn(() => undefined),
    set: jest.fn(),
    del: jest.fn(),
    delPrefix: jest.fn(),
  },
}))
```

Add test inside `describe('getBankReconciliations')`:
```ts
it('uses cache on second call', async () => {
  const { appCache } = jest.requireMock('@/lib/cache')
  const recData = { month: '2026-06', accountId: 'a1', balance: 5000, note: '' }
  appCache.get
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce([{ id: 'r1', ...recData }])
  mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'r1', data: () => recData }] })

  await getBankReconciliations('2026-06')
  await getBankReconciliations('2026-06')
  expect(mockGetDocs).toHaveBeenCalledTimes(1)
})
```

Full replacement of `src/lib/firestore/bank-reconciliations.ts`:

```ts
import { getFirestore, collection, getDocs, setDoc, doc, query, where, writeBatch } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { BankReconciliation } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `bank_recs:${month}`

export async function getBankReconciliations(month: string): Promise<BankReconciliation[]> {
  const k = key(month)
  const cached = appCache.get<BankReconciliation[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
  appCache.set(k, result)
  return result
}

export async function getBankReconciliationsForMonths(months: string[]): Promise<BankReconciliation[]> {
  if (months.length === 0) return []
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', 'in', months))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
}

export async function saveBankReconciliation(rec: Omit<BankReconciliation, 'id'> & { id?: string }): Promise<BankReconciliation> {
  const { id, ...data } = rec
  const docRef = id
    ? doc(getDb(), 'bank_reconciliations', id)
    : doc(collection(getDb(), 'bank_reconciliations'))
  await setDoc(docRef, data, { merge: true })
  appCache.del(key(data.month))
  return { id: docRef.id, ...data }
}

export async function deleteAllBankReconciliations(): Promise<number> {
  const snap = await getDocs(collection(getDb(), 'bank_reconciliations'))
  const batch = writeBatch(getDb())
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  appCache.delPrefix('bank_recs:')
  return snap.size
}
```

Note: `deleteAllBankReconciliations` now returns `Promise<number>` (consistent with other `deleteAll*` functions) and clears the cache prefix.

- [ ] **Step 4: Run all cache tests**

```powershell
npx jest --testPathPattern="investments.test|bank-reconciliations.test" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Run full suite to confirm no regressions**

```powershell
npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```powershell
git add src/lib/firestore/investments.ts src/lib/firestore/bank-reconciliations.ts src/lib/firestore/investments.test.ts src/lib/firestore/bank-reconciliations.test.ts
git commit -m "feat: add appCache to investments and bank-reconciliations firestore modules"
```
