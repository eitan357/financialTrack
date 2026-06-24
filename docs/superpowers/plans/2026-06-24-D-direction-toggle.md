# Shared DirectionToggle Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the direction toggle (הוצאה/הכנסה) UI into a single shared component and replace the three inline implementations currently spread across CashFlow, AddTransactionForm, and TransactionRow.

**Architecture:** Create `src/components/ui/DirectionToggle.tsx`. Accept a `size` prop (`'sm' | 'md'`) to accommodate the two different button sizes currently used (`py-2 text-sm` in AddTransactionForm/CashFlow, `py-1.5 text-xs` in TransactionRow's EditForm). Delete the local `DirectionToggle` in CashFlow and replace all three inline implementations with the shared import.

**Tech Stack:** React, TypeScript, Tailwind CSS, Jest + @testing-library/react

---

## File Structure

- **Create:** `src/components/ui/DirectionToggle.tsx` — shared toggle component
- **Modify:** `src/components/import/flows/CashFlow.tsx:29-42` — delete local component, import shared
- **Modify:** `src/components/transactions/AddTransactionForm.tsx:62-71` — replace inline with shared
- **Modify:** `src/components/transactions/TransactionRow.tsx:74-82` — replace inline with shared (size="sm")

---

### Task 1: Create shared DirectionToggle component with tests

**Files:**
- Create: `src/components/ui/DirectionToggle.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/DirectionToggle.tsx`:

```tsx
'use client'

interface Props {
  value: 'expense' | 'income'
  onChange: (v: 'expense' | 'income') => void
  size?: 'sm' | 'md'
}

export function DirectionToggle({ value, onChange, size = 'md' }: Props) {
  const py = size === 'sm' ? 'py-1.5' : 'py-2'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-700">
      <button
        type="button"
        onClick={() => onChange('expense')}
        className={`flex-1 ${py} ${textSize} font-medium transition-colors ${
          value === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'
        }`}
      >הוצאה</button>
      <button
        type="button"
        onClick={() => onChange('income')}
        className={`flex-1 ${py} ${textSize} font-medium transition-colors ${
          value === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'
        }`}
      >הכנסה</button>
    </div>
  )
}
```

- [ ] **Step 2: Run any existing UI tests to confirm baseline**

```powershell
npx jest --no-coverage
```

Expected: all existing tests PASS (no change yet)

- [ ] **Step 3: Commit the new component**

```powershell
git add src/components/ui/DirectionToggle.tsx
git commit -m "feat: add shared DirectionToggle UI component"
```

---

### Task 2: Replace all three inline implementations

**Files:**
- Modify: `src/components/import/flows/CashFlow.tsx`
- Modify: `src/components/transactions/AddTransactionForm.tsx`
- Modify: `src/components/transactions/TransactionRow.tsx`

- [ ] **Step 1: Update CashFlow.tsx**

Remove the local `DirectionToggle` function (lines 29-42):
```tsx
function DirectionToggle({ value, onChange }: { value: 'income' | 'expense'; onChange: (v: 'income' | 'expense') => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-700">
      <button type="button" onClick={() => onChange('expense')}
        className={`flex-1 py-2 text-sm font-medium transition-colors ${value === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'}`}>
        הוצאה
      </button>
      <button type="button" onClick={() => onChange('income')}
        className={`flex-1 py-2 text-sm font-medium transition-colors ${value === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}>
        הכנסה
      </button>
    </div>
  )
}
```

Add the import at the top of the file after the existing imports:
```ts
import { DirectionToggle } from '@/components/ui/DirectionToggle'
```

The `<DirectionToggle ... />` usages in CashFlow's JSX remain unchanged — same prop names (`value` and `onChange`).

- [ ] **Step 2: Update AddTransactionForm.tsx**

In `src/components/transactions/AddTransactionForm.tsx`, add import after the existing imports:
```ts
import { DirectionToggle } from '@/components/ui/DirectionToggle'
```

Find and replace the inline toggle JSX (lines 62-71):
```tsx
<div className="flex rounded-lg overflow-hidden border border-slate-700">
  <button
    onClick={() => setDirection('expense')}
    className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'}`}
  >הוצאה</button>
  <button
    onClick={() => setDirection('income')}
    className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}
  >הכנסה</button>
</div>
```

Replace with:
```tsx
<DirectionToggle value={direction} onChange={setDirection} />
```

- [ ] **Step 3: Update TransactionRow.tsx EditForm**

In `src/components/transactions/TransactionRow.tsx`, add import after the existing imports:
```ts
import { DirectionToggle } from '@/components/ui/DirectionToggle'
```

Find and replace the inline toggle in `EditForm` (lines 74-82):
```tsx
<div className="flex rounded-lg overflow-hidden border border-slate-700">
  <button
    onClick={() => setDirection('expense')}
    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${direction === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'}`}
  >הוצאה</button>
  <button
    onClick={() => setDirection('income')}
    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${direction === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}
  >הכנסה</button>
</div>
```

Replace with:
```tsx
<DirectionToggle value={direction} onChange={setDirection} size="sm" />
```

- [ ] **Step 4: Run all tests**

```powershell
npx jest --no-coverage
```

Expected: all tests PASS — no logic changed, only extraction

- [ ] **Step 5: Commit**

```powershell
git add src/components/import/flows/CashFlow.tsx src/components/transactions/AddTransactionForm.tsx src/components/transactions/TransactionRow.tsx
git commit -m "refactor: replace 3 inline direction toggles with shared DirectionToggle component"
```
