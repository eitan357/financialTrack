# CRUD Completion for Investments and Dividends

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete capability for investment entries, dividends, and investment types. Currently these can only be added — there is no way to correct a mistake. Add `deleteInvestmentEntry`, `deleteDividend`, and `deleteInvestmentType` to Firestore, then wire up delete buttons in the investments page UI.

**Architecture:** Follow the existing pattern: add `deleteDoc` Firestore functions, invalidate the relevant `appCache` keys (requires Plan B to be executed first so cache keys exist). Add a small delete button to each row in `investments/page.tsx`. Use a simple inline confirmation (text changes to "מחק?" with a confirm and cancel) to avoid needing a modal. Note: Plan B cache changes must be applied first — if not, the cache invalidation calls in this plan will be no-ops (safe but cache won't clear).

**Tech Stack:** TypeScript, Firebase Firestore, React, Tailwind CSS, Jest

---

## File Structure

- **Modify:** `src/lib/firestore/investments.ts` — add `deleteInvestmentEntry` and `deleteInvestmentType`
- **Modify:** `src/lib/firestore/dividends.ts` — add `deleteDividend`
- **Modify:** `src/lib/firestore/investments.test.ts` — test the two new delete functions
- **Modify:** `src/lib/firestore/dividends.test.ts` — test the new delete function
- **Modify:** `src/app/(app)/investments/page.tsx` — add delete buttons with inline confirm

---

### Task 1: Add delete functions to Firestore modules

**Files:**
- Modify: `src/lib/firestore/investments.ts`
- Modify: `src/lib/firestore/dividends.ts`
- Modify: `src/lib/firestore/investments.test.ts`
- Modify: `src/lib/firestore/dividends.test.ts`

- [ ] **Step 1: Write failing tests for delete functions**

Add to `src/lib/firestore/investments.test.ts` — add new imports and describe blocks.

Update the import line from:
```ts
import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry } from './investments'
```
to:
```ts
import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry, deleteInvestmentEntry, deleteInvestmentType } from './investments'
```

Add these describe blocks at the end of the file:

```ts
describe('deleteInvestmentEntry', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined)
    await deleteInvestmentEntry('e1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'investment_entries', 'e1')
  })
})

describe('deleteInvestmentType', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined)
    await deleteInvestmentType('t1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'investment_types', 't1')
  })
})
```

Add to `src/lib/firestore/dividends.test.ts`:

Update the import line from:
```ts
import { getDividends, addDividend } from './dividends'
```
to:
```ts
import { getDividends, addDividend, deleteDividend } from './dividends'
```

Add at the end:
```ts
describe('deleteDividend', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined)
    await deleteDividend('d1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'dividends', 'd1')
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```powershell
npx jest --testPathPattern="investments.test|dividends.test" --no-coverage
```

Expected: FAIL — `deleteInvestmentEntry is not a function` etc.

- [ ] **Step 3: Add delete functions to investments.ts**

If Plan B (cache) is already applied, the file already has `appCache` and the constants `TYPES_KEY` and `entryKey`. Add the two new exports at the bottom of `src/lib/firestore/investments.ts`:

```ts
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
```

(Add `deleteDoc` and `doc` to the existing import if not already present from Plan B.)

Add at the end of the file:

```ts
export async function deleteInvestmentEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_entries', id))
  appCache.delPrefix('investment_entries:')
}

export async function deleteInvestmentType(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_types', id))
  appCache.del(TYPES_KEY)
}
```

If Plan B has NOT been applied yet, the file won't have `appCache`, `TYPES_KEY`, or `entryKey`. In that case, write the two functions without cache calls:

```ts
export async function deleteInvestmentEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_entries', id))
}

export async function deleteInvestmentType(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_types', id))
}
```

Also add `deleteDoc` and `doc` to the imports at the top of investments.ts if not present:
```ts
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
```

- [ ] **Step 4: Add deleteDividend to dividends.ts**

Add `deleteDoc` and `doc` to the import in `src/lib/firestore/dividends.ts`:
```ts
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
```

Add at the end of the file:
```ts
export async function deleteDividend(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'dividends', id))
  appCache.delPrefix('dividends:')
}
```

If Plan B has NOT been applied (no `appCache` in the file), omit the `appCache` line:
```ts
export async function deleteDividend(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'dividends', id))
}
```

- [ ] **Step 5: Run tests to verify**

```powershell
npx jest --testPathPattern="investments.test|dividends.test" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```powershell
git add src/lib/firestore/investments.ts src/lib/firestore/dividends.ts src/lib/firestore/investments.test.ts src/lib/firestore/dividends.test.ts
git commit -m "feat: add deleteInvestmentEntry, deleteInvestmentType, and deleteDividend"
```

---

### Task 2: Add delete UI to investments page

Add delete buttons to each row. Use a two-step inline confirm: first click shows "מחק?" with Confirm/Cancel; confirmed click calls the delete function and removes the row from state.

**Files:**
- Modify: `src/app/(app)/investments/page.tsx`

- [ ] **Step 1: Add Firestore delete imports**

Update the import line in `src/app/(app)/investments/page.tsx`:
```ts
import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry, deleteInvestmentEntry, deleteInvestmentType } from '@/lib/firestore/investments'
import { getDividends, addDividend, deleteDividend } from '@/lib/firestore/dividends'
```

- [ ] **Step 2: Add delete state and handlers**

After the existing `showAddType` state (around line 20), add:
```ts
const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
const [deletingDividendId, setDeletingDividendId] = useState<string | null>(null)
const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)
```

After `handleAddType` (around line 57), add three delete handlers:
```ts
async function handleDeleteEntry(id: string) {
  await deleteInvestmentEntry(id)
  setEntries(prev => prev.filter(e => e.id !== id))
  setDeletingEntryId(null)
}

async function handleDeleteDividend(id: string) {
  await deleteDividend(id)
  setDividends(prev => prev.filter(d => d.id !== id))
  setDeletingDividendId(null)
}

async function handleDeleteType(id: string) {
  await deleteInvestmentType(id)
  setInvestmentTypes(prev => prev.filter(t => t.id !== id))
  setDeletingTypeId(null)
}
```

- [ ] **Step 3: Update investment entries rows JSX**

Find the entries map (around line 86) and replace the row:
```tsx
{entries.map(e => (
  <div key={e.id} className="flex items-center justify-between px-4 py-3">
    <div>
      <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
      <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
    </div>
    <span className="text-sm tabular-nums">{e.amount.toLocaleString('he-IL')} {e.currency}</span>
  </div>
))}
```

Replace with:
```tsx
{entries.map(e => (
  <div key={e.id} className="flex items-center justify-between px-4 py-3">
    <div>
      <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
      <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-sm tabular-nums">{e.amount.toLocaleString('he-IL')} {e.currency}</span>
      {deletingEntryId === e.id ? (
        <span className="flex items-center gap-1 text-xs">
          <button onClick={() => handleDeleteEntry(e.id)} className="text-red-400 hover:text-red-300">מחק</button>
          <span className="text-slate-600">|</span>
          <button onClick={() => setDeletingEntryId(null)} className="text-slate-400">ביטול</button>
        </span>
      ) : (
        <button onClick={() => setDeletingEntryId(e.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 4: Update dividends rows JSX**

Find the dividends map (around line 112) and replace:
```tsx
{dividends.map(d => (
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
```

Replace with:
```tsx
{dividends.map(d => (
  <div key={d.id} className="flex items-center justify-between px-4 py-3">
    <div>
      <span className="text-sm">{typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId}</span>
      <span className="text-xs text-slate-500 mr-2">{d.date.slice(5).replace('-', '/')}</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="text-left">
        <span className="text-sm tabular-nums">{d.amount.toLocaleString('he-IL')} {d.currency}</span>
        {d.ilsEquivalent && <span className="text-xs text-slate-400 block">₪{d.ilsEquivalent.toLocaleString('he-IL')}</span>}
      </div>
      {deletingDividendId === d.id ? (
        <span className="flex items-center gap-1 text-xs">
          <button onClick={() => handleDeleteDividend(d.id)} className="text-red-400 hover:text-red-300">מחק</button>
          <span className="text-slate-600">|</span>
          <button onClick={() => setDeletingDividendId(null)} className="text-slate-400">ביטול</button>
        </span>
      ) : (
        <button onClick={() => setDeletingDividendId(d.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 5: Update investment types rows JSX**

Find the types map (around line 143):
```tsx
{investmentTypes.map(t => (
  <div key={t.id} className="flex items-center justify-between px-4 py-3">
    <span className="text-sm">{t.name}</span>
    <span className="text-xs text-slate-400">{t.currency}</span>
  </div>
))}
```

Replace with:
```tsx
{investmentTypes.map(t => (
  <div key={t.id} className="flex items-center justify-between px-4 py-3">
    <span className="text-sm">{t.name}</span>
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400">{t.currency}</span>
      {deletingTypeId === t.id ? (
        <span className="flex items-center gap-1 text-xs">
          <button onClick={() => handleDeleteType(t.id)} className="text-red-400 hover:text-red-300">מחק</button>
          <span className="text-slate-600">|</span>
          <button onClick={() => setDeletingTypeId(null)} className="text-slate-400">ביטול</button>
        </span>
      ) : (
        <button onClick={() => setDeletingTypeId(t.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 6: Run investments page tests**

```powershell
npx jest --testPathPattern="investments/page" --no-coverage
```

Expected: existing tests PASS (they don't test delete UI, but shouldn't break)

- [ ] **Step 7: Run full test suite**

```powershell
npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```powershell
git add "src/app/(app)/investments/page.tsx"
git commit -m "feat: add delete buttons for investment entries, dividends, and types"
```
