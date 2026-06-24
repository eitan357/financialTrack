# Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a data accuracy bug in reports, add error handling to all pages, and fix a stale test mock left over from the salary refactor.

**Architecture:** Three independent fixes: (1) filter income from expense totals in reports compute, (2) add try/catch + error state UI to the three pages that currently swallow errors silently, (3) update the dashboard page test to mock the current API (`getSalaryEntries`) instead of the old one (`getSalaryEntry`).

**Tech Stack:** Next.js 14, TypeScript, Jest + @testing-library/react

---

## File Structure

- **Modify:** `src/lib/reports/compute.ts` — filter income transactions out of expense totals
- **Modify:** `src/lib/reports/compute.test.ts` — add regression test for the income-filter bug
- **Modify:** `src/app/(app)/transactions/page.tsx` — add error state + UI
- **Modify:** `src/app/(app)/investments/page.tsx` — add error state + UI
- **Modify:** `src/app/(app)/reports/page.tsx` — add error state + UI
- **Modify:** `src/app/(app)/settings/page.tsx` — add try/catch in each section's load()
- **Modify:** `src/app/(app)/dashboard/page.test.tsx` — fix stale mock

---

### Task 1: Fix reports income filter bug

The bug: `src/lib/reports/compute.ts` line 27 sums ALL transactions into `totalExpenses`, including income transactions. The dashboard compute correctly filters them out. Reports does not.

**Files:**
- Modify: `src/lib/reports/compute.ts:23-40`
- Modify: `src/lib/reports/compute.test.ts`

- [ ] **Step 1: Add failing test to compute.test.ts**

Open `src/lib/reports/compute.test.ts` and add this test case inside the `describe('computeMonthlyReports')` block, after the last `it(...)`:

```ts
it('excludes income transactions from totalExpenses and byCategory', () => {
  const txsWithIncome: Transaction[] = [
    ...txs,
    {
      id: 'inc',
      date: '2026-06-10',
      merchantName: 'משכורת',
      amount: 5000,
      currency: 'ILS',
      accountId: 'y',
      source: 'manual' as const,
      isImmediate: true,
      month: '2026-06',
      direction: 'income' as const,
    },
  ]
  const result = computeMonthlyReports(txsWithIncome, ['2026-06'], cats)
  // income transaction (5000) must NOT be added to expenses (400)
  expect(result[0].totalExpenses).toBe(400)
  // income transaction has no categoryId — byCategory must still be same length
  expect(result[0].byCategory).toHaveLength(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
npx jest --testPathPattern="reports/compute" --no-coverage
```

Expected: FAIL — `received 5400, expected 400`

- [ ] **Step 3: Fix compute.ts**

Replace the body of the `.map(month => { ... })` callback in `src/lib/reports/compute.ts` (lines 25-43). The full updated function body:

```ts
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
      const expenseTxs = monthTxs.filter(t => t.direction !== 'income')
      const totalExpenses = expenseTxs.reduce((s, t) => s + t.amount, 0)

      const totals: Record<string, number> = {}
      for (const tx of expenseTxs) {
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

- [ ] **Step 4: Run tests to verify all pass**

```powershell
npx jest --testPathPattern="reports/compute" --no-coverage
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```powershell
git add src/lib/reports/compute.ts src/lib/reports/compute.test.ts
git commit -m "fix: exclude income transactions from reports expense totals"
```

---

### Task 2: Fix stale dashboard test mock

The dashboard page now calls `getSalaryEntries` (plural, returns array), but the test still mocks `getSalaryEntry` (singular, returns null). The test passes vacuously because the mock it set up is never called.

**Files:**
- Modify: `src/app/(app)/dashboard/page.test.tsx:2`

- [ ] **Step 1: Read the current mock line**

Current `src/app/(app)/dashboard/page.test.tsx` line 2:
```ts
jest.mock('@/lib/firestore/salary', () => ({ getSalaryEntry: jest.fn().mockResolvedValue(null) }))
```

- [ ] **Step 2: Update the mock**

Replace line 2 with:
```ts
jest.mock('@/lib/firestore/salary', () => ({ getSalaryEntries: jest.fn().mockResolvedValue([]) }))
```

- [ ] **Step 3: Run dashboard tests**

```powershell
npx jest --testPathPattern="dashboard/page" --no-coverage
```

Expected: all tests PASS (they were passing before; this makes them correct, not just accidentally green)

- [ ] **Step 4: Commit**

```powershell
git add "src/app/(app)/dashboard/page.test.tsx"
git commit -m "fix: update dashboard test to mock getSalaryEntries instead of stale getSalaryEntry"
```

---

### Task 3: Add error handling to transactions, investments, and reports pages

These three pages have `try/finally` but no `catch`. When Firestore fails, the loading spinner disappears and the user sees an empty state with no explanation.

**Files:**
- Modify: `src/app/(app)/transactions/page.tsx`
- Modify: `src/app/(app)/investments/page.tsx`
- Modify: `src/app/(app)/reports/page.tsx`

- [ ] **Step 1: Update transactions/page.tsx**

Add `error` state and update the `load()` function. Find the existing state declarations near line 39 and add after `const [reloadKey, setReloadKey] = useState(0)`:

```ts
const [error, setError] = useState<string | null>(null)
```

Update the `useEffect` to set error and clear it:
```ts
useEffect(() => {
  setLoading(true)
  setError(null)
  async function load() {
    try {
      const [txs, cats, accs] = await Promise.all([
        getTransactions(month),
        getCategories(),
        getAccounts(),
      ])
      setTransactions(txs)
      setCategories(cats)
      setAccounts(accs)
    } catch (e) {
      setError('שגיאה בטעינת העסקאות. בדוק את חיבור הרשת.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  load()
}, [month, reloadKey])
```

In the JSX, find the ternary that starts `{loading ? (` (around line 207) and add the error branch between loading and the empty check:

```tsx
{loading ? (
  <div className="flex justify-center items-center min-h-40">
    <p className="text-slate-400">טוען...</p>
  </div>
) : error ? (
  <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
) : displayItems.length === 0 ? (
  <div className="text-center py-12 text-slate-500">
    {categoryFilter !== 'all' ? 'אין עסקאות בקטגוריה זו' : 'אין עסקאות בחודש זה'}
  </div>
) : (
  // ... existing table JSX unchanged
```

- [ ] **Step 2: Update investments/page.tsx**

Add error state after the `showAddType` state declaration (around line 20):
```ts
const [error, setError] = useState<string | null>(null)
```

Update the `useEffect`:
```ts
useEffect(() => {
  setLoading(true)
  setError(null)
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
    } catch (e) {
      setError('שגיאה בטעינת נתוני השקעות. בדוק את חיבור הרשת.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  load()
}, [month])
```

In JSX, the ternary starting `{loading ? (` (around line 65), add error branch:
```tsx
{loading ? (
  <div className="flex justify-center items-center min-h-40">
    <p className="text-slate-400">טוען...</p>
  </div>
) : error ? (
  <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
) : (
  <>
    {/* ... existing sections unchanged */}
  </>
)}
```

- [ ] **Step 3: Update reports/page.tsx**

Add error state after `categories` state (around line 21):
```ts
const [error, setError] = useState<string | null>(null)
```

Update `useEffect`:
```ts
useEffect(() => {
  setLoading(true)
  setError(null)
  const months = monthsOfYear(year)
  async function load() {
    try {
      const [txs, cats, accs] = await Promise.all([
        getTransactionsForMonths(months),
        getCategories(),
        getAccounts(),
      ])
      setCategories(cats)
      const creditIds = new Set(accs.filter(a => a.type === 'credit').map(a => a.id))
      const txsForCompute = txs.filter(t => !(t.isImmediate && creditIds.has(t.accountId)))
      setSummaries(computeMonthlyReports(txsForCompute, months, cats))
    } catch (e) {
      setError('שגיאה בטעינת הדוחות. בדוק את חיבור הרשת.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  load()
}, [year])
```

In JSX, find the `{loading ? (` ternary (around line 65) and add:
```tsx
{loading ? (
  <div className="flex justify-center items-center min-h-40">
    <p className="text-slate-400">טוען...</p>
  </div>
) : error ? (
  <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
) : (
  <div className="space-y-4">
    {/* ... existing content unchanged */}
  </div>
)}
```

- [ ] **Step 4: Run the app and verify pages show error state**

No automated test for this — manually break a Firestore rule or disconnect network and reload each page. Confirm the red error banner appears instead of blank/loading.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(app)/transactions/page.tsx" "src/app/(app)/investments/page.tsx" "src/app/(app)/reports/page.tsx"
git commit -m "fix: add error handling to transactions, investments, and reports pages"
```

---

### Task 4: Add error handling to settings page sections

Each section (`AccountsSection`, `CategoriesSection`, `RulesSection`) has a `load()` inside `useEffect` with no `try/catch`. Firestore failures leave the section stuck on "טוען...".

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Add error state and catch to AccountsSection**

Inside `function AccountsSection()`, add after the existing state declarations (around line 249):
```ts
const [loadError, setLoadError] = useState<string | null>(null)
```

Update the `useEffect` (around line 251):
```ts
useEffect(() => {
  async function load() {
    try {
      const accs = await getAccounts()
      if (!accs.some(a => a.type === 'cash')) {
        const cash = await addAccount({ name: 'מזומן', type: 'cash', color: '#22c55e', isActive: true })
        setAccounts([...accs, cash])
      } else {
        setAccounts(accs)
      }
    } catch (e) {
      setLoadError('שגיאה בטעינת חשבונות')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  load()
}, [])
```

In the return, replace the loading guard line 339:
```tsx
if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
```
with:
```tsx
if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>
```

- [ ] **Step 2: Add error state and catch to CategoriesSection**

Inside `function CategoriesSection()`, add after loading state (around line 591):
```ts
const [loadError, setLoadError] = useState<string | null>(null)
```

Update the `useEffect` (line 595):
```ts
useEffect(() => {
  getCategories()
    .then(cats => { setCategories(cats); setLoading(false) })
    .catch(e => { setLoadError('שגיאה בטעינת קטגוריות'); console.error(e); setLoading(false) })
}, [])
```

In the return (line 630):
```tsx
if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>
```

- [ ] **Step 3: Add error state and catch to RulesSection**

Inside `function RulesSection()`, add after loading state (around line 711):
```ts
const [loadError, setLoadError] = useState<string | null>(null)
```

Update the `useEffect` (line 716):
```ts
useEffect(() => {
  Promise.all([getRules(), getCategories()])
    .then(([rls, cats]) => {
      setRules(rls)
      const active = cats.filter(c => c.isActive)
      setCategories(active)
      if (active.length > 0) setCategoryId(active[0].id)
      setLoading(false)
    })
    .catch(e => { setLoadError('שגיאה בטעינת חוקים'); console.error(e); setLoading(false) })
}, [])
```

In the return (line 747):
```tsx
if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>
```

- [ ] **Step 4: Run tests**

```powershell
npx jest --testPathPattern="settings" --no-coverage
```

Expected: no settings test file exists, so this outputs "no tests found" — that's OK. The page is tested visually.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(app)/settings/page.tsx"
git commit -m "fix: add error handling to all settings page sections"
```
