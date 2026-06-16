# Plan 2: Import Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete monthly import flow — CSV/XLSX in-memory parsing, keyword-based auto-categorization, and a 5-step wizard UI that saves all data to Firestore.

**Architecture:** Pure parsing functions (csv-parser, xlsx-parser, transaction-mapper) are tested independently of the UI. A categorization engine applies keyword rules + history lookup and returns a suggestion. Six Firestore service modules handle data persistence. A client-side multi-step wizard orchestrates user input across 5 import steps and saves everything to Firestore in a final summary step.

**Tech Stack:** PapaParse (CSV), SheetJS/xlsx (XLSX), Firebase Firestore modular SDK v9, React hooks, Tailwind CSS v4 (`@theme inline` tokens — use `bg-surface`, `text-accent` etc.), Next.js App Router (`'use client'` for wizard), Jest + Testing Library

---

## File Structure

**New files:**
```
src/lib/parsers/
  csv-parser.ts               PapaParse wrapper → ParsedRow[]
  csv-parser.test.ts
  xlsx-parser.ts              SheetJS wrapper → sheet names + rows
  xlsx-parser.test.ts
  transaction-mapper.ts       ParsedRow[] → RawTransaction[] (Discount Bank/Max format)
  transaction-mapper.test.ts

src/lib/categorization/
  engine.ts                   keyword rules + history lookup → CategorizationResult
  engine.test.ts

src/lib/firestore/
  accounts.ts                 getAccounts, addAccount, seedDefaultAccounts
  accounts.test.ts
  categories.ts               getCategories, addCategory, seedDefaultCategories
  categories.test.ts
  categorization-rules.ts     getRules, addRule, updateRule, deleteRule
  categorization-rules.test.ts
  transactions.ts             getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction
  transactions.test.ts
  salary.ts                   getSalaryEntry, upsertSalaryEntry
  salary.test.ts
  income.ts                   getIncomeEntries, addIncomeEntry, deleteIncomeEntry
  income.test.ts

src/components/import/
  ImportWizard.tsx            step state machine (1–5 + summary), month selector, data loading
  ImportWizard.test.tsx
  steps/
    CreditImportStep.tsx      file upload + parse + XLSX sheet selector + preview table + categorize (reused for steps 1 & 2)
    CreditImportStep.test.tsx
    SalaryStep.tsx            salary form, pre-fills from previous month (step 3)
    SalaryStep.test.tsx
    IncomeStep.tsx            dynamic income list (step 4)
    IncomeStep.test.tsx
    CashStep.tsx              cash expenses list (step 5)
    CashStep.test.tsx
    SummaryStep.tsx           summary + save all to Firestore
    SummaryStep.test.tsx
```

**Modified files:**
```
src/lib/types/index.ts          add RawTransaction, ImportedTransaction
src/app/(app)/import/page.tsx   replace placeholder with <ImportWizard />
package.json                    add papaparse, xlsx; devDep @types/papaparse
```

---

## Firestore mock pattern (used in every service test)

Every service test uses this identical mock block at the top of the file. Copy it verbatim — do not abbreviate.

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

### Task 1: Install parsing libraries

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "c:\Users\Eitan\Documents\learning\financialTrack"
npm install papaparse xlsx
npm install -D @types/papaparse
```

- [ ] **Step 2: Verify TypeScript can resolve the imports**

```bash
npx tsc --noEmit
```

Expected: no errors related to papaparse or xlsx.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add papaparse and xlsx parsing libraries"
```

---

### Task 2: CSV parser

**Files:**
- Create: `src/lib/parsers/csv-parser.ts`
- Test: `src/lib/parsers/csv-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/parsers/csv-parser.test.ts
import { parseCSV } from './csv-parser'

describe('parseCSV', () => {
  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('parses CSV with Hebrew headers', () => {
    const csv = `תאריך עסקה,שם בית העסק,סכום חיוב\n01/06/2026,שופרסל,150.00`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['שם בית העסק']).toBe('שופרסל')
    expect(rows[0]['סכום חיוב']).toBe('150.00')
  })

  it('skips blank lines', () => {
    const csv = `תאריך עסקה,שם בית העסק\n\n01/06/2026,שופרסל\n`
    expect(parseCSV(csv)).toHaveLength(1)
  })

  it('parses multiple rows', () => {
    const csv = `תאריך עסקה,שם בית העסק\n01/06/2026,שופרסל\n02/06/2026,YES`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]['שם בית העסק']).toBe('YES')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/parsers/csv-parser.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './csv-parser'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/parsers/csv-parser.ts
import Papa from 'papaparse'

export type ParsedRow = Record<string, string>

export function parseCSV(csvText: string): ParsedRow[] {
  const result = Papa.parse<ParsedRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  return result.data
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/parsers/csv-parser.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/csv-parser.ts src/lib/parsers/csv-parser.test.ts
git commit -m "feat: add CSV parser using PapaParse"
```

---

### Task 3: XLSX parser

**Files:**
- Create: `src/lib/parsers/xlsx-parser.ts`
- Test: `src/lib/parsers/xlsx-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/parsers/xlsx-parser.test.ts
import * as XLSX from 'xlsx'
import { getSheetNames, parseSheet } from './xlsx-parser'

// Helper: build an in-memory XLSX Uint8Array
function buildXLSX(sheets: Record<string, Record<string, string>[]>): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

describe('getSheetNames', () => {
  it('returns all sheet names in order', () => {
    const data = buildXLSX({ 'פירוט': [], 'קניות בחול': [] })
    expect(getSheetNames(data)).toEqual(['פירוט', 'קניות בחול'])
  })

  it('returns single sheet name', () => {
    const data = buildXLSX({ 'גליון1': [] })
    expect(getSheetNames(data)).toEqual(['גליון1'])
  })
})

describe('parseSheet', () => {
  it('returns rows from named sheet', () => {
    const data = buildXLSX({
      'פירוט': [{ 'שם בית העסק': 'שופרסל', 'סכום חיוב': '150' }],
    })
    const rows = parseSheet(data, 'פירוט')
    expect(rows).toHaveLength(1)
    expect(rows[0]['שם בית העסק']).toBe('שופרסל')
  })

  it('returns empty array for non-existent sheet', () => {
    const data = buildXLSX({ 'פירוט': [] })
    expect(parseSheet(data, 'לא קיים')).toEqual([])
  })

  it('returns empty array for sheet with no rows', () => {
    const data = buildXLSX({ 'ריק': [] })
    expect(parseSheet(data, 'ריק')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/parsers/xlsx-parser.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './xlsx-parser'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/parsers/xlsx-parser.ts
import * as XLSX from 'xlsx'
import type { ParsedRow } from './csv-parser'

export function getSheetNames(data: Uint8Array): string[] {
  const workbook = XLSX.read(data, { type: 'array' })
  return workbook.SheetNames
}

export function parseSheet(data: Uint8Array, sheetName: string): ParsedRow[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '', raw: false })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/parsers/xlsx-parser.test.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/xlsx-parser.ts src/lib/parsers/xlsx-parser.test.ts
git commit -m "feat: add XLSX parser using SheetJS"
```

---

### Task 4: Transaction mapper + new types

**Files:**
- Modify: `src/lib/types/index.ts` (append two new interfaces)
- Create: `src/lib/parsers/transaction-mapper.ts`
- Test: `src/lib/parsers/transaction-mapper.test.ts`

- [ ] **Step 1: Add new types to `src/lib/types/index.ts`**

Append these two interfaces at the end of the file:

```typescript
// Intermediate type produced by transaction-mapper from a CSV/XLSX row
export interface RawTransaction {
  date: string         // ISO YYYY-MM-DD
  merchantName: string
  bankCategory: string // the bank's own category string (used as fallback suggestion)
  amount: number
  currency: string
  isImmediate: boolean // true when סוג עסקה === 'חיוב עסקות מיידי'
  notes: string
}

// RawTransaction after the categorization engine has run
export interface ImportedTransaction extends RawTransaction {
  categoryId: string | null
  categorizationSource: 'rule' | 'history' | 'manual' | null
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/parsers/transaction-mapper.test.ts
import { mapRows } from './transaction-mapper'

const BASE_ROW = {
  'תאריך עסקה': '01/06/2026',
  'שם בית העסק': 'שופרסל',
  'קטגוריה': 'מזון',
  'סוג עסקה': 'רגיל',
  'סכום חיוב': '150.00',
  'מטבע חיוב': 'ILS',
  'הערות': '',
}

describe('mapRows', () => {
  it('maps a basic row correctly', () => {
    const [tx] = mapRows([BASE_ROW])
    expect(tx.date).toBe('2026-06-01')
    expect(tx.merchantName).toBe('שופרסל')
    expect(tx.bankCategory).toBe('מזון')
    expect(tx.amount).toBe(150)
    expect(tx.currency).toBe('ILS')
    expect(tx.isImmediate).toBe(false)
    expect(tx.notes).toBe('')
  })

  it('detects immediate transactions', () => {
    const row = { ...BASE_ROW, 'סוג עסקה': 'חיוב עסקות מיידי' }
    expect(mapRows([row])[0].isImmediate).toBe(true)
  })

  it('filters out rows with no merchant name', () => {
    const row = { ...BASE_ROW, 'שם בית העסק': '   ' }
    expect(mapRows([row])).toHaveLength(0)
  })

  it('parses amounts with thousand-separator commas', () => {
    const row = { ...BASE_ROW, 'סכום חיוב': '1,234.56' }
    expect(mapRows([row])[0].amount).toBe(1234.56)
  })

  it('defaults currency to ILS when field is empty', () => {
    const row = { ...BASE_ROW, 'מטבע חיוב': '' }
    expect(mapRows([row])[0].currency).toBe('ILS')
  })

  it('trims whitespace from merchant name', () => {
    const row = { ...BASE_ROW, 'שם בית העסק': '  YES  ' }
    expect(mapRows([row])[0].merchantName).toBe('YES')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest src/lib/parsers/transaction-mapper.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './transaction-mapper'"

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/parsers/transaction-mapper.ts
import type { ParsedRow } from './csv-parser'
import type { RawTransaction } from '../types'

function parseDiscountDate(dateStr: string): string {
  const parts = (dateStr ?? '').split('/')
  if (parts.length !== 3) return dateStr ?? ''
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseAmount(raw: string): number {
  return parseFloat((raw ?? '0').replace(/,/g, '')) || 0
}

export function mapRows(rows: ParsedRow[]): RawTransaction[] {
  return rows
    .filter(row => row['שם בית העסק']?.trim())
    .map(row => ({
      date: parseDiscountDate(row['תאריך עסקה'] ?? ''),
      merchantName: row['שם בית העסק'].trim(),
      bankCategory: row['קטגוריה'] ?? '',
      amount: parseAmount(row['סכום חיוב'] ?? '0'),
      currency: row['מטבע חיוב']?.trim() || 'ILS',
      isImmediate: row['סוג עסקה']?.trim() === 'חיוב עסקות מיידי',
      notes: row['הערות'] ?? '',
    }))
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/lib/parsers/transaction-mapper.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/index.ts src/lib/parsers/transaction-mapper.ts src/lib/parsers/transaction-mapper.test.ts
git commit -m "feat: add transaction mapper and RawTransaction/ImportedTransaction types"
```

---

### Task 5: Categorization engine

**Files:**
- Create: `src/lib/categorization/engine.ts`
- Test: `src/lib/categorization/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/categorization/engine.test.ts
import { categorize } from './engine'
import type { CategorizationRule, Transaction } from '../types'

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return { id: 'r1', keyword: 'שופרסל', matchType: 'contains', categoryId: 'food', priority: 1, createdAt: '2026-01-01', ...overrides }
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 100, currency: 'ILS', accountId: 'a1', categoryId: 'food', source: 'csv_import', isImmediate: false, month: '2026-06', ...overrides }
}

describe('categorize', () => {
  it('matches a contains rule', () => {
    const result = categorize('שופרסל דיזנגוף', [rule()], [])
    expect(result).toEqual({ categoryId: 'food', source: 'rule', ruleId: 'r1' })
  })

  it('matches an exact rule (case-insensitive)', () => {
    const r = rule({ matchType: 'exact', keyword: 'yes' })
    expect(categorize('YES', [r], []).categoryId).toBe('food')
    expect(categorize('YES EXTRA', [r], []).categoryId).toBeNull()
  })

  it('matches a startsWith rule', () => {
    const r = rule({ matchType: 'startsWith', keyword: 'פארם' })
    expect(categorize('פארמדיק', [r], []).categoryId).toBe('food')
    expect(categorize('לא פארמדיק', [r], []).categoryId).toBeNull()
  })

  it('uses history when no rule matches', () => {
    const result = categorize('חנות חדשה', [], [tx({ merchantName: 'חנות חדשה', categoryId: 'cat2' })])
    expect(result).toEqual({ categoryId: 'cat2', source: 'history' })
  })

  it('prefers rule over history', () => {
    const result = categorize('שופרסל', [rule({ categoryId: 'food' })], [tx({ categoryId: 'other' })])
    expect(result.source).toBe('rule')
    expect(result.categoryId).toBe('food')
  })

  it('uses higher-priority rule when multiple rules match', () => {
    const low = rule({ id: 'r1', categoryId: 'food', priority: 1 })
    const high = rule({ id: 'r2', categoryId: 'grocery', priority: 10 })
    expect(categorize('שופרסל', [low, high], []).categoryId).toBe('grocery')
  })

  it('returns null when nothing matches', () => {
    const result = categorize('חנות לא ידועה', [], [])
    expect(result).toEqual({ categoryId: null, source: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/categorization/engine.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './engine'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/categorization/engine.ts
import type { CategorizationRule, Transaction } from '../types'

export interface CategorizationResult {
  categoryId: string | null
  source: 'rule' | 'history' | null
  ruleId?: string
}

function matches(merchantName: string, rule: CategorizationRule): boolean {
  const name = merchantName.toLowerCase()
  const kw = rule.keyword.toLowerCase()
  switch (rule.matchType) {
    case 'contains':   return name.includes(kw)
    case 'exact':      return name === kw
    case 'startsWith': return name.startsWith(kw)
  }
}

export function categorize(
  merchantName: string,
  rules: CategorizationRule[],
  history: Transaction[]
): CategorizationResult {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  for (const rule of sorted) {
    if (matches(merchantName, rule)) {
      return { categoryId: rule.categoryId, source: 'rule', ruleId: rule.id }
    }
  }
  const past = history.find(t => t.merchantName === merchantName && t.categoryId)
  if (past?.categoryId) {
    return { categoryId: past.categoryId, source: 'history' }
  }
  return { categoryId: null, source: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/categorization/engine.test.ts --no-coverage
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/categorization/engine.ts src/lib/categorization/engine.test.ts
git commit -m "feat: add categorization engine with keyword rules and history lookup"
```

---

### Task 6: Firestore — accounts + categories + seed defaults

**Files:**
- Create: `src/lib/firestore/accounts.ts`
- Create: `src/lib/firestore/accounts.test.ts`
- Create: `src/lib/firestore/categories.ts`
- Create: `src/lib/firestore/categories.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/firestore/accounts.test.ts
// (paste the Firestore mock pattern from the top of this document first)
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()

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

import { getAccounts, addAccount, seedDefaultAccounts } from './accounts'

beforeEach(() => jest.clearAllMocks())

describe('getAccounts', () => {
  it('returns mapped accounts from Firestore', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'a1', data: () => ({ name: 'אשראי בהצדעה', type: 'credit', color: '#f59e0b', isActive: true }) }],
    })
    const accounts = await getAccounts()
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toEqual({ id: 'a1', name: 'אשראי בהצדעה', type: 'credit', color: '#f59e0b', isActive: true })
  })
})

describe('addAccount', () => {
  it('adds account and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new1' })
    const account = await addAccount({ name: 'מזומן', type: 'cash', color: '#94a3b8', isActive: true })
    expect(account).toEqual({ id: 'new1', name: 'מזומן', type: 'cash', color: '#94a3b8', isActive: true })
  })
})

describe('seedDefaultAccounts', () => {
  it('does not seed when accounts already exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 'existing' }] })
    await seedDefaultAccounts()
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('seeds exactly 5 default accounts when collection is empty', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    mockAddDoc.mockResolvedValue({ id: 'new' })
    await seedDefaultAccounts()
    expect(mockAddDoc).toHaveBeenCalledTimes(5)
  })
})
```

```typescript
// src/lib/firestore/categories.test.ts
// (same Firestore mock block as above)
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()

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

import { getCategories, seedDefaultCategories } from './categories'

beforeEach(() => jest.clearAllMocks())

describe('getCategories', () => {
  it('returns mapped categories', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'c1', data: () => ({ name: 'אוכל', color: '#ef4444', isActive: true }) }],
    })
    const cats = await getCategories()
    expect(cats[0]).toEqual({ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true })
  })
})

describe('seedDefaultCategories', () => {
  it('does not seed when categories already exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 'existing' }] })
    await seedDefaultCategories()
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('seeds exactly 15 default categories when collection is empty', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    mockAddDoc.mockResolvedValue({ id: 'new' })
    await seedDefaultCategories()
    expect(mockAddDoc).toHaveBeenCalledTimes(15)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/firestore/accounts.test.ts src/lib/firestore/categories.test.ts --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

```typescript
// src/lib/firestore/accounts.ts
import { getFirestore, collection, getDocs, addDoc, query, limit } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Account } from '../types'

function getDb() { return getFirestore(app) }

export async function getAccounts(): Promise<Account[]> {
  const snap = await getDocs(collection(getDb(), 'accounts'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account))
}

export async function addAccount(account: Omit<Account, 'id'>): Promise<Account> {
  const ref = await addDoc(collection(getDb(), 'accounts'), account)
  return { id: ref.id, ...account }
}

const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { name: 'אשראי בהצדעה',  type: 'credit', last4digits: '8729', color: '#f59e0b', isActive: true },
  { name: 'אשראי One Zero', type: 'credit',                      color: '#3b82f6', isActive: true },
  { name: 'בנק One Zero',   type: 'bank',                        color: '#10b981', isActive: true },
  { name: 'בנק לאומי',      type: 'bank',                        color: '#6366f1', isActive: true },
  { name: 'מזומן',          type: 'cash',                        color: '#94a3b8', isActive: true },
]

export async function seedDefaultAccounts(): Promise<void> {
  const snap = await getDocs(query(collection(getDb(), 'accounts'), limit(1)))
  if (!snap.empty) return
  for (const account of DEFAULT_ACCOUNTS) {
    await addDoc(collection(getDb(), 'accounts'), account)
  }
}
```

```typescript
// src/lib/firestore/categories.ts
import { getFirestore, collection, getDocs, addDoc, query, limit } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Category } from '../types'

function getDb() { return getFirestore(app) }

export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(collection(getDb(), 'categories'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category))
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const ref = await addDoc(collection(getDb(), 'categories'), category)
  return { id: ref.id, ...category }
}

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'אוכל',           color: '#ef4444', isActive: true },
  { name: 'חשבונות',        color: '#f97316', isActive: true },
  { name: 'רפואה',          color: '#84cc16', isActive: true },
  { name: 'תחבורה',         color: '#06b6d4', isActive: true },
  { name: 'תחזוקה',         color: '#8b5cf6', isActive: true },
  { name: 'חופשים',         color: '#ec4899', isActive: true },
  { name: 'מתנות לעצמי',   color: '#f43f5e', isActive: true },
  { name: 'מתנות לאחרים',  color: '#e11d48', isActive: true },
  { name: 'קורסים וחוגים', color: '#a855f7', isActive: true },
  { name: 'סופש כיף',      color: '#6366f1', isActive: true },
  { name: 'בילויים',        color: '#3b82f6', isActive: true },
  { name: 'בגדים',          color: '#14b8a6', isActive: true },
  { name: 'אוכל בחוץ',     color: '#f59e0b', isActive: true },
  { name: 'השקעות',         color: '#10b981', isActive: true },
  { name: 'שכירות',         color: '#64748b', isActive: true },
]

export async function seedDefaultCategories(): Promise<void> {
  const snap = await getDocs(query(collection(getDb(), 'categories'), limit(1)))
  if (!snap.empty) return
  for (const cat of DEFAULT_CATEGORIES) {
    await addDoc(collection(getDb(), 'categories'), cat)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/firestore/accounts.test.ts src/lib/firestore/categories.test.ts --no-coverage
```

Expected: PASS (7 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/accounts.ts src/lib/firestore/accounts.test.ts src/lib/firestore/categories.ts src/lib/firestore/categories.test.ts
git commit -m "feat: add accounts and categories Firestore services with default seeding"
```

---

### Task 7: Firestore — categorization rules

**Files:**
- Create: `src/lib/firestore/categorization-rules.ts`
- Test: `src/lib/firestore/categorization-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/firestore/categorization-rules.test.ts
// (paste the Firestore mock block from the top of this document)
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

import { getRules, addRule, updateRule, deleteRule } from './categorization-rules'

beforeEach(() => jest.clearAllMocks())

describe('getRules', () => {
  it('returns rules ordered by priority desc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'r1', data: () => ({ keyword: 'שופרסל', matchType: 'contains', categoryId: 'c1', priority: 5, createdAt: '2026-01-01' }) },
      ],
    })
    const rules = await getRules()
    expect(rules[0]).toEqual({ id: 'r1', keyword: 'שופרסל', matchType: 'contains', categoryId: 'c1', priority: 5, createdAt: '2026-01-01' })
    expect(mockOrderBy).toHaveBeenCalledWith('priority', 'desc')
  })
})

describe('addRule', () => {
  it('adds rule and returns it with generated id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'r2' })
    const rule = await addRule({ keyword: 'YES', matchType: 'exact', categoryId: 'c2', priority: 1, createdAt: '2026-06-01' })
    expect(rule.id).toBe('r2')
    expect(rule.keyword).toBe('YES')
  })
})

describe('updateRule', () => {
  it('calls updateDoc on the correct document', async () => {
    mockUpdateDoc.mockResolvedValue(undefined)
    await updateRule('r1', { priority: 10 })
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { priority: 10 })
  })
})

describe('deleteRule', () => {
  it('calls deleteDoc on the correct document', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await deleteRule('r1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/firestore/categorization-rules.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './categorization-rules'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/firestore/categorization-rules.ts
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { CategorizationRule } from '../types'

function getDb() { return getFirestore(app) }

export async function getRules(): Promise<CategorizationRule[]> {
  const q = query(collection(getDb(), 'categorization_rules'), orderBy('priority', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategorizationRule))
}

export async function addRule(rule: Omit<CategorizationRule, 'id'>): Promise<CategorizationRule> {
  const ref = await addDoc(collection(getDb(), 'categorization_rules'), rule)
  return { id: ref.id, ...rule }
}

export async function updateRule(id: string, updates: Partial<Omit<CategorizationRule, 'id'>>): Promise<void> {
  await updateDoc(doc(getDb(), 'categorization_rules', id), updates)
}

export async function deleteRule(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'categorization_rules', id))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/firestore/categorization-rules.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/categorization-rules.ts src/lib/firestore/categorization-rules.test.ts
git commit -m "feat: add categorization rules Firestore service"
```

---

### Task 8: Firestore — transactions

**Files:**
- Create: `src/lib/firestore/transactions.ts`
- Test: `src/lib/firestore/transactions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/firestore/transactions.test.ts
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn().mockResolvedValue(undefined)
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

import { getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction } from './transactions'

beforeEach(() => jest.clearAllMocks())

const mockTxData = { date: '2026-06-01', merchantName: 'שופרסל', amount: 150, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06' }

describe('getTransactions', () => {
  it('queries by month and orders by date desc', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => mockTxData }] })
    const txs = await getTransactions('2026-06')
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc')
    expect(txs[0]).toEqual({ id: 't1', ...mockTxData })
  })
})

describe('getTransactionsByMerchant', () => {
  it('queries by merchantName', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    await getTransactionsByMerchant('שופרסל')
    expect(mockWhere).toHaveBeenCalledWith('merchantName', '==', 'שופרסל')
  })
})

describe('addTransactions', () => {
  it('does nothing for empty array', async () => {
    await addTransactions([])
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })

  it('uses writeBatch and calls set once per transaction', async () => {
    await addTransactions([mockTxData, mockTxData])
    expect(mockWriteBatch).toHaveBeenCalledTimes(1)
    expect(mockBatchSet).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })
})

describe('updateTransaction', () => {
  it('calls updateDoc on the correct document', async () => {
    mockUpdateDoc.mockResolvedValue(undefined)
    await updateTransaction('t1', { categoryId: 'c1' })
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { categoryId: 'c1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/firestore/transactions.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './transactions'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/firestore/transactions.ts
import { getFirestore, collection, getDocs, writeBatch, updateDoc, doc, query, where, orderBy } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Transaction } from '../types'

function getDb() { return getFirestore(app) }

export async function getTransactions(month: string): Promise<Transaction[]> {
  const q = query(
    collection(getDb(), 'transactions'),
    where('month', '==', month),
    orderBy('date', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
}

export async function getTransactionsByMerchant(merchantName: string): Promise<Transaction[]> {
  const q = query(
    collection(getDb(), 'transactions'),
    where('merchantName', '==', merchantName)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
}

export async function addTransactions(transactions: Omit<Transaction, 'id'>[]): Promise<void> {
  if (transactions.length === 0) return
  const db = getDb()
  const batch = writeBatch(db)
  const colRef = collection(db, 'transactions')
  for (const tx of transactions) {
    batch.set(doc(colRef), tx)
  }
  await batch.commit()
}

export async function updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id'>>): Promise<void> {
  await updateDoc(doc(getDb(), 'transactions', id), updates)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/firestore/transactions.test.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/transactions.ts src/lib/firestore/transactions.test.ts
git commit -m "feat: add transactions Firestore service with batch write"
```

---

### Task 9: Firestore — salary + income

**Files:**
- Create: `src/lib/firestore/salary.ts`
- Create: `src/lib/firestore/salary.test.ts`
- Create: `src/lib/firestore/income.ts`
- Create: `src/lib/firestore/income.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/firestore/salary.test.ts
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

import { getSalaryEntry, upsertSalaryEntry } from './salary'

beforeEach(() => jest.clearAllMocks())

const salaryData = { month: '2026-06', employerName: 'חברה', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 100, pension: 1500, trainingFund: 750 }, netAmount: 10150 }

describe('getSalaryEntry', () => {
  it('returns null when no entry exists for the month', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    expect(await getSalaryEntry('2026-06')).toBeNull()
  })

  it('returns the salary entry when it exists', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 's1', data: () => salaryData }] })
    const entry = await getSalaryEntry('2026-06')
    expect(entry).toEqual({ id: 's1', ...salaryData })
  })
})

describe('upsertSalaryEntry', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await upsertSalaryEntry(salaryData)
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', salaryData, { merge: true })
  })
})
```

```typescript
// src/lib/firestore/income.test.ts
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

import { getIncomeEntries, addIncomeEntry, deleteIncomeEntry } from './income'

beforeEach(() => jest.clearAllMocks())

const incomeData = { month: '2026-06', sourceName: 'מילואים', amount: 3000, currency: 'ILS', date: '2026-06-15' }

describe('getIncomeEntries', () => {
  it('returns income entries for the month', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'i1', data: () => incomeData }] })
    const entries = await getIncomeEntries('2026-06')
    expect(entries[0]).toEqual({ id: 'i1', ...incomeData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })
})

describe('addIncomeEntry', () => {
  it('adds entry and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'i2' })
    const entry = await addIncomeEntry(incomeData)
    expect(entry).toEqual({ id: 'i2', ...incomeData })
  })
})

describe('deleteIncomeEntry', () => {
  it('calls deleteDoc on the correct document', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await deleteIncomeEntry('i1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/firestore/salary.test.ts src/lib/firestore/income.test.ts --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write implementations**

```typescript
// src/lib/firestore/salary.ts
import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { SalaryEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getSalaryEntry(month: string): Promise<SalaryEntry | null> {
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as SalaryEntry
}

export async function upsertSalaryEntry(entry: Omit<SalaryEntry, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = entry
  const docRef = id
    ? doc(getDb(), 'salary_entries', id)
    : doc(collection(getDb(), 'salary_entries'))
  await setDoc(docRef, data, { merge: true })
}
```

```typescript
// src/lib/firestore/income.ts
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { IncomeEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getIncomeEntries(month: string): Promise<IncomeEntry[]> {
  const q = query(collection(getDb(), 'income_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeEntry))
}

export async function addIncomeEntry(entry: Omit<IncomeEntry, 'id'>): Promise<IncomeEntry> {
  const ref = await addDoc(collection(getDb(), 'income_entries'), entry)
  return { id: ref.id, ...entry }
}

export async function deleteIncomeEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'income_entries', id))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/firestore/salary.test.ts src/lib/firestore/income.test.ts --no-coverage
```

Expected: PASS (5 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/salary.ts src/lib/firestore/salary.test.ts src/lib/firestore/income.ts src/lib/firestore/income.test.ts
git commit -m "feat: add salary and income Firestore services"
```

---

### Task 10: ImportWizard container

**Files:**
- Create: `src/components/import/ImportWizard.tsx`
- Test: `src/components/import/ImportWizard.test.tsx`

The wizard owns all state. It loads accounts, categories, rules, and previous-month transactions on mount (after seeding). It renders the appropriate step component based on `step` state (1–6, where 6 = SummaryStep).

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/import/ImportWizard.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ImportWizard } from './ImportWizard'

// Mock all Firestore services
jest.mock('@/lib/firestore/accounts', () => ({
  seedDefaultAccounts: jest.fn().mockResolvedValue(undefined),
  getAccounts: jest.fn().mockResolvedValue([
    { id: 'a1', name: 'אשראי בהצדעה',  type: 'credit', color: '#f59e0b', isActive: true },
    { id: 'a2', name: 'אשראי One Zero', type: 'credit', color: '#3b82f6', isActive: true },
    { id: 'a5', name: 'מזומן',          type: 'cash',   color: '#94a3b8', isActive: true },
  ]),
}))
jest.mock('@/lib/firestore/categories', () => ({
  seedDefaultCategories: jest.fn().mockResolvedValue(undefined),
  getCategories: jest.fn().mockResolvedValue([
    { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
  ]),
}))
jest.mock('@/lib/firestore/categorization-rules', () => ({
  getRules: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/salary', () => ({
  getSalaryEntry: jest.fn().mockResolvedValue(null),
}))

// Mock all step components with lightweight stubs
jest.mock('./steps/CreditImportStep', () => ({
  CreditImportStep: ({ accountName, onComplete, onSkip, onBack, stepNumber }: { accountName: string; onComplete: (t: unknown[]) => void; onSkip: () => void; onBack?: () => void; stepNumber: number }) => (
    <div>
      <span data-testid="step-label">שלב {stepNumber} — {accountName}</span>
      <button onClick={() => onComplete([])}>סיים</button>
      <button onClick={onSkip}>דלג</button>
      {onBack && <button onClick={onBack}>חזור</button>}
    </div>
  ),
}))
jest.mock('./steps/SalaryStep', () => ({
  SalaryStep: ({ onComplete, onSkip, onBack }: { onComplete: (s: unknown) => void; onSkip: () => void; onBack: () => void }) => (
    <div>
      <span data-testid="step-label">שלב 3 — משכורת</span>
      <button onClick={() => onComplete({})}>סיים</button>
      <button onClick={onSkip}>דלג</button>
      <button onClick={onBack}>חזור</button>
    </div>
  ),
}))
jest.mock('./steps/IncomeStep', () => ({
  IncomeStep: ({ onComplete, onBack }: { onComplete: (e: unknown[]) => void; onBack: () => void }) => (
    <div>
      <span data-testid="step-label">שלב 4 — הכנסות</span>
      <button onClick={() => onComplete([])}>סיים</button>
      <button onClick={onBack}>חזור</button>
    </div>
  ),
}))
jest.mock('./steps/CashStep', () => ({
  CashStep: ({ onComplete, onBack }: { onComplete: (e: unknown[]) => void; onBack: () => void }) => (
    <div>
      <span data-testid="step-label">שלב 5 — מזומן</span>
      <button onClick={() => onComplete([])}>סיים</button>
      <button onClick={onBack}>חזור</button>
    </div>
  ),
}))
jest.mock('./steps/SummaryStep', () => ({
  SummaryStep: ({ onDone }: { onDone: () => void }) => (
    <div>
      <span data-testid="step-label">סיכום</span>
      <button onClick={onDone}>סיים</button>
    </div>
  ),
}))

describe('ImportWizard', () => {
  it('shows loading state initially', () => {
    render(<ImportWizard />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows step 1 (אשראי בהצדעה) after loading', async () => {
    render(<ImportWizard />)
    await waitFor(() => expect(screen.getByTestId('step-label').textContent).toContain('שלב 1'))
    expect(screen.getByTestId('step-label').textContent).toContain('אשראי בהצדעה')
  })

  it('shows step counter text', async () => {
    render(<ImportWizard />)
    await waitFor(() => expect(screen.getByText('שלב 1 מתוך 5')).toBeInTheDocument())
  })

  it('advances to step 2 when step 1 completes', async () => {
    render(<ImportWizard />)
    await waitFor(() => screen.getByText('סיים'))
    fireEvent.click(screen.getByText('סיים'))
    expect(screen.getByTestId('step-label').textContent).toContain('שלב 2')
    expect(screen.getByTestId('step-label').textContent).toContain('אשראי One Zero')
  })

  it('advances through all 5 steps to summary', async () => {
    render(<ImportWizard />)
    await waitFor(() => screen.getByText('סיים'))
    // steps 1-5
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('סיים'))
    }
    expect(screen.getByTestId('step-label').textContent).toContain('סיכום')
  })

  it('shows month selector with navigation buttons', async () => {
    render(<ImportWizard />)
    await waitFor(() => screen.getByRole('button', { name: 'חודש קודם' }))
    expect(screen.getByRole('button', { name: 'חודש הבא' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/components/import/ImportWizard.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module './ImportWizard'"

- [ ] **Step 3: Write implementation**

```typescript
// src/components/import/ImportWizard.tsx
'use client'
import { useState, useEffect } from 'react'
import { seedDefaultAccounts, getAccounts } from '@/lib/firestore/accounts'
import { seedDefaultCategories, getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntry } from '@/lib/firestore/salary'
import { CreditImportStep } from './steps/CreditImportStep'
import { SalaryStep } from './steps/SalaryStep'
import { IncomeStep } from './steps/IncomeStep'
import { CashStep } from './steps/CashStep'
import { SummaryStep } from './steps/SummaryStep'
import type { Account, Category, CategorizationRule, ImportedTransaction, SalaryEntry, IncomeEntry, Transaction } from '@/lib/types'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface CashExpense {
  description: string
  amount: number
  date: string
  categoryId: string | null
}

interface WizardData {
  step1Transactions: ImportedTransaction[]
  step2Transactions: ImportedTransaction[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}

export function ImportWizard() {
  const [month, setMonth] = useState(currentMonth)
  const [step, setStep] = useState<WizardStep>(1)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)
  const [data, setData] = useState<WizardData>({
    step1Transactions: [], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [],
  })

  useEffect(() => {
    setLoading(true)
    async function init() {
      await Promise.all([seedDefaultAccounts(), seedDefaultCategories()])
      const [accs, cats, rls, txs, prevSal] = await Promise.all([
        getAccounts(),
        getCategories(),
        getRules(),
        getTransactions(month),
        getSalaryEntry(prevMonthStr(month)),
      ])
      setAccounts(accs)
      setCategories(cats)
      setRules(rls)
      setPreviousTransactions(txs)
      if (prevSal) {
        const { id: _id, ...rest } = prevSal
        setPreviousSalary(rest)
      }
      setLoading(false)
    }
    init()
  }, [month])

  function changeMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setStep(1)
    setData({ step1Transactions: [], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [] })
  }

  const hatzlaada = accounts.find(a => a.name === 'אשראי בהצדעה')
  const oneZero   = accounts.find(a => a.name === 'אשראי One Zero')
  const cash      = accounts.find(a => a.name === 'מזומן')

  if (loading) {
    return <main className="p-4 flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></main>
  }

  return (
    <main className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => changeMonth(-1)} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => changeMonth(1)} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      {step < 6 && <p className="text-center text-sm text-slate-400 mb-4">שלב {step} מתוך 5</p>}

      {step === 1 && (
        <CreditImportStep stepNumber={1} accountName="אשראי בהצדעה" accountId={hatzlaada?.id ?? ''}
          categories={categories} rules={rules} previousTransactions={previousTransactions}
          initialTransactions={data.step1Transactions}
          onComplete={txs => { setData(d => ({ ...d, step1Transactions: txs })); setStep(2) }}
          onSkip={() => setStep(2)} />
      )}
      {step === 2 && (
        <CreditImportStep stepNumber={2} accountName="אשראי One Zero" accountId={oneZero?.id ?? ''}
          categories={categories} rules={rules} previousTransactions={previousTransactions}
          initialTransactions={data.step2Transactions}
          onComplete={txs => { setData(d => ({ ...d, step2Transactions: txs })); setStep(3) }}
          onSkip={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <SalaryStep month={month} initialSalary={data.salary ?? previousSalary}
          onComplete={sal => { setData(d => ({ ...d, salary: sal })); setStep(4) }}
          onSkip={() => setStep(4)} onBack={() => setStep(2)} />
      )}
      {step === 4 && (
        <IncomeStep month={month} initialEntries={data.incomeEntries}
          onComplete={entries => { setData(d => ({ ...d, incomeEntries: entries })); setStep(5) }}
          onBack={() => setStep(3)} />
      )}
      {step === 5 && (
        <CashStep month={month} categories={categories} initialExpenses={data.cashExpenses}
          onComplete={expenses => { setData(d => ({ ...d, cashExpenses: expenses })); setStep(6) }}
          onBack={() => setStep(4)} />
      )}
      {step === 6 && (
        <SummaryStep month={month} data={data}
          hatzlaadaAccountId={hatzlaada?.id ?? ''} oneZeroAccountId={oneZero?.id ?? ''} cashAccountId={cash?.id ?? ''}
          onDone={() => { setStep(1); setData({ step1Transactions: [], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [] }) }} />
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/components/import/ImportWizard.test.tsx --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/import/ImportWizard.tsx src/components/import/ImportWizard.test.tsx
git commit -m "feat: add ImportWizard container with step routing and month selector"
```

---

### Task 11: CreditImportStep

**Files:**
- Create: `src/components/import/steps/CreditImportStep.tsx`
- Test: `src/components/import/steps/CreditImportStep.test.tsx`

This component is reused for steps 1 and 2. It handles file upload (CSV or XLSX), XLSX sheet selection, auto-categorization preview, and inline category editing.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/import/steps/CreditImportStep.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreditImportStep } from './CreditImportStep'

const mockMapRows = jest.fn().mockReturnValue([{
  date: '2026-06-01', merchantName: 'שופרסל', bankCategory: 'מזון',
  amount: 150, currency: 'ILS', isImmediate: false, notes: '',
}])

jest.mock('@/lib/parsers/csv-parser', () => ({ parseCSV: jest.fn().mockReturnValue([{}]) }))
jest.mock('@/lib/parsers/xlsx-parser', () => ({
  getSheetNames: jest.fn().mockReturnValue(['פירוט', 'קניות בחול']),
  parseSheet: jest.fn().mockReturnValue([{}]),
}))
jest.mock('@/lib/parsers/transaction-mapper', () => ({ mapRows: (...a: unknown[]) => mockMapRows(...a) }))
jest.mock('@/lib/categorization/engine', () => ({
  categorize: jest.fn().mockReturnValue({ categoryId: 'c1', source: 'rule' }),
}))

const defaultProps = {
  stepNumber: 1,
  accountName: 'אשראי בהצדעה',
  accountId: 'a1',
  categories: [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true }],
  rules: [],
  previousTransactions: [],
  initialTransactions: [],
  onComplete: jest.fn(),
  onSkip: jest.fn(),
}

function makeCSVFile() {
  const file = new File(['header\nrow'], 'test.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve('csv') })
  return file
}

function makeXLSXFile() {
  const file = new File([new ArrayBuffer(0)], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new ArrayBuffer(0)) })
  return file
}

beforeEach(() => jest.clearAllMocks())

describe('CreditImportStep', () => {
  it('renders the account name in the heading', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.getByText(/אשראי בהצדעה/)).toBeInTheDocument()
  })

  it('renders a file upload area', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.getByText(/העלאת קובץ/)).toBeInTheDocument()
  })

  it('renders the skip button', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.getByText('דלג')).toBeInTheDocument()
  })

  it('does not render Back button when onBack is not provided', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.queryByText('← חזור')).not.toBeInTheDocument()
  })

  it('renders Back button when onBack is provided', () => {
    render(<CreditImportStep {...defaultProps} onBack={jest.fn()} />)
    expect(screen.getByText('← חזור')).toBeInTheDocument()
  })

  it('shows preview table after CSV upload', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeCSVFile()] } })
    await waitFor(() => expect(screen.getByRole('table', { name: 'תצוגה מקדימה של עסקאות' })).toBeInTheDocument())
    expect(screen.getByText('שופרסל')).toBeInTheDocument()
  })

  it('shows sheet selector for XLSX files', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeXLSXFile()] } })
    await waitFor(() => expect(screen.getByText('פירוט')).toBeInTheDocument())
    expect(screen.getByText('קניות בחול')).toBeInTheDocument()
  })

  it('shows error for unsupported file type', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File([''], 'doc.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [badFile] } })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('calls onSkip when skip is clicked', () => {
    render(<CreditImportStep {...defaultProps} />)
    fireEvent.click(screen.getByText('דלג'))
    expect(defaultProps.onSkip).toHaveBeenCalled()
  })

  it('calls onComplete with transactions when Next is clicked', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeCSVFile()] } })
    await waitFor(() => screen.getByText('הבא →'))
    fireEvent.click(screen.getByText('הבא →'))
    expect(defaultProps.onComplete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ merchantName: 'שופרסל', categoryId: 'c1' })
    ]))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/components/import/steps/CreditImportStep.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module './CreditImportStep'"

- [ ] **Step 3: Write implementation**

```typescript
// src/components/import/steps/CreditImportStep.tsx
'use client'
import { useState, useRef } from 'react'
import { Upload, Tag } from 'lucide-react'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { getSheetNames, parseSheet } from '@/lib/parsers/xlsx-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { categorize } from '@/lib/categorization/engine'
import type { Category, CategorizationRule, ImportedTransaction, Transaction } from '@/lib/types'

interface Props {
  stepNumber: number
  accountName: string
  accountId: string
  categories: Category[]
  rules: CategorizationRule[]
  previousTransactions: Transaction[]
  initialTransactions: ImportedTransaction[]
  onComplete: (transactions: ImportedTransaction[]) => void
  onSkip: () => void
  onBack?: () => void
}

export function CreditImportStep({ stepNumber, accountName, categories, rules, previousTransactions, initialTransactions, onComplete, onSkip, onBack }: Props) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>(initialTransactions)
  const [xlsxData, setXlsxData] = useState<Uint8Array | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyCategories(raw: ReturnType<typeof mapRows>): ImportedTransaction[] {
    return raw.map(r => {
      const result = categorize(r.merchantName, rules, previousTransactions)
      return { ...r, categoryId: result.categoryId, categorizationSource: result.source }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        setTransactions(applyCategories(mapRows(parseCSV(text))))
        setXlsxData(null); setAvailableSheets([])
      } else if (file.name.endsWith('.xlsx')) {
        const buf = await file.arrayBuffer()
        const data = new Uint8Array(buf)
        const sheets = getSheetNames(data)
        setXlsxData(data); setAvailableSheets(sheets)
        setSelectedSheets(sheets.length > 0 ? [sheets[0]] : [])
        setTransactions([])
      } else {
        setError('פורמט לא נתמך. השתמש בקובץ CSV או XLSX.')
      }
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    }
  }

  function loadSheets() {
    if (!xlsxData || selectedSheets.length === 0) return
    const rows = selectedSheets.flatMap(s => parseSheet(xlsxData, s))
    setTransactions(applyCategories(mapRows(rows)))
  }

  function updateCategory(index: number, categoryId: string | null) {
    setTransactions(prev => prev.map((t, i) =>
      i === index ? { ...t, categoryId, categorizationSource: 'manual' } : t
    ))
  }

  const uncategorized = transactions.filter(t => !t.categoryId).length

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב {stepNumber} — {accountName}</h2>

      <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}>
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-slate-400 text-sm">העלאת קובץ CSV או XLSX</p>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />
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

      {transactions.length > 0 && (
        <>
          {uncategorized > 0 && (
            <p className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <Tag size={12} />{uncategorized} עסקאות ממתינות לקיטלוג
            </p>
          )}
          <div className="overflow-x-auto rounded-xl mb-4">
            <table className="w-full text-sm" role="table" aria-label="תצוגה מקדימה של עסקאות">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">בית עסק</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className={`border-b border-slate-700/40 ${!tx.categoryId ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{tx.date}</td>
                    <td className="py-1.5 px-2">
                      <span>{tx.merchantName}</span>
                      {tx.isImmediate && <span className="mr-1 text-xs bg-amber-900/50 text-amber-300 px-1 rounded">מיידי</span>}
                    </td>
                    <td className="py-1.5 px-2 text-left tabular-nums text-xs">{tx.amount.toFixed(2)} {tx.currency}</td>
                    <td className="py-1.5 px-2">
                      <select value={tx.categoryId ?? ''} onChange={e => updateCategory(i, e.target.value || null)}
                        className="bg-background text-foreground text-xs rounded px-1 py-0.5 w-full"
                        aria-label={`קטגוריה עבור ${tx.merchantName}`}>
                        <option value="">— ללא —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex gap-3 mt-4">
        {onBack && <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>}
        <button onClick={onSkip} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm text-slate-400">דלג</button>
        {transactions.length > 0 && (
          <button onClick={() => onComplete(transactions)} className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">הבא →</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/components/import/steps/CreditImportStep.test.tsx --no-coverage
```

Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/import/steps/CreditImportStep.tsx src/components/import/steps/CreditImportStep.test.tsx
git commit -m "feat: add CreditImportStep with file upload, XLSX sheet selector, and auto-categorization preview"
```

---

### Task 12: SalaryStep

**Files:**
- Create: `src/components/import/steps/SalaryStep.tsx`
- Test: `src/components/import/steps/SalaryStep.test.tsx`

Receives `initialSalary` (pre-filled from previous month by the wizard). Computes `netAmount` automatically as the user edits fields.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/import/steps/SalaryStep.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SalaryStep } from './SalaryStep'

const defaultProps = {
  month: '2026-06',
  initialSalary: null,
  onComplete: jest.fn(),
  onSkip: jest.fn(),
  onBack: jest.fn(),
}

describe('SalaryStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all salary form fields', () => {
    render(<SalaryStep {...defaultProps} />)
    expect(screen.getByLabelText('שם מעסיק')).toBeInTheDocument()
    expect(screen.getByLabelText('ברוטו')).toBeInTheDocument()
    expect(screen.getByLabelText('מס הכנסה')).toBeInTheDocument()
    expect(screen.getByLabelText('ביטוח לאומי')).toBeInTheDocument()
    expect(screen.getByLabelText('ביטוח בריאות')).toBeInTheDocument()
    expect(screen.getByLabelText('פנסיה')).toBeInTheDocument()
    expect(screen.getByLabelText('קרן השתלמות')).toBeInTheDocument()
  })

  it('shows zero netAmount initially', () => {
    render(<SalaryStep {...defaultProps} />)
    expect(screen.getByTestId('net-amount')).toHaveTextContent('0')
  })

  it('computes netAmount automatically when gross changes', () => {
    render(<SalaryStep {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('ברוטו'), { target: { value: '10000' } })
    expect(screen.getByTestId('net-amount')).toHaveTextContent('10,000')
  })

  it('subtracts deductions from gross', () => {
    render(<SalaryStep {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('ברוטו'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('מס הכנסה'), { target: { value: '2000' } })
    expect(screen.getByTestId('net-amount')).toHaveTextContent('8,000')
  })

  it('pre-fills fields from initialSalary', () => {
    const sal = { month: '2026-06', employerName: 'חברה בע"מ', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 100, pension: 1500, trainingFund: 750 }, netAmount: 10150 }
    render(<SalaryStep {...defaultProps} initialSalary={sal} />)
    expect(screen.getByDisplayValue('חברה בע"מ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('15000')).toBeInTheDocument()
  })

  it('calls onComplete with computed netAmount when Next clicked', () => {
    const onComplete = jest.fn()
    render(<SalaryStep {...defaultProps} onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText('שם מעסיק'), { target: { value: 'חברה' } })
    fireEvent.change(screen.getByLabelText('ברוטו'), { target: { value: '10000' } })
    fireEvent.click(screen.getByText('הבא →'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ grossAmount: 10000, netAmount: 10000, employerName: 'חברה' }))
  })

  it('calls onSkip when skip clicked', () => {
    const onSkip = jest.fn()
    render(<SalaryStep {...defaultProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('דלג'))
    expect(onSkip).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/components/import/steps/SalaryStep.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module './SalaryStep'"

- [ ] **Step 3: Write implementation**

```typescript
// src/components/import/steps/SalaryStep.tsx
'use client'
import { useState } from 'react'
import type { SalaryEntry, SalaryDeductions } from '@/lib/types'

const EMPTY_DEDUCTIONS: SalaryDeductions = { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }

const DEDUCTION_LABELS: [keyof SalaryDeductions, string][] = [
  ['incomeTax',           'מס הכנסה'],
  ['nationalInsurance',   'ביטוח לאומי'],
  ['healthInsurance',     'ביטוח בריאות'],
  ['pension',             'פנסיה'],
  ['trainingFund',        'קרן השתלמות'],
]

interface Props {
  month: string
  initialSalary: Omit<SalaryEntry, 'id'> | null
  onComplete: (salary: Omit<SalaryEntry, 'id'>) => void
  onSkip: () => void
  onBack: () => void
}

export function SalaryStep({ month, initialSalary, onComplete, onSkip, onBack }: Props) {
  const [employerName, setEmployerName] = useState(initialSalary?.employerName ?? '')
  const [grossAmount, setGrossAmount] = useState(initialSalary?.grossAmount ?? 0)
  const [deductions, setDeductions] = useState<SalaryDeductions>(initialSalary?.deductions ?? EMPTY_DEDUCTIONS)
  const [notes, setNotes] = useState(initialSalary?.notes ?? '')

  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)
  const netAmount = Math.max(0, grossAmount - totalDeductions)

  function updateDeduction(key: keyof SalaryDeductions, val: number) {
    setDeductions(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב 3 — משכורת</h2>

      <div className="space-y-3">
        <div>
          <label htmlFor="employer" className="block text-sm text-slate-400 mb-1">שם מעסיק</label>
          <input id="employer" aria-label="שם מעסיק" type="text" value={employerName}
            onChange={e => setEmployerName(e.target.value)}
            className="w-full bg-surface rounded-lg px-3 py-2" />
        </div>
        <div>
          <label htmlFor="gross" className="block text-sm text-slate-400 mb-1">ברוטו</label>
          <input id="gross" aria-label="ברוטו" type="number" value={grossAmount || ''}
            onChange={e => setGrossAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-surface rounded-lg px-3 py-2 tabular-nums" />
        </div>

        <div className="bg-surface rounded-xl p-4 space-y-2">
          <p className="text-sm text-slate-400 font-medium mb-1">ניכויים</p>
          {DEDUCTION_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <label htmlFor={key} className="flex-1 text-sm">{label}</label>
              <input id={key} aria-label={label} type="number" value={deductions[key] || ''}
                onChange={e => updateDeduction(key, parseFloat(e.target.value) || 0)}
                className="w-28 bg-background rounded px-2 py-1 text-left tabular-nums text-sm" />
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center bg-accent/10 rounded-xl px-4 py-3">
          <span className="font-semibold text-sm">נטו</span>
          <span data-testid="net-amount" className="font-bold text-lg tabular-nums">
            {netAmount.toLocaleString('he-IL')} ₪
          </span>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm text-slate-400 mb-1">הערות</label>
          <input id="notes" aria-label="הערות" type="text" value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-surface rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>
        <button onClick={onSkip} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm text-slate-400">דלג</button>
        <button onClick={() => onComplete({ month, employerName, grossAmount, deductions, netAmount, notes: notes || undefined })}
          className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">הבא →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/components/import/steps/SalaryStep.test.tsx --no-coverage
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/import/steps/SalaryStep.tsx src/components/import/steps/SalaryStep.test.tsx
git commit -m "feat: add SalaryStep with auto-computed net amount"
```

---

### Task 13: IncomeStep

**Files:**
- Create: `src/components/import/steps/IncomeStep.tsx`
- Test: `src/components/import/steps/IncomeStep.test.tsx`

Dynamic list of additional income entries. User adds/removes rows; each row has sourceName, amount, and date.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/import/steps/IncomeStep.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { IncomeStep } from './IncomeStep'

const defaultProps = { month: '2026-06', initialEntries: [], onComplete: jest.fn(), onBack: jest.fn() }

describe('IncomeStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows empty state message when no entries', () => {
    render(<IncomeStep {...defaultProps} />)
    expect(screen.getByText(/אין הכנסות נוספות/)).toBeInTheDocument()
  })

  it('renders Add button', () => {
    render(<IncomeStep {...defaultProps} />)
    expect(screen.getByText('הוסף הכנסה')).toBeInTheDocument()
  })

  it('adds a row when Add button clicked', () => {
    render(<IncomeStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הכנסה'))
    expect(screen.getByLabelText('שם מקור הכנסה 1')).toBeInTheDocument()
  })

  it('removes a row when delete button clicked', () => {
    render(<IncomeStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הכנסה'))
    expect(screen.getByLabelText('שם מקור הכנסה 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'מחק הכנסה 1' }))
    expect(screen.queryByLabelText('שם מקור הכנסה 1')).not.toBeInTheDocument()
  })

  it('calls onComplete with entries when Next clicked', () => {
    const onComplete = jest.fn()
    render(<IncomeStep {...defaultProps} onComplete={onComplete} />)
    fireEvent.click(screen.getByText('הוסף הכנסה'))
    fireEvent.change(screen.getByLabelText('שם מקור הכנסה 1'), { target: { value: 'מילואים' } })
    fireEvent.change(screen.getByLabelText('סכום הכנסה 1'), { target: { value: '3000' } })
    fireEvent.click(screen.getByText('הבא →'))
    expect(onComplete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ sourceName: 'מילואים', amount: 3000 })
    ]))
  })

  it('calls onBack when Back clicked', () => {
    const onBack = jest.fn()
    render(<IncomeStep {...defaultProps} onBack={onBack} />)
    fireEvent.click(screen.getByText('← חזור'))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/components/import/steps/IncomeStep.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module './IncomeStep'"

- [ ] **Step 3: Write implementation**

```typescript
// src/components/import/steps/IncomeStep.tsx
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { IncomeEntry } from '@/lib/types'

type IncomeRow = Omit<IncomeEntry, 'id'>

interface Props {
  month: string
  initialEntries: IncomeRow[]
  onComplete: (entries: IncomeRow[]) => void
  onBack: () => void
}

function emptyRow(month: string): IncomeRow {
  return { month, sourceName: '', amount: 0, currency: 'ILS', date: new Date().toISOString().split('T')[0] }
}

export function IncomeStep({ month, initialEntries, onComplete, onBack }: Props) {
  const [entries, setEntries] = useState<IncomeRow[]>(initialEntries)

  function addEntry() { setEntries(p => [...p, emptyRow(month)]) }

  function update(i: number, updates: Partial<IncomeRow>) {
    setEntries(p => p.map((e, idx) => idx === i ? { ...e, ...updates } : e))
  }

  function remove(i: number) { setEntries(p => p.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב 4 — הכנסות נוספות</h2>

      {entries.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-6">אין הכנסות נוספות החודש</p>
      )}

      <div className="space-y-3 mb-4">
        {entries.map((entry, i) => (
          <div key={i} className="bg-surface rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">הכנסה {i + 1}</span>
              <button onClick={() => remove(i)} aria-label={`מחק הכנסה ${i + 1}`} className="text-red-400 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input type="text" placeholder="שם מקור (מילואים, בונוס, ...)" value={entry.sourceName}
                onChange={e => update(i, { sourceName: e.target.value })}
                aria-label={`שם מקור הכנסה ${i + 1}`}
                className="w-full bg-background rounded px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <input type="number" placeholder="סכום" value={entry.amount || ''}
                  onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
                  aria-label={`סכום הכנסה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums" />
                <input type="date" value={entry.date}
                  onChange={e => update(i, { date: e.target.value })}
                  aria-label={`תאריך הכנסה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addEntry}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הכנסה
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>
        <button onClick={() => onComplete(entries)} className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">הבא →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/components/import/steps/IncomeStep.test.tsx --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/import/steps/IncomeStep.tsx src/components/import/steps/IncomeStep.test.tsx
git commit -m "feat: add IncomeStep with dynamic income entry list"
```

---

### Task 14: CashStep + SummaryStep + wire up import page

**Files:**
- Create: `src/components/import/steps/CashStep.tsx`
- Create: `src/components/import/steps/CashStep.test.tsx`
- Create: `src/components/import/steps/SummaryStep.tsx`
- Create: `src/components/import/steps/SummaryStep.test.tsx`
- Modify: `src/app/(app)/import/page.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/import/steps/CashStep.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CashStep } from './CashStep'

const cats = [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true }]
const defaultProps = { month: '2026-06', categories: cats, initialExpenses: [], onComplete: jest.fn(), onBack: jest.fn() }

describe('CashStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders empty state', () => {
    render(<CashStep {...defaultProps} />)
    expect(screen.getByText(/אין הוצאות מזומן/)).toBeInTheDocument()
  })

  it('adds an expense row when Add button clicked', () => {
    render(<CashStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הוצאה'))
    expect(screen.getByLabelText('תיאור הוצאה 1')).toBeInTheDocument()
  })

  it('removes an expense when delete clicked', () => {
    render(<CashStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הוצאה'))
    fireEvent.click(screen.getByRole('button', { name: 'מחק הוצאה 1' }))
    expect(screen.queryByLabelText('תיאור הוצאה 1')).not.toBeInTheDocument()
  })

  it('calls onComplete with expenses when Next clicked', () => {
    const onComplete = jest.fn()
    render(<CashStep {...defaultProps} onComplete={onComplete} />)
    fireEvent.click(screen.getByText('הוסף הוצאה'))
    fireEvent.change(screen.getByLabelText('תיאור הוצאה 1'), { target: { value: 'ירקות' } })
    fireEvent.change(screen.getByLabelText('סכום הוצאה 1'), { target: { value: '50' } })
    fireEvent.click(screen.getByText('סיכום →'))
    expect(onComplete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ description: 'ירקות', amount: 50 })
    ]))
  })
})
```

```typescript
// src/components/import/steps/SummaryStep.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SummaryStep } from './SummaryStep'

jest.mock('@/lib/firestore/transactions', () => ({ addTransactions: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/firestore/salary', () => ({ upsertSalaryEntry: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/firestore/income', () => ({ addIncomeEntry: jest.fn().mockResolvedValue({ id: 'i1' }) }))

const mockImportedTx = { date: '2026-06-01', merchantName: 'שופרסל', bankCategory: '', amount: 150, currency: 'ILS', isImmediate: false, notes: '', categoryId: 'c1', categorizationSource: 'rule' as const }

const baseProps = {
  month: '2026-06',
  data: { step1Transactions: [mockImportedTx], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [] },
  hatzlaadaAccountId: 'a1',
  oneZeroAccountId: 'a2',
  cashAccountId: 'a5',
  onDone: jest.fn(),
}

describe('SummaryStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('displays summary rows for each import category', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('עסקאות אשראי בהצדעה')).toBeInTheDocument()
    expect(screen.getByText('עסקאות אשראי One Zero')).toBeInTheDocument()
    expect(screen.getByText('הכנסות נוספות')).toBeInTheDocument()
    expect(screen.getByText('הוצאות מזומן')).toBeInTheDocument()
  })

  it('shows the Save button', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('שמור הכל')).toBeInTheDocument()
  })

  it('calls addTransactions when saved', async () => {
    const { addTransactions } = require('@/lib/firestore/transactions')
    render(<SummaryStep {...baseProps} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => expect(addTransactions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ merchantName: 'שופרסל', accountId: 'a1' })])
    ))
  })

  it('shows success screen after saving', async () => {
    render(<SummaryStep {...baseProps} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => expect(screen.getByText('הנתונים נשמרו בהצלחה!')).toBeInTheDocument())
  })

  it('calls onDone after success when button clicked', async () => {
    const onDone = jest.fn()
    render(<SummaryStep {...baseProps} onDone={onDone} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => screen.getByText('חזור לייבוא'))
    fireEvent.click(screen.getByText('חזור לייבוא'))
    expect(onDone).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/components/import/steps/CashStep.test.tsx src/components/import/steps/SummaryStep.test.tsx --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write CashStep**

```typescript
// src/components/import/steps/CashStep.tsx
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Category } from '@/lib/types'
import type { CashExpense } from '../ImportWizard'

interface Props {
  month: string
  categories: Category[]
  initialExpenses: CashExpense[]
  onComplete: (expenses: CashExpense[]) => void
  onBack: () => void
}

function emptyExpense(): CashExpense {
  return { description: '', amount: 0, date: new Date().toISOString().split('T')[0], categoryId: null }
}

export function CashStep({ categories, initialExpenses, onComplete, onBack }: Props) {
  const [expenses, setExpenses] = useState<CashExpense[]>(initialExpenses)

  function add() { setExpenses(p => [...p, emptyExpense()]) }

  function update(i: number, u: Partial<CashExpense>) {
    setExpenses(p => p.map((e, idx) => idx === i ? { ...e, ...u } : e))
  }

  function remove(i: number) { setExpenses(p => p.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב 5 — מזומן</h2>

      {expenses.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-6">אין הוצאות מזומן</p>
      )}

      <div className="space-y-3 mb-4">
        {expenses.map((exp, i) => (
          <div key={i} className="bg-surface rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">הוצאה {i + 1}</span>
              <button onClick={() => remove(i)} aria-label={`מחק הוצאה ${i + 1}`} className="text-red-400 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input type="text" placeholder="תיאור" value={exp.description}
                onChange={e => update(i, { description: e.target.value })}
                aria-label={`תיאור הוצאה ${i + 1}`}
                className="w-full bg-background rounded px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <input type="number" placeholder="סכום" value={exp.amount || ''}
                  onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
                  aria-label={`סכום הוצאה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums" />
                <input type="date" value={exp.date}
                  onChange={e => update(i, { date: e.target.value })}
                  aria-label={`תאריך הוצאה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm" />
              </div>
              <select value={exp.categoryId ?? ''} onChange={e => update(i, { categoryId: e.target.value || null })}
                aria-label={`קטגוריה הוצאה ${i + 1}`}
                className="w-full bg-background rounded px-3 py-2 text-sm">
                <option value="">— ללא קטגוריה —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      <button onClick={add}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הוצאה
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>
        <button onClick={() => onComplete(expenses)} className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">סיכום →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write SummaryStep**

```typescript
// src/components/import/steps/SummaryStep.tsx
'use client'
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { addTransactions } from '@/lib/firestore/transactions'
import { upsertSalaryEntry } from '@/lib/firestore/salary'
import { addIncomeEntry } from '@/lib/firestore/income'
import type { ImportedTransaction, SalaryEntry, IncomeEntry, Transaction, TransactionSource } from '@/lib/types'
import type { CashExpense } from '../ImportWizard'

interface WizardData {
  step1Transactions: ImportedTransaction[]
  step2Transactions: ImportedTransaction[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}

interface Props {
  month: string
  data: WizardData
  hatzlaadaAccountId: string
  oneZeroAccountId: string
  cashAccountId: string
  onDone: () => void
}

function toTx(t: ImportedTransaction, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  return {
    date: t.date, merchantName: t.merchantName, description: t.notes || undefined,
    amount: t.amount, currency: t.currency, accountId,
    categoryId: t.categoryId ?? undefined, source, isImmediate: t.isImmediate, month,
  }
}

export function SummaryStep({ month, data, hatzlaadaAccountId, oneZeroAccountId, cashAccountId, onDone }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const allTxs: Omit<Transaction, 'id'>[] = [
        ...data.step1Transactions.map(t => toTx(t, hatzlaadaAccountId, month, 'xlsx_import')),
        ...data.step2Transactions.map(t => toTx(t, oneZeroAccountId, month, 'xlsx_import')),
        ...data.cashExpenses.map(e => ({
          date: e.date, merchantName: e.description, amount: e.amount, currency: 'ILS',
          accountId: cashAccountId, categoryId: e.categoryId ?? undefined,
          source: 'manual' as TransactionSource, isImmediate: true, month,
        })),
      ]
      await addTransactions(allTxs)
      if (data.salary) await upsertSalaryEntry(data.salary)
      for (const entry of data.incomeEntries) await addIncomeEntry(entry)
      setSaved(true)
    } catch {
      setError('שגיאה בשמירת הנתונים. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">הנתונים נשמרו בהצלחה!</h2>
        <p className="text-slate-400 text-sm mb-6">
          {data.step1Transactions.length + data.step2Transactions.length + data.cashExpenses.length} עסקאות יובאו
        </p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לייבוא</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">סיכום — מה ייובא?</h2>
      <div className="space-y-2 mb-6">
        {[
          ['עסקאות אשראי בהצדעה',  data.step1Transactions.length],
          ['עסקאות אשראי One Zero', data.step2Transactions.length],
          ['הכנסות נוספות',         data.incomeEntries.length],
          ['הוצאות מזומן',          data.cashExpenses.length],
        ].map(([label, count]) => (
          <div key={label as string} className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">{label}</span>
            <span className="text-sm text-slate-400">{count} פריטים</span>
          </div>
        ))}
        {data.salary && (
          <div className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">משכורת</span>
            <span className="text-sm tabular-nums">{data.salary.netAmount.toLocaleString('he-IL')} ₪ נטו</span>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50">
        {saving ? 'שומר...' : 'שמור הכל'}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Update import page**

Replace the content of `src/app/(app)/import/page.tsx` with:

```typescript
// src/app/(app)/import/page.tsx
import { ImportWizard } from '@/components/import/ImportWizard'

export default function ImportPage() {
  return <ImportWizard />
}
```

- [ ] **Step 6: Run all tests to verify they pass**

```bash
npx jest src/components/import/steps/CashStep.test.tsx src/components/import/steps/SummaryStep.test.tsx --no-coverage
```

Expected: PASS (9 tests total)

- [ ] **Step 7: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass (existing 20 + ~50 new ≈ 70 tests total)

- [ ] **Step 8: Commit**

```bash
git add src/components/import/steps/CashStep.tsx src/components/import/steps/CashStep.test.tsx src/components/import/steps/SummaryStep.tsx src/components/import/steps/SummaryStep.test.tsx src/app/(app)/import/page.tsx
git commit -m "feat: add CashStep, SummaryStep, and wire up import page — Plan 2 complete"
```

---

## Self-Review

### 1. Spec Coverage Check

| Spec requirement | Task |
|---|---|
| CSV import (.csv) | Task 2, 4, 11 |
| XLSX import (.xlsx) with sheet selection | Task 3, 4, 11 |
| שלב 1 — אשראי בהצדעה | Task 10, 11 |
| שלב 2 — אשראי One Zero | Task 10, 11 |
| Auto-categorization: keyword rules | Task 5, 11 |
| Auto-categorization: history fallback | Task 5, 11 |
| Uncategorized rows highlighted blue | Task 11 |
| חיוב מיידי detection + "מיידי" badge | Task 4, 11 |
| User can edit category inline | Task 11 |
| שלב 3 — משכורת with editable deductions | Task 12 |
| Pre-fill salary from previous month | Task 10, 12 |
| שלב 4 — הכנסות נוספות, dynamic list | Task 13 |
| שלב 5 — מזומן | Task 14 |
| Save all to Firestore on confirm | Task 14 |
| Files NOT stored — only parsed data | Task 11 (file used in memory only) |
| Default accounts seeded | Task 6 |
| Default categories seeded | Task 6 |
| Month selector | Task 10 |

### 2. No Placeholders ✓
All steps include complete code.

### 3. Type Consistency ✓
- `ParsedRow` defined in Task 2, used in Tasks 3, 4
- `RawTransaction` defined in Task 4 (types/index.ts), used in Task 5 engine, Task 11
- `ImportedTransaction` defined in Task 4, used in Tasks 10, 11, 14
- `CashExpense` defined in Task 10 (ImportWizard.tsx), imported by Tasks 14
- All Firestore service return types match `Transaction`, `SalaryEntry`, `IncomeEntry` from types/index.ts

