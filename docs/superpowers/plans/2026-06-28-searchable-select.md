# SearchableSelect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `<select>` elements for categories, investment types, and bank/cash accounts with a unified searchable dropdown `SelectField` component that matches the CurrencyPicker style.

**Architecture:** One generic `SelectField` component in `src/components/ui/SelectField.tsx` handles all use cases via props (nullable, grouped, size, color dots). It follows the exact same pattern as `CurrencyPicker`: relative container, absolute dropdown, `z-50`, `left-0`, click-outside on `mousedown`, clears search on close. Domain forms import `SelectField` directly — no wrapper components needed.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript strict, Tailwind CSS, Hebrew RTL UI, Vitest + jsdom for tests.

## Global Constraints

- `'use client'` directive required on all component files that use hooks
- Hebrew RTL UI: trigger button is full-width, chevron `▾` on the LEFT in RTL (use `flex-row-reverse` or position accordingly)
- Dropdown uses `dir="ltr"` to prevent RTL reversing the list layout (same as CurrencyPicker)
- Dropdown opens at `left-0` (rightward), `top-full mt-1`, `z-50`
- `size="sm"`: `text-xs py-1 px-2`, fixed `w-56` dropdown — used in import table rows
- `size="md"` (default): `text-sm py-2 px-3`, `w-full min-w-[14rem]` dropdown — used in forms
- Color dot: `●` character, colored via inline `style={{ color }}`, rendered before the label
- Test files require `// @vitest-environment jsdom` as first line (after any 'use client' comments)
- Run tests with: `npx vitest run`
- All commits on `main` branch (no worktree)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/components/ui/SelectField.tsx` | Generic searchable select dropdown |
| **Create** | `src/components/ui/SelectField.test.tsx` | Unit tests for SelectField |
| **Modify** | `src/components/transactions/AddTransactionForm.tsx` | Replace category + account selects |
| **Modify** | `src/components/transactions/TransactionRow.tsx` | Replace category select in EditForm |
| **Modify** | `src/components/transactions/CategorySelect.tsx` | Rewrite using SelectField |
| **Modify** | `src/app/(app)/settings/page.tsx` | Replace category select in RulesSection |
| **Modify** | `src/components/import/flows/BankFlow.tsx` | Replace category select (sm) + direction select → DirectionToggle |
| **Modify** | `src/components/import/flows/CreditFlow.tsx` | Replace category select (sm) + direction select → DirectionToggle |
| **Modify** | `src/components/investments/AddInvestmentEntryForm.tsx` | Replace type + account selects |
| **Modify** | `src/components/investments/AddDividendForm.tsx` | Replace type + account selects |
| **Modify** | `src/components/investments/AddInvestmentConversionForm.tsx` | Replace type + account selects |

---

## Task 1: Create `SelectField` Component + Tests

**Files:**
- Create: `src/components/ui/SelectField.tsx`
- Create: `src/components/ui/SelectField.test.tsx`

**Interfaces — Produces (used by Tasks 2–5):**
```typescript
export interface SelectOption {
  value: string
  label: string
  color?: string   // CSS color string — renders ● dot
  group?: string   // section header rendered above first item in each group
}

export interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string   // shown when value === ''
  nullable?: boolean     // show "— ללא —" item at top, always visible
  nullLabel?: string     // label for none option, default: "— ללא —"
  error?: boolean        // red ring on trigger when true
  disabled?: boolean
  size?: 'sm' | 'md'    // 'md' default
  className?: string
}

export function SelectField(props: SelectFieldProps): JSX.Element
```

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/SelectField.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectField } from './SelectField'
import { vi } from 'vitest'

const OPTIONS = [
  { value: 'food', label: 'אוכל', color: '#ff0000', group: 'בית' },
  { value: 'bills', label: 'חשבונות', color: '#00ff00', group: 'בית' },
  { value: 'gas', label: 'דלק', group: 'תחבורה' },
]

describe('SelectField', () => {
  it('shows placeholder when value is empty', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} placeholder="בחר..." />)
    expect(screen.getByText('בחר...')).toBeTruthy()
  })

  it('shows selected label when value is set', () => {
    render(<SelectField value="food" onChange={vi.fn()} options={OPTIONS} />)
    expect(screen.getByText('אוכל')).toBeTruthy()
  })

  it('opens dropdown on trigger click', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })

  it('filters options by search input', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש...'), { target: { value: 'דלק' } })
    expect(screen.getAllByRole('option').length).toBe(1)
    expect(screen.getByText('דלק')).toBeTruthy()
  })

  it('calls onChange with correct value on option click', () => {
    const onChange = vi.fn()
    render(<SelectField value="" onChange={onChange} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('אוכל'))
    expect(onChange).toHaveBeenCalledWith('food')
  })

  it('shows group headers', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('בית')).toBeTruthy()
    expect(screen.getByText('תחבורה')).toBeTruthy()
  })

  it('shows nullable item always visible during search', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} nullable nullLabel="— ללא —" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש...'), { target: { value: 'xyz_no_match' } })
    expect(screen.getByText('— ללא —')).toBeTruthy()
  })

  it('calls onChange with empty string when nullable item clicked', () => {
    const onChange = vi.fn()
    render(<SelectField value="food" onChange={onChange} options={OPTIONS} nullable />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('— ללא —'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes on click outside', () => {
    render(
      <div>
        <SelectField value="" onChange={vi.fn()} options={OPTIONS} />
        <div data-testid="outside">outside</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('option')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/ui/SelectField.test.tsx
```
Expected: FAIL — `SelectField` not found.

- [ ] **Step 3: Implement `SelectField`**

Create `src/components/ui/SelectField.tsx`:

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'

export interface SelectOption {
  value: string
  label: string
  color?: string
  group?: string
}

export interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  nullable?: boolean
  nullLabel?: string
  error?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = 'בחר...',
  nullable = false,
  nullLabel = '— ללא —',
  error = false,
  disabled = false,
  size = 'md',
  className = '',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isSm = size === 'sm'
  const triggerPy = isSm ? 'py-1' : 'py-2'
  const triggerPx = isSm ? 'px-2' : 'px-3'
  const triggerText = isSm ? 'text-xs' : 'text-sm'
  const dropdownWidth = isSm ? 'w-56' : 'w-full min-w-[14rem]'

  function renderGroups() {
    const items: React.ReactNode[] = []

    if (nullable) {
      items.push(
        <li
          key="__null__"
          role="option"
          aria-selected={value === ''}
          onClick={() => { onChange(''); setOpen(false); setSearch('') }}
          className={`px-3 py-2 cursor-pointer hover:bg-slate-700 text-sm text-slate-400 ${value === '' ? 'bg-slate-700/60' : ''}`}
        >
          {nullLabel}
        </li>
      )
    }

    let lastGroup: string | undefined = undefined
    for (const opt of filtered) {
      if (opt.group !== lastGroup) {
        lastGroup = opt.group
        if (opt.group) {
          items.push(
            <li key={`__group__${opt.group}`} className="px-3 pt-2 pb-1 text-xs text-slate-500 font-medium select-none">
              {opt.group}
            </li>
          )
        }
      }
      items.push(
        <li
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          onClick={() => { onChange(opt.value); setOpen(false); setSearch('') }}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-700 text-sm ${opt.value === value ? 'bg-slate-700/60' : ''}`}
        >
          {opt.color && (
            <span className="flex-shrink-0 text-base leading-none" style={{ color: opt.color }}>●</span>
          )}
          <span className="truncate">{opt.label}</span>
        </li>
      )
    }

    if (filtered.length === 0) {
      items.push(
        <li key="__empty__" className="px-3 py-4 text-slate-500 text-sm text-center">לא נמצאו תוצאות</li>
      )
    }

    return items
  }

  const ringClass = error ? 'ring-1 ring-red-500' : open ? 'ring-1 ring-accent' : ''
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-600'

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={`w-full flex items-center gap-2 bg-slate-700 rounded-lg ${triggerPx} ${triggerPy} ${triggerText} transition-colors ${ringClass} ${disabledClass}`}
      >
        {selected?.color && (
          <span className="flex-shrink-0 text-base leading-none" style={{ color: selected.color }}>●</span>
        )}
        <span className={`flex-1 text-right truncate ${!selected ? 'text-slate-500' : 'text-foreground'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-xs text-slate-500 flex-shrink-0">▾</span>
      </button>

      {open && (
        <div dir="ltr" className={`absolute z-50 top-full mt-1 left-0 ${dropdownWidth} bg-slate-800 border border-slate-700 rounded-xl shadow-xl`}>
          <div className="p-2 border-b border-slate-700">
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש..."
              className="w-full bg-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ring-accent"
            />
          </div>
          <ul className="overflow-y-auto max-h-52" role="listbox">
            {renderGroups()}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/components/ui/SelectField.test.tsx
```
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SelectField.tsx src/components/ui/SelectField.test.tsx
git commit -m "feat: add SelectField searchable dropdown component with tests"
```

---

## Task 2: Category Selects in Forms

Replace `<select>` for קטגוריה in: `AddTransactionForm`, `TransactionRow` (EditForm), `CategorySelect`, `RulesSection` in settings.

**Files:**
- Modify: `src/components/transactions/AddTransactionForm.tsx`
- Modify: `src/components/transactions/TransactionRow.tsx`
- Modify: `src/components/transactions/CategorySelect.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces — Consumes from Task 1:**
```typescript
import { SelectField } from '@/components/ui/SelectField'
// options shape for categories:
categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))
```

- [ ] **Step 1: Update `AddTransactionForm.tsx`**

Replace the category `<select>` (lines 99–108) with `SelectField`. Add import at top:

```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Replace the category FormField block:

```tsx
{direction === 'expense' && (
  <FormField label="קטגוריה">
    <SelectField
      value={categoryId}
      onChange={setCategoryId}
      options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))}
      nullable
      nullLabel="— ללא —"
      placeholder="— ללא —"
    />
  </FormField>
)}
```

- [ ] **Step 2: Update `TransactionRow.tsx` EditForm**

Replace the category `<select>` (lines 118–130) with `SelectField`. Add import at top:

```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Replace the category FormField block inside EditForm:

```tsx
{direction === 'expense' && (
  <FormField label="קטגוריה">
    <SelectField
      value={categoryId}
      onChange={setCategoryId}
      options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))}
      nullable
      nullLabel="— ללא —"
      placeholder="— ללא —"
    />
  </FormField>
)}
```

- [ ] **Step 3: Rewrite `CategorySelect.tsx`**

The current file is a thin `<select>` wrapper used in other places. Rewrite it to use `SelectField`:

```tsx
import { SelectField } from '@/components/ui/SelectField'
import type { Category } from '@/lib/types'

interface Props {
  value?: string
  categories: Category[]
  onChange: (categoryId: string | undefined) => void
  className?: string
}

export function CategorySelect({ value, categories, onChange, className = '' }: Props) {
  return (
    <SelectField
      value={value ?? ''}
      onChange={v => onChange(v || undefined)}
      options={categories.map(c => ({ value: c.id, label: c.name, color: c.color }))}
      nullable
      nullLabel="ללא קטגוריה"
      placeholder="ללא קטגוריה"
      className={className}
    />
  )
}
```

- [ ] **Step 4: Update `settings/page.tsx` RulesSection**

Find the category select in `RulesSection` (around line 832). Add import at top of file:

```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Replace the category `<select>` in RulesSection:

```tsx
<div className="flex-1">
  <label className="text-xs text-slate-400 block mb-1">קטגוריה</label>
  <SelectField
    value={categoryId}
    onChange={setCategoryId}
    options={categories.map(c => ({ value: c.id, label: c.name, color: c.color }))}
    placeholder="בחר קטגוריה..."
  />
</div>
```

- [ ] **Step 5: Run the dev server and verify manually**

```
npm run dev
```

Open http://localhost:3000 in browser. Navigate to:
1. עסקאות page → Add transaction → verify category dropdown is searchable with color dots
2. Click a transaction → Edit → verify category dropdown works
3. Settings → Categories → Rules → verify category dropdown in add-rule form

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/AddTransactionForm.tsx src/components/transactions/TransactionRow.tsx src/components/transactions/CategorySelect.tsx src/app/(app)/settings/page.tsx
git commit -m "feat: replace category selects in forms with searchable SelectField"
```

---

## Task 3: Category Selects in Import Table Rows

Replace per-row category `<select>` in BankFlow and CreditFlow with `SelectField` at `size="sm"`. The `onChange` must convert `''` → `null` (these rows store `categoryId: null`, not `''`).

**Files:**
- Modify: `src/components/import/flows/BankFlow.tsx`
- Modify: `src/components/import/flows/CreditFlow.tsx`

**Interfaces — Consumes from Task 1:**
```typescript
import { SelectField } from '@/components/ui/SelectField'
// size="sm", nullable, onChange converts '' to null:
onChange={v => updateRow(i, { categoryId: v || null, categorizationSource: 'manual' })}
```

- [ ] **Step 1: Update `BankFlow.tsx` category cell**

Add import at top:
```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Find the category `<td>` in the table body (lines ~361–380). Replace the `<select>` for category:

```tsx
<td className="py-1.5 px-2">
  {row.skip ? (
    row.skipReason === 'investment-transfer' ? (
      <span className="text-xs text-purple-400">העברה להשקעות</span>
    ) : (
      <span className="text-xs text-slate-600">מסונן</span>
    )
  ) : row.direction === 'expense' ? (
    <SelectField
      value={row.categoryId ?? ''}
      onChange={v => updateRow(i, { categoryId: v || null, categorizationSource: 'manual' })}
      options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))}
      nullable
      nullLabel="— ללא —"
      placeholder="— ללא —"
      size="sm"
      disabled={row.skip}
    />
  ) : (
    <span className="text-xs text-green-400">הכנסה</span>
  )}
</td>
```

- [ ] **Step 2: Update `CreditFlow.tsx` category cell**

Add import at top:
```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Find the category `<td>` in the table body (lines ~308–324). Replace the `<select>` for category:

```tsx
<td className="py-1.5 px-2">
  {tx.skip ? (
    <span className="text-xs text-slate-600">מסונן</span>
  ) : tx.direction === 'expense' ? (
    <SelectField
      value={tx.categoryId ?? ''}
      onChange={v => updateRow(i, { categoryId: v || null, categorizationSource: 'manual' })}
      options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))}
      nullable
      nullLabel="— ללא —"
      placeholder="— ללא —"
      size="sm"
      disabled={tx.skip}
    />
  ) : (
    <span className="text-xs text-green-400">הכנסה</span>
  )}
</td>
```

- [ ] **Step 3: Verify manually**

Open http://localhost:3000. Navigate to ייבוא → select a bank account → upload a file. In the transactions table, verify the category dropdown is a compact searchable picker.

- [ ] **Step 4: Commit**

```bash
git add src/components/import/flows/BankFlow.tsx src/components/import/flows/CreditFlow.tsx
git commit -m "feat: replace category selects in import table rows with searchable SelectField sm"
```

---

## Task 4: Investment Type Selects

Replace `<select>` for סוג השקעה in all three investment forms. `AddInvestmentEntryForm` uses groups (by portfolio). The other two are flat.

**Files:**
- Modify: `src/components/investments/AddInvestmentEntryForm.tsx`
- Modify: `src/components/investments/AddDividendForm.tsx`
- Modify: `src/components/investments/AddInvestmentConversionForm.tsx`

**Interfaces — Consumes from Task 1:**
```typescript
import { SelectField } from '@/components/ui/SelectField'
// Grouped (AddInvestmentEntryForm):
const typeOptions = [
  ...portfolios.flatMap(p => {
    const pTypes = types.filter(t => t.portfolioAccountId === p.id)
    return pTypes.map(t => ({ value: t.id, label: t.name, group: p.name }))
  }),
  ...unassignedTypes.map(t => ({ value: t.id, label: t.name })),
]
// Flat (AddDividendForm, AddInvestmentConversionForm):
types.map(t => ({ value: t.id, label: t.name }))
```

- [ ] **Step 1: Update `AddInvestmentEntryForm.tsx`**

Add import at top:
```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Replace the `<select>` block for `inv-type` (currently lines 58–79). Remove the `<optgroup>` pattern and use `SelectField` with group option:

```tsx
<div>
  <label htmlFor="inv-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
  {!hasTypes ? (
    <p className="text-sm text-slate-500 py-2">יש להוסיף השקעות בהגדרות</p>
  ) : (
    <SelectField
      value={typeId}
      onChange={v => { setTypeId(v); if (errors.typeId && v) setErrors(p => ({ ...p, typeId: undefined })) }}
      options={[
        ...portfolios.flatMap(p => {
          const pTypes = types.filter(t => t.portfolioAccountId === p.id)
          return pTypes.map(t => ({ value: t.id, label: t.name, group: p.name }))
        }),
        ...unassignedTypes.map(t => ({ value: t.id, label: t.name })),
      ]}
      placeholder="בחר סוג..."
      error={!!errors.typeId}
    />
  )}
  {errors.typeId && <p className="text-xs text-red-400 mt-1">{errors.typeId}</p>}
</div>
```

- [ ] **Step 2: Update `AddDividendForm.tsx`**

Add import at top:
```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Replace the `<select>` block for `div-type` (lines 64–78):

```tsx
<div>
  <label htmlFor="div-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
  <SelectField
    value={typeId}
    onChange={v => { setTypeId(v); if (errors.typeId && v) setErrors(p => ({ ...p, typeId: undefined })) }}
    options={types.map(t => ({ value: t.id, label: t.name }))}
    placeholder="בחר סוג..."
    error={!!errors.typeId}
  />
  {errors.typeId && <p className="text-xs text-red-400 mt-1">{errors.typeId}</p>}
</div>
```

- [ ] **Step 3: Update `AddInvestmentConversionForm.tsx`**

Add import at top:
```tsx
import { SelectField } from '@/components/ui/SelectField'
```

Replace the `<select>` block for `conv-type` (lines 46–58):

```tsx
<div>
  <label htmlFor="conv-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
  <SelectField
    value={typeId}
    onChange={v => { setTypeId(v); if (errors.typeId && v) setErrors(p => ({ ...p, typeId: undefined })) }}
    options={types.map(t => ({ value: t.id, label: t.name }))}
    placeholder="בחר סוג..."
    error={!!errors.typeId}
  />
  {errors.typeId && <p className="text-xs text-red-400 mt-1">{errors.typeId}</p>}
</div>
```

- [ ] **Step 4: Verify manually**

Open http://localhost:3000. Navigate to השקעות page. Try adding an investment entry — verify the type dropdown shows groups by portfolio. Try adding a dividend — verify flat dropdown with search.

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/AddInvestmentEntryForm.tsx src/components/investments/AddDividendForm.tsx src/components/investments/AddInvestmentConversionForm.tsx
git commit -m "feat: replace investment type selects with searchable SelectField"
```

---

## Task 5: Account Selects

Replace `<select>` for חשבון/חשבון מקור/חשבון יעד/חשבון שקיבל in all four forms. Account options include color dots.

**Files:**
- Modify: `src/components/transactions/AddTransactionForm.tsx`
- Modify: `src/components/investments/AddInvestmentEntryForm.tsx`
- Modify: `src/components/investments/AddDividendForm.tsx`
- Modify: `src/components/investments/AddInvestmentConversionForm.tsx`

**Interfaces — Consumes from Task 1:**
```typescript
// Account options with color dots:
accounts.map(a => ({ value: a.id, label: a.name, color: a.color }))
```

- [ ] **Step 1: Update `AddTransactionForm.tsx` account select**

`SelectField` is already imported (Task 2). Replace the account `<select>` (lines 89–95):

```tsx
<FormField label="חשבון">
  <SelectField
    value={accountId}
    onChange={setAccountId}
    options={accounts.filter(a => a.isActive && a.type !== 'investment').map(a => ({ value: a.id, label: a.name, color: a.color }))}
    placeholder="בחר חשבון..."
  />
</FormField>
```

- [ ] **Step 2: Update `AddInvestmentEntryForm.tsx` source account select**

`SelectField` is already imported (Task 4). Replace the `<select>` for `inv-source` (lines 83–98):

```tsx
{bankAccounts.length > 0 && (
  <div>
    <label htmlFor="inv-source" className="text-xs text-slate-400 block mb-1">חשבון מקור</label>
    <SelectField
      value={sourceAccountId}
      onChange={v => { setSourceAccountId(v); if (errors.sourceAccountId) setErrors(p => ({ ...p, sourceAccountId: undefined })) }}
      options={bankAccounts.map(a => ({ value: a.id, label: a.name, color: a.color }))}
      nullable
      nullLabel="בחר חשבון..."
      placeholder="בחר חשבון..."
      error={!!errors.sourceAccountId}
    />
    {errors.sourceAccountId && <p className="text-xs text-red-400 mt-1">{errors.sourceAccountId}</p>}
  </div>
)}
```

- [ ] **Step 3: Update `AddDividendForm.tsx` destination account select**

`SelectField` is already imported (Task 4). Replace the `<select>` for `div-dest` (lines 118–132):

```tsx
{!staysInPortfolio && bankAccounts.length > 0 && (
  <div>
    <label htmlFor="div-dest" className="text-xs text-slate-400 block mb-1">חשבון יעד</label>
    <SelectField
      value={destinationAccountId}
      onChange={v => { setDestinationAccountId(v); if (errors.destination) setErrors(p => ({ ...p, destination: undefined })) }}
      options={bankAccounts.map(a => ({ value: a.id, label: a.name, color: a.color }))}
      nullable
      nullLabel="בחר חשבון..."
      placeholder="בחר חשבון..."
      error={!!errors.destination}
    />
    {errors.destination && <p className="text-xs text-red-400 mt-1">{errors.destination}</p>}
  </div>
)}
```

- [ ] **Step 4: Update `AddInvestmentConversionForm.tsx` destination account select**

`SelectField` is already imported (Task 4). Replace the `<select>` for `conv-dest` (lines 103–118):

```tsx
{bankAccounts.length > 0 && (
  <div>
    <label htmlFor="conv-dest" className="text-xs text-slate-400 block mb-1">חשבון שקיבל</label>
    <SelectField
      value={destinationAccountId}
      onChange={setDestinationAccountId}
      options={bankAccounts.map(a => ({ value: a.id, label: a.name, color: a.color }))}
      nullable
      nullLabel="בחר חשבון (אופציונלי)..."
      placeholder="בחר חשבון (אופציונלי)..."
    />
  </div>
)}
```

- [ ] **Step 5: Verify manually**

Open http://localhost:3000. Test:
1. עסקאות → Add transaction → account dropdown shows color dots and is searchable
2. השקעות → Add entry → source account shows color dots
3. השקעות → Add dividend → when "הועבר לבנק" is selected, destination account shows color dots

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/AddTransactionForm.tsx src/components/investments/AddInvestmentEntryForm.tsx src/components/investments/AddDividendForm.tsx src/components/investments/AddInvestmentConversionForm.tsx
git commit -m "feat: replace account selects with searchable SelectField with color dots"
```

---

## Task 6: Direction Select → DirectionToggle in Import Flows

Replace the per-row direction `<select>` (2 options) in BankFlow and CreditFlow with `<DirectionToggle size="sm">`. The existing `onChange` logic (clearing `categoryId` on income) must be preserved.

**Files:**
- Modify: `src/components/import/flows/BankFlow.tsx`
- Modify: `src/components/import/flows/CreditFlow.tsx`

**Interfaces — Consumes:**
```typescript
import { DirectionToggle } from '@/components/ui/DirectionToggle'
// DirectionToggle props:
// value: 'expense' | 'income'
// onChange: (v: 'expense' | 'income') => void
// size?: 'sm' | 'md'
```

- [ ] **Step 1: Update `BankFlow.tsx` direction cell**

Add import at top (if not already present):
```tsx
import { DirectionToggle } from '@/components/ui/DirectionToggle'
```

Find the direction `<td>` in the table body (lines ~338–349). Replace the `<select>` for direction:

```tsx
<td className="py-1.5 px-2">
  <DirectionToggle
    value={row.direction}
    onChange={v => updateRow(i, { direction: v, categoryId: v === 'income' ? null : row.categoryId })}
    size="sm"
  />
</td>
```

Note: The `disabled` prop does not exist on `DirectionToggle`. Wrap with opacity when `row.skip`:

```tsx
<td className={`py-1.5 px-2 ${row.skip ? 'opacity-40 pointer-events-none' : ''}`}>
  <DirectionToggle
    value={row.direction}
    onChange={v => updateRow(i, { direction: v, categoryId: v === 'income' ? null : row.categoryId })}
    size="sm"
  />
</td>
```

- [ ] **Step 2: Update `CreditFlow.tsx` direction cell**

Add import at top (if not already present):
```tsx
import { DirectionToggle } from '@/components/ui/DirectionToggle'
```

Find the direction `<td>` in the table body (lines ~285–296). Replace the `<select>` for direction:

```tsx
<td className={`py-1.5 px-2 ${tx.skip ? 'opacity-40 pointer-events-none' : ''}`}>
  <DirectionToggle
    value={tx.direction}
    onChange={v => updateRow(i, { direction: v, categoryId: v === 'income' ? null : tx.categoryId })}
    size="sm"
  />
</td>
```

- [ ] **Step 3: Verify manually**

Open http://localhost:3000. Navigate to ייבוא → upload a bank file. In the transactions table, verify:
- Direction column shows a small toggle (הוצאה/הכנסה) instead of a `<select>` dropdown
- Switching to הכנסה clears the category cell (shows "הכנסה" label)
- Switching back to הוצאה restores the category dropdown
- Skipped rows appear faded and the toggle is non-interactive

- [ ] **Step 4: Commit**

```bash
git add src/components/import/flows/BankFlow.tsx src/components/import/flows/CreditFlow.tsx
git commit -m "feat: replace direction selects in import flows with DirectionToggle sm"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| `SelectField` component with all props | Task 1 |
| Tests: 8 behaviors | Task 1 |
| Category in AddTransactionForm | Task 2 |
| Category in TransactionRow EditForm | Task 2 |
| CategorySelect.tsx rewrite | Task 2 |
| Category in RulesSection (no nullable) | Task 2 |
| Category in BankFlow rows (sm, nullable, categorizationSource) | Task 3 |
| Category in CreditFlow rows (sm, nullable, categorizationSource) | Task 3 |
| Investment type in AddInvestmentEntryForm (grouped) | Task 4 |
| Investment type in AddDividendForm (flat) | Task 4 |
| Investment type in AddInvestmentConversionForm (flat) | Task 4 |
| Account in AddTransactionForm (no nullable) | Task 5 |
| Account in AddInvestmentEntryForm (nullable, error) | Task 5 |
| Account in AddDividendForm (nullable, error) | Task 5 |
| Account in AddInvestmentConversionForm (nullable, no error) | Task 5 |
| Direction select → DirectionToggle in BankFlow | Task 6 |
| Direction select → DirectionToggle in CreditFlow | Task 6 |
| What is NOT changed: currency in BankFlow, match type in Settings, linked bank button group | ✅ Not touched |

### Placeholder Scan
None — all steps contain exact code.

### Type Consistency
- `SelectOption.value: string` used consistently across all tasks
- `nullable` prop sends `''` to `onChange`, callers convert `''` → `null` or `undefined` as needed (Task 3 uses `v || null`, Task 2 uses `v || undefined`)
- `error={!!errors.typeId}` pattern consistent across Tasks 4 and 5
