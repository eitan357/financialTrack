# MonthPicker Component — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MonthPicker popup that opens when the user clicks the month/year title, allowing quick navigation to any month without pressing ‹ › repeatedly.

**Architecture:** Shared `MonthPicker` component that renders a grid of 12 months for a given year, with year navigation. Clicking the month title in ImportWizard, `/transactions`, and `/investments` opens the picker as a positioned dropdown. Clicking outside or selecting a month closes it.

**Tech Stack:** TypeScript, React, Next.js App Router, Tailwind CSS v4, Jest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/MonthPicker.tsx` | Create | Reusable month grid picker |
| `src/components/MonthPicker.test.tsx` | Create | Tests for picker component |
| `src/components/import/ImportWizard.tsx` | Modify | Add picker to month title |
| `src/app/(app)/transactions/page.tsx` | Modify | Add picker to month title |
| `src/app/(app)/investments/page.tsx` | Modify | Add picker to month title |

---

## Task 1: Create the MonthPicker component

**Files:**
- Create: `src/components/MonthPicker.tsx`
- Create: `src/components/MonthPicker.test.tsx`

**Component interface:**
```typescript
interface Props {
  value: string       // YYYY-MM (currently selected month)
  onChange: (month: string) => void
  onClose: () => void
}
```

**Behaviour:**
- Shows current year with `<` and `>` buttons to navigate years
- 12 month buttons in a 4×3 grid (RTL: ינואר top-right, דצמבר bottom-left following natural Hebrew reading direction but rendered with a grid)
- Selected month highlighted in accent color
- Calling `onChange` immediately closes (caller should remove from DOM)
- `onClose` fires on the backdrop click

**Month labels (same array used elsewhere in the app):**
```typescript
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
```

**UI layout:**
The picker is a white/dark card, absolutely positioned, NOT a full-screen modal. It renders as a fixed overlay with a transparent backdrop (z-50) so clicking outside closes it. The card itself is centered or positioned naturally.

```
┌─────────────────────────────┐
│  <        2026        >     │  ← year navigation
│  ינואר  פברואר  מרץ   אפריל │
│  מאי    יוני    יולי  אוגוסט│
│  ספטמבר אוקטובר נובמבר דצמבר│
└─────────────────────────────┘
```

**Full component:**
```typescript
'use client'
import { useState } from 'react'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

interface Props {
  value: string
  onChange: (month: string) => void
  onClose: () => void
}

export function MonthPicker({ value, onChange, onClose }: Props) {
  const [year, setYear] = useState(() => parseInt(value.split('-')[0], 10))
  const selectedMonth = value  // YYYY-MM

  function selectMonth(monthIndex: number) {
    const m = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    onChange(m)
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl w-72"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setYear(y => y - 1)}
            aria-label="שנה קודמת"
            className="text-slate-400 hover:text-foreground text-xl w-8 text-center"
          >‹</button>
          <span className="font-semibold tabular-nums">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            aria-label="שנה הבאה"
            className="text-slate-400 hover:text-foreground text-xl w-8 text-center"
          >›</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {HE_MONTHS.map((name, i) => {
            const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`
            const isSelected = monthStr === selectedMonth
            return (
              <button
                key={name}
                onClick={() => selectMonth(i)}
                className={`py-2 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? 'bg-accent text-white font-semibold'
                    : 'hover:bg-slate-800 text-foreground'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/components/MonthPicker.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthPicker } from './MonthPicker'

const baseProps = {
  value: '2026-03',
  onChange: jest.fn(),
  onClose: jest.fn(),
}

describe('MonthPicker', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all 12 Hebrew month names', () => {
    render(<MonthPicker {...baseProps} />)
    const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    months.forEach(m => expect(screen.getByText(m)).toBeInTheDocument())
  })

  it('shows the year from the value prop', () => {
    render(<MonthPicker {...baseProps} />)
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('calls onChange with correct YYYY-MM when a month is clicked', () => {
    const onChange = jest.fn()
    render(<MonthPicker {...baseProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('מאי'))
    expect(onChange).toHaveBeenCalledWith('2026-05')
  })

  it('navigates to the previous year when clicking שנה קודמת', () => {
    render(<MonthPicker {...baseProps} />)
    fireEvent.click(screen.getByLabelText('שנה קודמת'))
    expect(screen.getByText('2025')).toBeInTheDocument()
  })

  it('navigates to the next year when clicking שנה הבאה', () => {
    render(<MonthPicker {...baseProps} />)
    fireEvent.click(screen.getByLabelText('שנה הבאה'))
    expect(screen.getByText('2027')).toBeInTheDocument()
  })

  it('calls onChange with the new year after year navigation', () => {
    const onChange = jest.fn()
    render(<MonthPicker {...baseProps} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('שנה קודמת'))
    fireEvent.click(screen.getByText('ינואר'))
    expect(onChange).toHaveBeenCalledWith('2025-01')
  })

  it('calls onClose when clicking the backdrop', () => {
    const onClose = jest.fn()
    render(<MonthPicker {...baseProps} onClose={onClose} />)
    // The fixed overlay div is the backdrop (the outermost div)
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest src/components/MonthPicker.test.tsx --no-coverage
```
Expected: FAIL (MonthPicker not found)

- [ ] **Step 3: Implement MonthPicker**

Create `src/components/MonthPicker.tsx` with the full implementation shown above.

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest src/components/MonthPicker.test.tsx --no-coverage
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```
git add src/components/MonthPicker.tsx src/components/MonthPicker.test.tsx
git commit -m "feat: add MonthPicker component"
```

---

## Task 2: Integrate MonthPicker into ImportWizard

**Files:**
- Modify: `src/components/import/ImportWizard.tsx`

Add `pickerOpen` state. Wrap the `<h1>` in a click handler. Render `<MonthPicker>` conditionally.

Changes to `ImportWizard.tsx`:
1. Import `MonthPicker`
2. Add `const [pickerOpen, setPickerOpen] = useState(false)` after existing state declarations
3. Replace the `<h1 className="text-lg font-bold">{formatMonth(month)}</h1>` with:

```typescript
<button
  onClick={() => setPickerOpen(p => !p)}
  aria-label="בחר חודש"
  className="text-lg font-bold hover:text-accent transition-colors"
>
  {formatMonth(month)}
</button>
{pickerOpen && (
  <MonthPicker
    value={month}
    onChange={m => { setMonth(m); setStep(1); setData(EMPTY_DATA); setPickerOpen(false) }}
    onClose={() => setPickerOpen(false)}
  />
)}
```

4. Add the import at the top: `import { MonthPicker } from '@/components/MonthPicker'`

- [ ] **Step 1: Implement integration into ImportWizard**

Make the minimal changes described above to `src/components/import/ImportWizard.tsx`. Do NOT rewrite the whole file — only add the `pickerOpen` state, change the `<h1>` to a `<button>`, and add the `<MonthPicker>` conditional render.

- [ ] **Step 2: Run tests**

```
npx jest src/components/import/ImportWizard.test.tsx --no-coverage
```
Expected: PASS (existing tests should still pass since they test step navigation, not the picker)

- [ ] **Step 3: Commit**

```
git add src/components/import/ImportWizard.tsx
git commit -m "feat: add MonthPicker to ImportWizard"
```

---

## Task 3: Integrate MonthPicker into /transactions page

**Files:**
- Modify: `src/app/(app)/transactions/page.tsx`

Current month navigation:
```typescript
<div className="flex items-center justify-between mb-4">
  <button onClick={() => setMonth(addMonths(month, -1))} aria-label="חודש קודם" className="...">‹</button>
  <h2 className="text-base font-semibold">{formatMonth(month)}</h2>
  <button onClick={() => setMonth(addMonths(month, 1))} aria-label="חודש הבא" className="...">›</button>
</div>
```

Changes:
1. Add `import { MonthPicker } from '@/components/MonthPicker'`
2. Add `const [pickerOpen, setPickerOpen] = useState(false)` to state
3. Replace the `<h2>` with:
```typescript
<button
  onClick={() => setPickerOpen(p => !p)}
  aria-label="בחר חודש"
  className="text-base font-semibold hover:text-accent transition-colors"
>
  {formatMonth(month)}
</button>
{pickerOpen && (
  <MonthPicker
    value={month}
    onChange={m => { setMonth(m); setPickerOpen(false) }}
    onClose={() => setPickerOpen(false)}
  />
)}
```

The MonthPicker can be rendered outside the flex row (as a sibling) since it uses `fixed` positioning.

- [ ] **Step 1: Read the current transactions page to find the exact month navigation markup**

Read `src/app/(app)/transactions/page.tsx` lines 60-120 to find the exact JSX for the month navigation.

- [ ] **Step 2: Apply changes**

Make the minimal changes to add the picker to `/transactions/page.tsx`.

- [ ] **Step 3: Run tests**

```
npx jest src/app/\\(app\\)/transactions/page.test.tsx --no-coverage
```
Expected: PASS

- [ ] **Step 4: Commit**

```
git add src/app/(app)/transactions/page.tsx
git commit -m "feat: add MonthPicker to transactions page"
```

---

## Task 4: Integrate MonthPicker into /investments page

**Files:**
- Modify: `src/app/(app)/investments/page.tsx`

Same pattern as Task 3. Apply MonthPicker to the month navigation in the investments page.

- [ ] **Step 1: Read the current investments page to find the exact month navigation markup**

Read `src/app/(app)/investments/page.tsx` lines 50-100 to find the exact JSX for the month navigation.

- [ ] **Step 2: Apply changes**

Same pattern as transactions: add `pickerOpen` state, change the month title to a button, render `MonthPicker` conditionally.

- [ ] **Step 3: Run the full test suite**

```
npx jest --no-coverage
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```
git add src/app/(app)/investments/page.tsx
git commit -m "feat: add MonthPicker to investments page"
```
