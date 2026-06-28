# SearchableSelect — Dropdown with Search Design

**Goal:** Replace all `<select>` elements for categories, investment types, and bank/cash accounts with a unified searchable dropdown component that matches the CurrencyPicker style.

**Architecture:** One generic `SelectField` component handles all use cases via props (nullable, grouped, size, color dots). Domain-specific wrappers are not needed — the component is simple enough to use directly.

**Tech Stack:** React, Tailwind CSS, Next.js 14, TypeScript strict, Hebrew RTL UI.

---

## Component: `SelectField`

**File:** `src/components/ui/SelectField.tsx`

### Interface

```tsx
interface SelectOption {
  value: string
  label: string
  color?: string   // CSS color string — renders a filled dot (●) next to label
  group?: string   // Section header rendered above first item in each group
}

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string   // shown when value === '', e.g. "בחר קטגוריה..."
  nullable?: boolean     // show a "none" option at top of list
  nullLabel?: string     // label for none option, default: "— ללא —"
  error?: boolean        // red ring on trigger when true
  disabled?: boolean
  size?: 'sm' | 'md'    // 'md' default (forms), 'sm' for import table rows
  className?: string
}
```

### Behavior

- **Trigger (closed):** Full-width button styled like a form field. Shows color dot + selected label, or placeholder in muted color. Chevron ▾ on the left (RTL). Red ring when `error=true`.
- **Dropdown (open):** Absolute-positioned, `z-50`, opens below trigger (`top-full`), `left-0` to open rightward. Contains a search `<input>` at top, then a scrollable list (`max-h-52 overflow-y-auto`).
- **Search:** Filters options by label (case-insensitive). Group headers only shown when at least one item in the group matches.
- **Groups:** When `option.group` changes between adjacent options, a non-selectable group header is rendered above the item. Items without a group render at the bottom ungrouped.
- **Nullable option:** When `nullable=true`, a "— ללא —" item (or custom `nullLabel`) always appears at top of list and is never filtered by search. Selecting it calls `onChange('')`.
- **Size sm:** Smaller trigger (`text-xs`, `py-1`, `px-2`), dropdown fixed `w-56`. Used in import table rows.
- **Size md (default):** Full-width trigger (`text-sm`, `py-2`, `px-3`), dropdown `w-full min-w-[14rem]`.
- **Click-outside:** Same pattern as CurrencyPicker — `mousedown` listener on `document`, clears search on close.
- **`dir="ltr"`** on dropdown div to prevent RTL from reversing the list layout.

### Visual Design

```
Trigger (closed, md):
┌─────────────────────────────┐
│  ● מזון ושתייה            ▾ │  ← color dot + selected label + chevron
└─────────────────────────────┘

Trigger (placeholder, md):
┌─────────────────────────────┐
│  בחר קטגוריה...           ▾ │  ← muted color
└─────────────────────────────┘

Dropdown:
┌─────────────────────────────┐
│  [חפש...]                   │  ← search input
├─────────────────────────────┤
│  — ללא —                    │  ← nullable item (always visible)
├─────────────────────────────┤
│  ── בית ──                  │  ← group header (non-selectable)
│  ● קניות                    │
│  ● חשמל ומים               │
│  ── תחבורה ──               │
│  ● דלק                     │
└─────────────────────────────┘
```

---

## Replacement Map

### Task 1 — Create `SelectField` component
- **Create:** `src/components/ui/SelectField.tsx`
- **Create:** `src/components/ui/SelectField.test.tsx`

### Task 2 — Category selects in forms
| File | Field | nullable | nullLabel | error state |
|------|-------|----------|-----------|-------------|
| `AddTransactionForm.tsx` | קטגוריה | yes | "— ללא —" | no |
| `TransactionRow.tsx` (EditForm) | קטגוריה | yes | "— ללא —" | no |
| `CategorySelect.tsx` | root | yes | "ללא קטגוריה" | no |
| `settings/page.tsx` (RulesSection) | קטגוריה | no | — | no |

Category options shape: `categories.map(c => ({ value: c.id, label: c.name, color: c.color }))`

### Task 3 — Category selects in import table rows
| File | Field | size | nullable | onChange extra |
|------|-------|------|----------|---------------|
| `BankFlow.tsx` (per row) | קטגוריה | sm | yes | sets `categorizationSource: 'manual'` |
| `CreditFlow.tsx` (per row) | קטגוריה | sm | yes | sets `categorizationSource: 'manual'` |

Empty value → `null` (these store `categoryId: null`, not `''`). The onChange converts: `value === '' ? null : value`.

### Task 4 — Investment type selects
| File | Field | grouped | error state |
|------|-------|---------|-------------|
| `AddInvestmentEntryForm.tsx` | סוג השקעה | yes (by portfolio) | yes |
| `AddDividendForm.tsx` | סוג השקעה | no | yes |
| `AddInvestmentConversionForm.tsx` | סוג השקעה | no | yes |

Investment type options:
- **Grouped:** `types.map(t => ({ value: t.id, label: t.name, group: portfolioMap[t.portfolioAccountId]?.name ?? 'אחר' }))`
- **Ungrouped:** `types.map(t => ({ value: t.id, label: t.name }))`

Error cleared via `setErrors(p => ({ ...p, typeId: undefined }))` when value becomes non-empty.

### Task 5 — Account selects
| File | Field | nullable | nullLabel | error state |
|------|-------|----------|-----------|-------------|
| `AddTransactionForm.tsx` | חשבון | no | — | no |
| `AddInvestmentEntryForm.tsx` | חשבון מקור | yes | "בחר חשבון..." | yes |
| `AddDividendForm.tsx` | חשבון יעד | yes | "בחר חשבון..." | yes |
| `AddInvestmentConversionForm.tsx` | חשבון שקיבל | yes | "בחר חשבון (אופציונלי)..." | no |

Account options: `accounts.map(a => ({ value: a.id, label: a.name, color: a.color }))`

### Task 6 — Fix direction select → DirectionToggle
| File | Context | Change |
|------|---------|--------|
| `BankFlow.tsx` | Table cell per row | `<select>` (2 options) → `<DirectionToggle size="sm">` |
| `CreditFlow.tsx` | Table cell per row | `<select>` (2 options) → `<DirectionToggle size="sm">` |

`DirectionToggle` already supports `size="sm"`. The onChange handler stays identical — must still clear `categoryId` when switching to income.

---

## What Is NOT Changed
- **Currency select in BankFlow** — already updated, small fixed set, stays as-is
- **Match type in Settings** — 3 static technical options, native select is fine
- **Linked bank in Settings** — already uses button group, good UX

---

## Testing

`SelectField.test.tsx` covers:
1. Renders placeholder when no value
2. Renders selected label + color dot when value set
3. Opens dropdown on click
4. Filters by search
5. Calls onChange with correct value on item click
6. Shows group headers
7. Nullable item always visible during search
8. Closes on click outside
