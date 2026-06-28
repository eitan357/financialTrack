# Investments Unified Activity Form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 separate add-buttons on the investments page (הפקדה / הכנסה / המרה) with a single `+ הוסף פעילות` button that opens a unified form with a 3-way toggle — matching the UX of the transactions page.

**Architecture:** Create one new `AddInvestmentActivityForm` component that wraps the 3 existing sub-forms behind a toggle (קנייה / הכנסה / מכירה). The investments page gets a single boolean `showAddForm` state instead of the current `'deposit' | 'dividend' | 'conversion' | null`. Display labels in the list are updated to match the toggle names.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript strict, Tailwind CSS, Hebrew RTL UI.

## Global Constraints

- Hebrew RTL UI; toggle is a horizontal pill group like `DirectionToggle`
- The 3 existing form components (`AddInvestmentEntryForm`, `AddDividendForm`, `AddInvestmentConversionForm`) are NOT changed
- Toggle labels: **קנייה** (was: הפקדה) | **הכנסה** (was: הכנסה / דיבידנד) | **מכירה** (was: המרה)
- List display labels updated to match: `הפקדה:` → `קנייה:`, `הכנסה:` stays, `מכירה:` stays
- Button text: `+ הוסף פעילות` (hidden while form is open, like transactions page)
- No tests required (UI restructuring with no logic change)
- Run `npx tsc --noEmit` to verify TypeScript after each task

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `src/components/investments/AddInvestmentActivityForm.tsx` |
| **Modify** | `src/app/(app)/investments/page.tsx` |

---

## Task 1: Create `AddInvestmentActivityForm`

**Files:**
- Create: `src/components/investments/AddInvestmentActivityForm.tsx`

**Interfaces — Consumes:**
```typescript
// Existing sub-form components (already exist, do NOT modify):
import { AddInvestmentEntryForm } from './AddInvestmentEntryForm'
import { AddDividendForm } from './AddDividendForm'
import { AddInvestmentConversionForm } from './AddInvestmentConversionForm'
import type { InvestmentType, InvestmentEntry, Dividend, Account, InvestmentConversion } from '@/lib/types'
```

**Interfaces — Produces (used by Task 2):**
```typescript
interface Props {
  types: InvestmentType[]
  portfolios: Account[]
  bankAccounts: Account[]
  onSubmitEntry: (entry: Omit<InvestmentEntry, 'id'>) => void
  onSubmitDividend: (dividend: Omit<Dividend, 'id'>) => void
  onSubmitConversion: (conv: Omit<InvestmentConversion, 'id'>) => void
  onCancel: () => void
}
export function AddInvestmentActivityForm(props: Props): JSX.Element
```

- [ ] **Step 1: Create the component**

Create `src/components/investments/AddInvestmentActivityForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { AddInvestmentEntryForm } from './AddInvestmentEntryForm'
import { AddDividendForm } from './AddDividendForm'
import { AddInvestmentConversionForm } from './AddInvestmentConversionForm'
import type { InvestmentType, InvestmentEntry, Dividend, Account, InvestmentConversion } from '@/lib/types'

type ActivityType = 'deposit' | 'dividend' | 'conversion'

interface Props {
  types: InvestmentType[]
  portfolios: Account[]
  bankAccounts: Account[]
  onSubmitEntry: (entry: Omit<InvestmentEntry, 'id'>) => void
  onSubmitDividend: (dividend: Omit<Dividend, 'id'>) => void
  onSubmitConversion: (conv: Omit<InvestmentConversion, 'id'>) => void
  onCancel: () => void
}

const TOGGLE_OPTIONS: { type: ActivityType; label: string }[] = [
  { type: 'deposit', label: 'קנייה' },
  { type: 'dividend', label: 'הכנסה' },
  { type: 'conversion', label: 'מכירה' },
]

export function AddInvestmentActivityForm({
  types, portfolios, bankAccounts,
  onSubmitEntry, onSubmitDividend, onSubmitConversion,
  onCancel,
}: Props) {
  const [activityType, setActivityType] = useState<ActivityType>('deposit')

  return (
    <div className="mb-4 space-y-3">
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        {TOGGLE_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setActivityType(type)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activityType === type
                ? 'bg-accent/20 text-accent'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activityType === 'deposit' && (
        <AddInvestmentEntryForm
          types={types}
          portfolios={portfolios}
          bankAccounts={bankAccounts}
          onSubmit={onSubmitEntry}
          onCancel={onCancel}
        />
      )}
      {activityType === 'dividend' && (
        <AddDividendForm
          types={types}
          bankAccounts={bankAccounts}
          onSubmit={onSubmitDividend}
          onCancel={onCancel}
        />
      )}
      {activityType === 'conversion' && (
        <AddInvestmentConversionForm
          types={types}
          bankAccounts={bankAccounts}
          onSubmit={onSubmitConversion}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/investments/AddInvestmentActivityForm.tsx
git commit -m "feat: add AddInvestmentActivityForm unified wrapper with 3-way toggle"
```

---

## Task 2: Update Investments Page

Replace 3 buttons with single `+ הוסף פעילות` button, wire up `AddInvestmentActivityForm`, update list labels.

**Files:**
- Modify: `src/app/(app)/investments/page.tsx`

**Interfaces — Consumes from Task 1:**
```typescript
import { AddInvestmentActivityForm } from '@/components/investments/AddInvestmentActivityForm'
```

- [ ] **Step 1: Replace imports and state**

In `src/app/(app)/investments/page.tsx`:

1. Remove imports for the 3 individual forms:
```tsx
// Remove these 3 lines:
import { AddInvestmentEntryForm } from '@/components/investments/AddInvestmentEntryForm'
import { AddDividendForm } from '@/components/investments/AddDividendForm'
import { AddInvestmentConversionForm } from '@/components/investments/AddInvestmentConversionForm'
```

2. Add import for the unified form:
```tsx
import { AddInvestmentActivityForm } from '@/components/investments/AddInvestmentActivityForm'
```

3. Replace the `showAddType` state:
```tsx
// Remove:
const [showAddType, setShowAddType] = useState<'deposit' | 'dividend' | 'conversion' | null>(null)

// Add:
const [showAddForm, setShowAddForm] = useState(false)
```

- [ ] **Step 2: Update handlers to close form**

The handlers `handleAddEntry`, `handleAddDividend`, `handleAddConversion` currently call `setShowAddType(null)`. Update them to call `setShowAddForm(false)`:

```tsx
async function handleAddEntry(entry: Omit<InvestmentEntry, 'id'>) {
  const newEntry = await addInvestmentEntry(entry)
  setEntries(prev => [...prev, newEntry])
  setShowAddForm(false)
}

async function handleAddDividend(dividend: Omit<Dividend, 'id'>) {
  const newDividend = await addDividend(dividend)
  setDividends(prev => [...prev, newDividend])
  setShowAddForm(false)
}

async function handleAddConversion(conv: Omit<InvestmentConversion, 'id'>) {
  const newConv = await addInvestmentConversion(conv)
  setConversions(prev => [...prev, newConv])
  setShowAddForm(false)
}
```

- [ ] **Step 3: Replace the add-buttons section and form panels**

Find the "Add buttons" section (lines ~168–213) and replace everything from `{/* Add buttons */}` through the last `</div>` of the three conditional forms with:

```tsx
{/* Add button — hidden while form is open, like transactions page */}
{!showAddForm && (
  <div className="flex justify-end mb-4">
    <button
      onClick={() => setShowAddForm(true)}
      className="text-sm text-accent font-medium"
    >
      + הוסף פעילות
    </button>
  </div>
)}

{showAddForm && (
  <AddInvestmentActivityForm
    types={investmentTypes}
    portfolios={portfolios}
    bankAccounts={bankAccounts}
    onSubmitEntry={handleAddEntry}
    onSubmitDividend={handleAddDividend}
    onSubmitConversion={handleAddConversion}
    onCancel={() => setShowAddForm(false)}
  />
)}
```

- [ ] **Step 4: Update list display labels**

In the `displayItems.map(item => ...)` block, find the deposit row label and update it:

```tsx
// Find (deposit row, around line 233):
<span className="text-sm text-purple-400">הפקדה: {item.typeName}</span>

// Change to:
<span className="text-sm text-purple-400">קנייה: {item.typeName}</span>
```

The dividend row already shows `הכנסה:` and the conversion row already shows `מכירה:` — both stay as-is.

Also update the footer totals label:
```tsx
// Find (footer, around line 299):
<span>הפקדות</span>

// Change to:
<span>קניות</span>
```

- [ ] **Step 5: Run TypeScript check**

```
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/investments/page.tsx
git commit -m "feat: replace 3 add-buttons in investments with unified '+ הוסף פעילות' button"
```
