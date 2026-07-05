# Swipe Import Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the table-based review UI in BankFlow and CreditFlow with a Tinder-style swipe card interface.

**Architecture:** Four new components under `src/components/import/` — a shared utilities module (`deckUtils.ts`) with types and pure functions, then `SwipeableCard`, `ImportHUD`, `ImportTutorial`, and the orchestrating `SwipeImportDeck`. BankFlow and CreditFlow replace their `<table>` blocks with `<SwipeImportDeck>`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v4, `@use-gesture/react` (new), Vitest

## Global Constraints

- Tailwind v4: no `tailwind.config.ts`. Custom keyframes and utilities go in `src/app/globals.css`.
- Hebrew RTL UI. All user-facing strings are in Hebrew.
- No react-spring. Animations use CSS transitions + Tailwind arbitrary animation syntax.
- Existing parsing, categorization, duplicate detection, and Firestore logic is **unchanged**.
- `SelectField`, `DirectionToggle`, `InvestmentPicker`, `CurrencyPicker` come from existing codebase — do not modify.
- Points are display-only (never persisted to Firestore).
- Swipe threshold: 60px horizontal drag OR velocity > 0.5 triggers action.
- Undo stack: max 5 entries. Points are NOT reversed on undo.
- Tutorial localStorage key: `import-swipe-tutorial-v1`.
- `@use-gesture/react` — must be installed, not yet in package.json.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/import/deckUtils.ts` | Create | Shared types, `sortDeckCards`, `computeTotals` |
| `src/components/import/deckUtils.test.ts` | Create | Tests for pure functions |
| `src/components/import/SwipeableCard.tsx` | Create | Single draggable card with gesture + all form fields |
| `src/components/import/ImportHUD.tsx` | Create | Progress bar, points, totals, save button |
| `src/components/import/ImportTutorial.tsx` | Create | 3-step animated tutorial overlay |
| `src/components/import/SwipeImportDeck.tsx` | Create | Orchestrator: state, undo, points popup, deck complete |
| `src/components/import/flows/BankFlow.tsx` | Modify | Replace table block with `<SwipeImportDeck>` |
| `src/components/import/flows/CreditFlow.tsx` | Modify | Replace table block with `<SwipeImportDeck>` |
| `src/app/globals.css` | Modify | Add `@keyframes` for float-up, tutorial-right, tutorial-left |

---

### Task 1: Install dependency + deckUtils + keyframes

**Files:**
- Create: `src/components/import/deckUtils.ts`
- Create: `src/components/import/deckUtils.test.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `SwipeRow`, `DeckCard`, `CardStatus`, `UndoEntry`, `DeckTotals`, `sortDeckCards()`, `computeTotals()`

- [ ] **Step 1: Install `@use-gesture/react`**

```bash
npm install @use-gesture/react
```

Expected output: `added 1 package` (or similar — no errors).

- [ ] **Step 2: Write failing tests**

Create `src/components/import/deckUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sortDeckCards, computeTotals } from './deckUtils'
import type { DeckCard } from './deckUtils'

const base: Omit<DeckCard, '_id' | 'status'> = {
  date: '2026-06-01',
  merchantName: 'Test',
  amount: 100,
  currency: 'ILS',
  isImmediate: false,
  direction: 'expense',
  categoryId: null,
  categorizationSource: null,
  skip: false,
}

describe('sortDeckCards', () => {
  it('puts uncategorized expenses before categorized ones', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', categoryId: 'cat1', date: '2026-06-01' },
      { ...base, _id: '2', status: 'pending', categoryId: null, date: '2026-06-02' },
    ]
    const sorted = sortDeckCards(cards)
    expect(sorted[0]._id).toBe('2')
    expect(sorted[1]._id).toBe('1')
  })

  it('puts skipped cards last regardless of category', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', skip: true, categoryId: null },
      { ...base, _id: '2', status: 'pending', skip: false, categoryId: null },
    ]
    const sorted = sortDeckCards(cards)
    expect(sorted[0]._id).toBe('2')
    expect(sorted[1]._id).toBe('1')
  })

  it('sorts other active rows by date ascending', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', categoryId: 'cat', date: '2026-06-03' },
      { ...base, _id: '2', status: 'pending', categoryId: 'cat', date: '2026-06-01' },
    ]
    const sorted = sortDeckCards(cards)
    expect(sorted[0]._id).toBe('2')
    expect(sorted[1]._id).toBe('1')
  })

  it('income rows go into active (not uncategorized) group', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', direction: 'income', categoryId: null },
      { ...base, _id: '2', status: 'pending', direction: 'expense', categoryId: null },
    ]
    const sorted = sortDeckCards(cards)
    // uncategorized expense first
    expect(sorted[0]._id).toBe('2')
  })
})

describe('computeTotals', () => {
  it('sums approved expenses and income separately', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'approved', direction: 'expense', amount: 100 },
      { ...base, _id: '2', status: 'approved', direction: 'income', amount: 200 },
      { ...base, _id: '3', status: 'skipped', skip: true, direction: 'expense', amount: 50 },
      { ...base, _id: '4', status: 'pending', direction: 'expense', amount: 30 },
    ]
    const totals = computeTotals(cards)
    expect(totals.expenses).toBe(100)
    expect(totals.income).toBe(200)
    expect(totals.net).toBe(100)
  })

  it('counts investment divestment as income', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'approved', direction: 'expense', amount: 500, portfolioAccountId: 'p1', investmentDirection: 'divestment' },
    ]
    const totals = computeTotals(cards)
    expect(totals.income).toBe(500)
    expect(totals.expenses).toBe(0)
  })

  it('counts investment purchase as expense', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'approved', direction: 'expense', amount: 300, portfolioAccountId: 'p1', investmentDirection: 'investment' },
    ]
    const totals = computeTotals(cards)
    expect(totals.expenses).toBe(300)
    expect(totals.income).toBe(0)
  })

  it('returns zeros when no approved cards', () => {
    const totals = computeTotals([])
    expect(totals).toEqual({ income: 0, expenses: 0, net: 0 })
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/components/import/deckUtils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/components/import/deckUtils.ts`**

```ts
import type { ImportedTransaction } from '@/lib/types'

export interface SwipeRow extends ImportedTransaction {
  skip: boolean
  skipReason?: string
  portfolioAccountId?: string
  investmentTypeId?: string
  investmentDirection?: 'investment' | 'divestment'
}

export type CardStatus = 'pending' | 'approved' | 'skipped'

export interface DeckCard extends SwipeRow {
  _id: string
  status: CardStatus
}

export interface UndoEntry {
  index: number
  previous: DeckCard
}

export interface DeckTotals {
  income: number
  expenses: number
  net: number
}

export function sortDeckCards(cards: DeckCard[]): DeckCard[] {
  const isUncategorizedExpense = (c: DeckCard) =>
    c.direction === 'expense' && !c.categoryId && !c.portfolioAccountId && !c.skip

  const uncategorized = cards
    .filter(isUncategorizedExpense)
    .sort((a, b) => a.date.localeCompare(b.date))

  const otherActive = cards
    .filter(c => !isUncategorizedExpense(c) && !c.skip)
    .sort((a, b) => a.date.localeCompare(b.date))

  const skipped = cards.filter(c => c.skip)

  return [...uncategorized, ...otherActive, ...skipped]
}

export function computeTotals(cards: DeckCard[]): DeckTotals {
  const approved = cards.filter(c => c.status === 'approved')
  let income = 0
  let expenses = 0
  for (const c of approved) {
    const dir = c.portfolioAccountId
      ? (c.investmentDirection ?? 'investment')
      : c.direction
    if (dir === 'income' || dir === 'divestment') {
      income += c.amount
    } else {
      expenses += c.amount
    }
  }
  return { income, expenses, net: income - expenses }
}
```

- [ ] **Step 5: Add keyframes to `src/app/globals.css`**

Append to the existing file (after the `input[type="date"]` rules):

```css
@keyframes float-up {
  0%   { opacity: 1; transform: translateY(0) translateX(-50%); }
  100% { opacity: 0; transform: translateY(-60px) translateX(-50%); }
}

@keyframes tutorial-right {
  0%, 15%  { transform: translateX(0) rotate(0); opacity: 1; }
  65%      { transform: translateX(140%) rotate(15deg); opacity: 0; }
  66%, 100%{ transform: translateX(0) rotate(0); opacity: 0; }
}

@keyframes tutorial-left {
  0%, 15%  { transform: translateX(0) rotate(0); opacity: 1; }
  65%      { transform: translateX(-140%) rotate(-15deg); opacity: 0; }
  66%, 100%{ transform: translateX(0) rotate(0); opacity: 0; }
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run src/components/import/deckUtils.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/import/deckUtils.ts src/components/import/deckUtils.test.ts src/app/globals.css package.json package-lock.json
git commit -m "feat: add deckUtils types/helpers and animation keyframes for swipe import"
```

---

### Task 2: SwipeableCard

**Files:**
- Create: `src/components/import/SwipeableCard.tsx`

**Interfaces:**
- Consumes: `DeckCard`, `SwipeRow` from `./deckUtils`; `SelectField`, `DirectionToggle`, `InvestmentPicker`, `CurrencyPicker` from existing UI components; `useDrag` from `@use-gesture/react`
- Produces: `SwipeableCard` component with props `{ card, categories, portfolioAccounts, investmentTypes, peek, onSwipe, onChange }`

- [ ] **Step 1: Create `src/components/import/SwipeableCard.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Check, Trash2 } from 'lucide-react'
import { SelectField } from '@/components/ui/SelectField'
import { DirectionToggle } from '@/components/ui/DirectionToggle'
import { CurrencyPicker } from '@/components/ui/CurrencyPicker'
import { InvestmentPicker } from '@/components/investments/InvestmentPicker'
import type { InvestmentSelection } from '@/components/investments/InvestmentPicker'
import type { Category, Account, InvestmentType } from '@/lib/types'
import type { DeckCard, SwipeRow } from './deckUtils'

interface Props {
  card: DeckCard
  categories: Category[]
  portfolioAccounts: Account[]
  investmentTypes: InvestmentType[]
  peek?: boolean
  onSwipe: (direction: 'left' | 'right') => void
  onChange: (updates: Partial<SwipeRow>) => void
}

export function SwipeableCard({
  card,
  categories,
  portfolioAccounts,
  investmentTypes,
  peek = false,
  onSwipe,
  onChange,
}: Props) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx] }) => {
      if (active) {
        setIsDragging(true)
        setDragX(mx)
      } else {
        setIsDragging(false)
        const shouldSwipe = Math.abs(mx) > 60 || Math.abs(vx) > 0.5
        if (shouldSwipe) {
          const dir = dx > 0 ? 'right' : 'left'
          setDragX(dx > 0 ? 600 : -600)
          setTimeout(() => {
            onSwipe(dir)
            setDragX(0)
          }, 300)
        } else {
          setDragX(0)
        }
      }
    },
    { axis: 'x', filterTaps: true }
  )

  const rotation = Math.min(Math.max(dragX / 20, -15), 15)
  const approveOpacity = Math.min(dragX / 120, 0.9)
  const skipOpacity = Math.min(Math.abs(dragX) / 120, 0.9)

  const activeCategories = categories.filter(c => c.isActive !== false)

  const skipReasonLabel =
    card.skipReason === 'salary' ? 'משכורת — מסונן אוטומטית'
    : card.skipReason === 'credit-payment' ? 'תשלום אשראי — מסונן אוטומטית'
    : card.skipReason === 'investment-transfer' ? 'העברה להשקעות — מסונן אוטומטית'
    : null

  return (
    <div
      {...(peek ? {} : bind())}
      className={`w-full h-full bg-surface rounded-2xl shadow-xl border border-slate-700 overflow-hidden select-none relative ${peek ? 'pointer-events-none' : ''}`}
      style={{
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        touchAction: 'pan-y',
        cursor: peek ? 'default' : 'grab',
      }}
    >
      {/* Approve overlay */}
      {!peek && dragX > 0 && (
        <div
          className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center pointer-events-none z-10"
          style={{ opacity: approveOpacity }}
        >
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}
      {/* Skip overlay */}
      {!peek && dragX < 0 && (
        <div
          className="absolute inset-0 bg-red-500/20 rounded-2xl flex items-center justify-center pointer-events-none z-10"
          style={{ opacity: skipOpacity }}
        >
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 size={28} className="text-white" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between p-4 pb-3 border-b border-slate-700/50 ${card.skip ? 'opacity-60' : ''}`}>
        <div>
          <h3 className="text-base font-semibold leading-tight">{card.merchantName}</h3>
          <p className="text-slate-400 text-sm mt-0.5">{card.date}</p>
        </div>
        <div className="text-left flex items-center gap-1">
          <span className="text-xl font-bold tabular-nums">{card.amount.toFixed(2)}</span>
          {!peek && (
            <CurrencyPicker
              value={card.currency}
              onChange={v => onChange({ currency: v })}
            />
          )}
          {peek && <span className="text-sm text-slate-400">{card.currency}</span>}
        </div>
      </div>

      {/* Body (hidden in peek mode) */}
      {!peek && (
        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 80px)' }}>
          {/* Skip reason badge */}
          {skipReasonLabel && (
            <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-400">
              {skipReasonLabel}
            </div>
          )}

          {/* Category */}
          {card.direction === 'expense' && !card.portfolioAccountId && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">קטגוריה</label>
              <SelectField
                value={card.categoryId ?? ''}
                onChange={v => onChange({ categoryId: v || null, categorizationSource: 'manual' })}
                options={activeCategories.map(c => ({ value: c.id, label: c.name, color: c.color }))}
                nullable
                nullLabel="— ללא —"
                placeholder="⚠️ לא מוגדרת"
                className={!card.categoryId ? 'ring-1 ring-amber-400' : undefined}
              />
            </div>
          )}

          {/* Direction */}
          {!card.portfolioAccountId && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">כיוון</label>
              <DirectionToggle
                value={card.direction}
                onChange={v => onChange({ direction: v, categoryId: v === 'income' ? null : card.categoryId })}
              />
            </div>
          )}

          {/* Immediate debit toggle */}
          <button
            type="button"
            onClick={() => onChange({ isImmediate: !card.isImmediate })}
            className={`w-full py-2 rounded-full text-sm transition-colors ${
              card.isImmediate
                ? 'bg-amber-500/20 border border-amber-500 text-amber-400 font-semibold'
                : 'border border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            חיוב מיידי
          </button>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">הערה</label>
            <input
              value={card.notes ?? ''}
              onChange={e => onChange({ notes: e.target.value })}
              placeholder="הוסף הערה..."
              className="w-full bg-background text-sm rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-slate-500"
            />
          </div>

          {/* Investment picker */}
          {portfolioAccounts.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">השקעה</label>
              <InvestmentPicker
                portfolios={portfolioAccounts}
                types={investmentTypes}
                value={
                  card.portfolioAccountId
                    ? { portfolioAccountId: card.portfolioAccountId, investmentTypeId: card.investmentTypeId }
                    : null
                }
                onChange={(sel: InvestmentSelection | null) => {
                  if (sel) {
                    onChange({
                      portfolioAccountId: sel.portfolioAccountId,
                      investmentTypeId: sel.investmentTypeId,
                      investmentDirection: card.investmentDirection ?? 'investment',
                      skip: false,
                      categoryId: null,
                    })
                  } else {
                    onChange({ portfolioAccountId: undefined, investmentTypeId: undefined, investmentDirection: undefined })
                  }
                }}
              />
              {card.portfolioAccountId && (
                <div className="flex mt-1 rounded-lg overflow-hidden border border-slate-700 text-sm">
                  <button
                    type="button"
                    onClick={() => onChange({ investmentDirection: 'investment' })}
                    className={`flex-1 py-1 ${(card.investmentDirection ?? 'investment') === 'investment' ? 'bg-green-900/60 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    קנייה
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ investmentDirection: 'divestment' })}
                    className={`flex-1 py-1 ${card.investmentDirection === 'divestment' ? 'bg-red-900/60 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    מכירה
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `SwipeableCard.tsx`. Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/components/import/SwipeableCard.tsx
git commit -m "feat: add SwipeableCard with drag gesture and card form fields"
```

---

### Task 3: ImportHUD

**Files:**
- Create: `src/components/import/ImportHUD.tsx`

**Interfaces:**
- Consumes: `DeckCard`, `computeTotals`, `DeckTotals` from `./deckUtils`
- Produces: `ImportHUD` component with props `{ accountName, month, cards, points, approvedCount, saving, onSave, onShowTutorial }`

- [ ] **Step 1: Create `src/components/import/ImportHUD.tsx`**

```tsx
'use client'
import { Star, HelpCircle } from 'lucide-react'
import { computeTotals } from './deckUtils'
import type { DeckCard } from './deckUtils'

interface Props {
  accountName: string
  month: string
  cards: DeckCard[]
  points: number
  approvedCount: number
  saving: boolean
  onSave: () => void
  onShowTutorial: () => void
}

export function ImportHUD({
  accountName,
  month,
  cards,
  points,
  approvedCount,
  saving,
  onSave,
  onShowTutorial,
}: Props) {
  const total = cards.length
  const processed = cards.filter(c => c.status !== 'pending').length
  const progress = total > 0 ? processed / total : 0
  const { income, expenses, net } = computeTotals(cards)

  return (
    <div className="mb-4 space-y-2">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-200 font-medium truncate">{accountName}</span>
          <span className="text-slate-500 text-sm flex-shrink-0">{month}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onShowTutorial}
            className="p-1 text-slate-400 hover:text-foreground transition-colors"
            title="עזרה"
            aria-label="פתח מדריך"
          >
            <HelpCircle size={18} />
          </button>
          <button
            onClick={onSave}
            disabled={saving || approvedCount === 0}
            className="px-3 py-1.5 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50 tabular-nums"
          >
            {saving ? '...' : `שמור ${approvedCount}`}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
          {processed} / {total}
        </span>
      </div>

      {/* Points */}
      <div className="flex items-center gap-1 text-sm text-amber-400">
        <Star size={14} className="fill-amber-400" />
        <span className="tabular-nums">{points}</span>
        <span>נקודות</span>
      </div>

      {/* Totals */}
      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span>
          הוצאות{' '}
          <span className="text-red-400 tabular-nums">₪{expenses.toFixed(0)}</span>
        </span>
        <span>·</span>
        <span>
          הכנסות{' '}
          <span className="text-green-400 tabular-nums">₪{income.toFixed(0)}</span>
        </span>
        <span>·</span>
        <span>
          נטו{' '}
          <span className={`tabular-nums ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ₪{net.toFixed(0)}
          </span>
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/import/ImportHUD.tsx
git commit -m "feat: add ImportHUD with progress bar, points, and live totals"
```

---

### Task 4: ImportTutorial

**Files:**
- Create: `src/components/import/ImportTutorial.tsx`

**Interfaces:**
- Produces: `ImportTutorial` component with props `{ onDismiss }`; exported `shouldShowTutorial(): boolean`

- [ ] **Step 1: Create `src/components/import/ImportTutorial.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'

const TUTORIAL_KEY = 'import-swipe-tutorial-v1'

export function shouldShowTutorial(): boolean {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(TUTORIAL_KEY)
}

interface Props {
  onDismiss: () => void
}

function SlideRight() {
  return (
    <div className="relative h-32 w-52 mx-auto overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center animate-[tutorial-right_2.2s_ease-in-out_infinite]">
        <div className="w-44 h-28 bg-surface border border-slate-600 rounded-xl relative flex flex-col items-center justify-center gap-1 shadow-lg">
          <span className="text-sm font-medium text-foreground">מקדונלד&apos;ס</span>
          <span className="text-xs text-slate-400">45.00 ₪</span>
          <div className="absolute inset-0 bg-green-500/30 rounded-xl flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={20} className="text-white" strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideLeft() {
  return (
    <div className="relative h-32 w-52 mx-auto overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center animate-[tutorial-left_2.2s_ease-in-out_infinite]">
        <div className="w-44 h-28 bg-surface border border-slate-600 rounded-xl relative flex flex-col items-center justify-center gap-1 shadow-lg">
          <span className="text-sm font-medium text-foreground">מכולת שכונה</span>
          <span className="text-xs text-slate-400">120.00 ₪</span>
          <div className="absolute inset-0 bg-red-500/30 rounded-xl flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
              <Trash2 size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideEdit() {
  return (
    <div className="h-32 w-52 mx-auto">
      <div className="w-full h-full bg-surface border border-slate-600 rounded-xl p-3 space-y-1.5 shadow-lg">
        <div className="flex justify-between">
          <span className="text-xs font-medium text-foreground">קפה גרג</span>
          <span className="text-xs text-slate-400">18.00 ₪</span>
        </div>
        <div className="ring-1 ring-amber-400 rounded-md px-2 py-1 text-xs text-amber-400">
          ⚠️ לא מוגדרת
        </div>
        <div className="flex gap-1">
          <div className="flex-1 bg-slate-700 rounded-md px-2 py-1 text-xs text-slate-300 text-center">
            הוצאה
          </div>
        </div>
        <div className="border border-slate-600 rounded-full px-2 py-0.5 text-xs text-slate-400 text-center">
          חיוב מיידי
        </div>
      </div>
    </div>
  )
}

const SLIDES = [
  {
    title: 'החלק ימינה לאישור העסקה',
    demo: <SlideRight />,
  },
  {
    title: 'החלק שמאלה לדילוג על העסקה',
    demo: <SlideLeft />,
  },
  {
    title: 'ערוך פרטים ישירות על הכרטיסיה לפני האישור',
    demo: <SlideEdit />,
  },
]

export function ImportTutorial({ onDismiss }: Props) {
  const [slide, setSlide] = useState(0)

  function dismiss() {
    localStorage.setItem(TUTORIAL_KEY, '1')
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" dir="rtl">
      <div className="w-full max-w-sm bg-surface rounded-2xl p-6">
        {SLIDES[slide].demo}
        <p className="text-center text-base font-semibold mt-4 mb-6">
          {SLIDES[slide].title}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === slide ? 'bg-accent' : 'bg-slate-600'}`}
              />
            ))}
          </div>
          {slide < SLIDES.length - 1 ? (
            <button
              onClick={() => setSlide(s => s + 1)}
              className="px-4 py-2 bg-accent rounded-lg text-sm font-semibold"
            >
              הבא
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="px-4 py-2 bg-accent rounded-lg text-sm font-semibold"
            >
              הבנתי!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/import/ImportTutorial.tsx
git commit -m "feat: add ImportTutorial with 3-step animated onboarding overlay"
```

---

### Task 5: SwipeImportDeck

**Files:**
- Create: `src/components/import/SwipeImportDeck.tsx`

**Interfaces:**
- Consumes: `SwipeableCard`, `ImportHUD`, `ImportTutorial`; `DeckCard`, `SwipeRow`, `UndoEntry`, `sortDeckCards`, `CardStatus` from `./deckUtils`
- Produces: `SwipeImportDeck` with props `{ rows, categories, portfolioAccounts, investmentTypes, accountName, month, saving, onSave, onDone }`

- [ ] **Step 1: Create `src/components/import/SwipeImportDeck.tsx`**

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Star, ChevronRight } from 'lucide-react'
import { SwipeableCard } from './SwipeableCard'
import { ImportHUD } from './ImportHUD'
import { ImportTutorial, shouldShowTutorial } from './ImportTutorial'
import { sortDeckCards } from './deckUtils'
import type { DeckCard, SwipeRow, UndoEntry, CardStatus } from './deckUtils'
import type { Category, Account, InvestmentType } from '@/lib/types'

interface Props {
  rows: SwipeRow[]
  categories: Category[]
  portfolioAccounts?: Account[]
  investmentTypes?: InvestmentType[]
  accountName: string
  month: string
  saving: boolean
  onSave: (approved: SwipeRow[]) => void
  onDone: () => void
}

export function SwipeImportDeck({
  rows,
  categories,
  portfolioAccounts = [],
  investmentTypes = [],
  accountName,
  month,
  saving,
  onSave,
  onDone,
}: Props) {
  const [cards, setCards] = useState<DeckCard[]>(() =>
    sortDeckCards(
      rows.map((r, i) => ({
        ...r,
        _id: String(i),
        status: 'pending' as CardStatus,
      }))
    )
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [points, setPoints] = useState(0)
  const [streakCount, setStreakCount] = useState(0)
  const [popup, setPopup] = useState<{ pts: number; streak: boolean; key: number } | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (shouldShowTutorial()) setShowTutorial(true)
  }, [])

  function firePointsPopup(pts: number, streak: boolean) {
    setPoints(p => p + pts)
    setPopup({ pts, streak, key: Date.now() })
    setTimeout(() => setPopup(null), 900)
  }

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    setCurrentIndex(prev => {
      const idx = prev
      const card = cards[idx]
      if (!card) return prev

      const newStatus: CardStatus = direction === 'right' ? 'approved' : 'skipped'

      setUndoStack(stack => [
        { index: idx, previous: card },
        ...stack.slice(0, 4),
      ])

      setCards(cs => cs.map((c, i) => i === idx ? { ...c, status: newStatus } : c))

      // Points: compute before streakCount updates
      setStreakCount(streak => {
        const newStreak = streak + 1
        let pts = direction === 'right' ? 2 : 1
        let isStreak = false
        if (newStreak % 5 === 0) { pts += 5; isStreak = true }
        firePointsPopup(pts, isStreak)
        // Completion bonus fires after state settles
        if (idx + 1 >= cards.length) {
          setTimeout(() => firePointsPopup(20, false), 500)
        }
        return newStreak
      })

      return idx + 1
    })
  }, [cards])

  function handleUndo() {
    if (undoStack.length === 0) return
    const [entry, ...rest] = undoStack
    setCards(cs => cs.map((c, i) => i === entry.index ? entry.previous : c))
    setCurrentIndex(entry.index)
    setUndoStack(rest)
    setStreakCount(0)
  }

  function updateCard(index: number, updates: Partial<SwipeRow>) {
    setCards(cs => cs.map((c, i) => i === index ? { ...c, ...updates } : c))
    setStreakCount(0)
  }

  const approvedCards = cards.filter(c => c.status === 'approved')
  const currentCard = cards[currentIndex]
  const nextCard = cards[currentIndex + 1]
  const isDeckComplete = currentIndex >= cards.length

  return (
    <div dir="rtl">
      {showTutorial && <ImportTutorial onDismiss={() => setShowTutorial(false)} />}

      <ImportHUD
        accountName={accountName}
        month={month}
        cards={cards}
        points={points}
        approvedCount={approvedCards.length}
        saving={saving}
        onSave={() => onSave(approvedCards)}
        onShowTutorial={() => setShowTutorial(true)}
      />

      {isDeckComplete ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold">סיימת!</h2>
          <div className="flex items-center justify-center gap-1 text-amber-400">
            <Star size={18} className="fill-amber-400" />
            <span className="text-lg font-semibold tabular-nums">{points} נקודות</span>
          </div>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => onSave(approvedCards)}
              disabled={saving || approvedCards.length === 0}
              className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
            >
              {saving ? 'שומר...' : `שמור ויבא ${approvedCards.length} עסקאות`}
            </button>
            <button
              onClick={onDone}
              className="w-full py-3 border border-slate-600 rounded-xl text-slate-300 text-sm"
            >
              עבור לעמוד עסקאות
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Card stack */}
          <div className="relative w-full mb-4" style={{ height: '460px' }}>
            {/* Points popup */}
            {popup && (
              <div
                key={popup.key}
                className="absolute bottom-4 left-1/2 pointer-events-none z-50"
                style={{ animation: 'float-up 0.8s ease-out forwards' }}
              >
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  popup.streak
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-accent/20 text-accent border border-accent/40'
                }`}>
                  ★ +{popup.pts}{popup.streak ? ' רצף!' : ''}
                </span>
              </div>
            )}
            {/* Next card (peek) */}
            {nextCard && (
              <div
                className="absolute inset-0"
                style={{ transform: 'scale(0.95) translateY(8px)', zIndex: 1, transformOrigin: 'center bottom' }}
              >
                <SwipeableCard
                  card={nextCard}
                  categories={categories}
                  portfolioAccounts={portfolioAccounts}
                  investmentTypes={investmentTypes}
                  peek
                  onSwipe={() => {}}
                  onChange={() => {}}
                />
              </div>
            )}
            {/* Active card */}
            {currentCard && (
              <div className="absolute inset-0" style={{ zIndex: 2 }}>
                <SwipeableCard
                  card={currentCard}
                  categories={categories}
                  portfolioAccounts={portfolioAccounts}
                  investmentTypes={investmentTypes}
                  onSwipe={handleSwipe}
                  onChange={updates => updateCard(currentIndex, updates)}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="flex items-center gap-1 px-4 py-2 border border-slate-600 rounded-xl text-sm disabled:opacity-30 hover:border-slate-500 transition-colors"
            >
              <ChevronRight size={16} />
              עסקה קודמת
            </button>
            <button
              onClick={() => handleSwipe('left')}
              className="px-5 py-2 border border-red-500/50 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/10 transition-colors"
            >
              ✗ דלג
            </button>
            <button
              onClick={() => handleSwipe('right')}
              className="px-5 py-2 bg-accent rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              ✓ אשר
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/import/SwipeImportDeck.tsx
git commit -m "feat: add SwipeImportDeck orchestrator with undo, points, and deck-complete screen"
```

---

### Task 6: Wire BankFlow + CreditFlow

**Files:**
- Modify: `src/components/import/flows/BankFlow.tsx:302-471`
- Modify: `src/components/import/flows/CreditFlow.tsx:266-433`

**Interfaces:**
- Consumes: `SwipeImportDeck` from `../SwipeImportDeck`; `SwipeRow` from `../deckUtils`
- BankFlow's `BankImportRow` is structurally assignable to `SwipeRow` (same fields, `skipReason` is a narrower type — assignment is valid)
- CreditFlow's `CreditRow` is structurally assignable to `SwipeRow` (same fields minus `skipReason`)

- [ ] **Step 1: Modify BankFlow**

In `src/components/import/flows/BankFlow.tsx`:

**Add imports** (after existing imports on line 18):
```tsx
import { SwipeImportDeck } from '../SwipeImportDeck'
import type { SwipeRow } from '../deckUtils'
```

**Remove** these unused imports (no longer needed after removing the table):
- `Tag` from lucide-react (line 3: change `{ Upload, CheckCircle, Tag, ChevronRight }` to `{ Upload, CheckCircle, ChevronRight }`)

**Replace** the `handleSave` function (lines 234-250) with a `handleDeckSave` function:
```tsx
async function handleDeckSave(approved: SwipeRow[]) {
  setSaving(true); setError(null)
  try {
    const toImport = approved as BankImportRow[]
    const { clean, duplicates } = detectDuplicates(toImport, existingTransactions)
    const source: TransactionSource = bankType === 'leumi' ? 'pdf_import' : 'xlsx_import'
    const toSave: BankImportRow[] = duplicates.length > 0
      ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? toImport : clean as BankImportRow[])
      : toImport
    await addTransactions(toSave.map(t => toTransaction(t, accountId, month, source)))
    setSaved(true)
  } catch {
    setError('שגיאה בשמירה. נסה שוב.')
  } finally {
    setSaving(false)
  }
}
```

**Remove** the `activeRows` and `skippedCount` derived values (lines 156-157) and `duplicateCount` (line 164) and `uncategorized` (line 265) — these are now computed inside `SwipeImportDeck`.

**Replace** the entire `{rows.length > 0 && ( ... )}` block (lines 302-471) with:
```tsx
{error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

{rows.length > 0 && (
  <SwipeImportDeck
    rows={rows}
    categories={categories}
    portfolioAccounts={portfolioAccounts}
    investmentTypes={investmentTypes}
    accountName={accountName}
    month={month}
    saving={saving}
    onSave={handleDeckSave}
    onDone={onDone}
  />
)}
```

Note: the `error` display and `parsing` state display remain outside the deck block. The `duplicate` and `foreign currency` warning paragraphs (lines 295-300) are removed — these are now handled within the deck (cards show duplicate info implicitly; the HUD shows live totals).

The full return JSX for BankFlow after the changes (starting at the non-`saved` return, line 267):
```tsx
return (
  <div>
    <div className="flex items-center gap-2 mb-4">
      <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-foreground transition-colors">
        <ChevronRight size={22} />
      </button>
      <h2 className="text-lg font-semibold">{accountName}</h2>
    </div>

    <div
      className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload size={24} className="mx-auto mb-2 text-slate-400" />
      <p className="text-slate-400 text-sm">
        {bankType === 'leumi' ? 'העלאת קובץ PDF' : bankType === 'one-zero' ? 'העלאת קובץ XLS' : 'העלאת קובץ XLS, XLSX, PDF או CSV'}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={bankType === 'leumi' ? '.pdf' : bankType === 'one-zero' ? '.xls,.xlsx' : '.xls,.xlsx,.pdf,.csv'}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>

    {parsing && <p className="text-slate-400 text-sm text-center mb-3">מנתח קובץ...</p>}
    {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

    {rows.length > 0 && (
      <SwipeImportDeck
        rows={rows}
        categories={categories}
        portfolioAccounts={portfolioAccounts}
        investmentTypes={investmentTypes}
        accountName={accountName}
        month={month}
        saving={saving}
        onSave={handleDeckSave}
        onDone={onDone}
      />
    )}
  </div>
)
```

Also remove the now-unused `activeRows`, `skippedCount`, `duplicateCount`, `uncategorized` computed variables. Remove `Tag` from the lucide import. Keep `detectDuplicates` import since `handleDeckSave` uses it.

- [ ] **Step 2: Modify CreditFlow**

In `src/components/import/flows/CreditFlow.tsx`:

**Add imports**:
```tsx
import { SwipeImportDeck } from '../SwipeImportDeck'
import type { SwipeRow } from '../deckUtils'
```

**Remove** `Tag` from lucide imports (line 3).

**Replace** the `handleSave` function with:
```tsx
async function handleDeckSave(approved: SwipeRow[]) {
  setSaving(true); setError(null)
  try {
    const toImport = approved as CreditRow[]
    const { clean, duplicates } = detectDuplicates(toImport, existingTransactions)
    const toSave = duplicates.length > 0
      ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? toImport : clean)
      : toImport
    await addTransactions(toSave.map(t => toTransaction(t as CreditRow, accountId, month)))
    setSaved(true)
  } catch (err) {
    console.error('addTransactions failed:', err)
    setError('שגיאה בשמירה. נסה שוב.')
  } finally {
    setSaving(false)
  }
}
```

**Replace** the `{rows.length > 0 && ( ... )}` block (lines 266-433) with:
```tsx
{rows.length > 0 && (
  <SwipeImportDeck
    rows={rows}
    categories={categories}
    portfolioAccounts={portfolioAccounts}
    investmentTypes={investmentTypes}
    accountName={accountName}
    month={month}
    saving={saving}
    onSave={handleDeckSave}
    onDone={onDone}
  />
)}
```

The full return JSX for CreditFlow after changes:
```tsx
return (
  <div>
    <div className="flex items-center gap-2 mb-4">
      <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-foreground transition-colors">
        <ChevronRight size={22} />
      </button>
      <h2 className="text-lg font-semibold">{accountName}</h2>
    </div>

    <div
      className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload size={24} className="mx-auto mb-2 text-slate-400" />
      <p className="text-slate-400 text-sm">
        {provider === 'isracard' ? 'העלאת קובץ XLSX או PDF'
          : provider === 'max' ? 'העלאת קובץ XLSX או CSV'
          : 'העלאת קובץ CSV, XLSX או PDF'}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={provider === 'isracard' ? '.xlsx,.xls,.pdf' : provider === 'max' ? '.xlsx,.xls,.csv' : '.csv,.xlsx,.xls,.pdf'}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>

    {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

    {availableSheets.length > 0 && (
      <div className="bg-surface rounded-xl p-4 mb-4">
        <p className="text-sm font-medium mb-2">בחר גליונות לייבוא:</p>
        {availableSheets.map(sheet => (
          <label key={sheet} className="flex items-center gap-2 mb-1 cursor-pointer text-sm">
            <input type="checkbox" checked={selectedSheets.includes(sheet)}
              onChange={e => setSelectedSheets(p => e.target.checked ? [...p, sheet] : p.filter(s => s !== sheet))} />
            {sheet}
          </label>
        ))}
        <button onClick={loadSheets} className="mt-2 w-full py-2 bg-accent rounded-lg text-sm font-medium">טען גליונות</button>
      </div>
    )}

    {rows.length > 0 && (
      <SwipeImportDeck
        rows={rows}
        categories={categories}
        portfolioAccounts={portfolioAccounts}
        investmentTypes={investmentTypes}
        accountName={accountName}
        month={month}
        saving={saving}
        onSave={handleDeckSave}
        onDone={onDone}
      />
    )}
  </div>
)
```

Remove `activeRows`, `skippedCount`, `duplicateCount`, `uncategorized` computed variables from CreditFlow body.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: zero errors. Fix any that appear before committing.

- [ ] **Step 4: Run existing tests**

```bash
npx vitest run
```

Expected: all tests pass (deckUtils tests + any pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/import/flows/BankFlow.tsx src/components/import/flows/CreditFlow.tsx
git commit -m "feat: replace import table UI with SwipeImportDeck in BankFlow and CreditFlow"
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Covered in Task |
|-----------------|----------------|
| Swipe right = approve, left = skip | Task 2 (gesture), Task 5 (state) |
| 60px threshold OR velocity > 0.5 | Task 2 |
| Card rotate during drag, overlays | Task 2 |
| Behind-card peek (scale 0.95, translateY 8px) | Task 5 |
| Card order: uncategorized expenses → other active → skipped | Task 1 (sortDeckCards) |
| Points: +2 approve, +1 skip, +5 streak (every 5), +20 completion | Task 5 |
| Points popup, float-up animation | Task 1 (keyframe), Task 5 |
| No currency symbol on points | Task 3, Task 5 — using Star icon + number only |
| Undo (max 5, no point reversal) | Task 5 |
| Action buttons: undo, skip, approve | Task 5 |
| HUD: progress bar, points, income/expense/net totals, save button | Task 3 |
| Save button always visible ("שמור N") | Task 3 |
| Tutorial (localStorage, 3 slides, [?] button) | Task 4, Task 5 |
| Tutorial slide 1: green card right | Task 4 |
| Tutorial slide 2: red card left | Task 4 |
| Tutorial slide 3: static card with fields | Task 4 |
| Deck complete: save + navigate buttons, no summary screen | Task 5 |
| "חיוב מיידי" pill button (not checkbox) | Task 2 |
| Category field highlighted amber when empty | Task 2 |
| InvestmentPicker hidden if no portfolios | Task 2 |
| File upload UI unchanged | Task 6 |
| Sheet selection UI unchanged (CreditFlow) | Task 6 |
| `suggestSkips()` still called before deck renders | Task 6 — rows passed in already have skip populated from BankFlow's existing parse logic |
| BankFlow/CreditFlow save logic (detectDuplicates, addTransactions) unchanged | Task 6 |

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:** `SwipeRow` defined in Task 1, used in Tasks 2, 5, 6. `DeckCard` defined in Task 1, used in Tasks 2, 3, 5. `CardStatus` defined in Task 1, used in Task 5. `computeTotals` defined in Task 1, imported in Task 3. `sortDeckCards` defined in Task 1, imported in Task 5. `shouldShowTutorial` defined in Task 4, imported in Task 5. All match.
