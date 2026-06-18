import { detectDuplicates } from './duplicate-detector'
import type { ImportedTransaction, Transaction } from '@/lib/types'

function makeImported(overrides: Partial<ImportedTransaction> = {}): ImportedTransaction {
  return {
    date: '2026-06-05',
    merchantName: 'SuperMarket',
    bankCategory: '',
    amount: 100,
    currency: 'ILS',
    isImmediate: false,
    notes: '',
    direction: 'expense',
    categoryId: null,
    categorizationSource: null,
    ...overrides,
  }
}

function makeExisting(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    date: '2026-06-05',
    merchantName: 'SuperMarket',
    amount: 100,
    currency: 'ILS',
    accountId: 'acc-1',
    source: 'xlsx_import',
    isImmediate: false,
    month: '2026-06',
    ...overrides,
  }
}

describe('detectDuplicates', () => {
  it('flags matching date + amount + merchantName as duplicate', () => {
    const incoming = [makeImported()]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(duplicates).toHaveLength(1)
    expect(clean).toHaveLength(0)
  })

  it('allows different date', () => {
    const incoming = [makeImported({ date: '2026-06-10' })]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(duplicates).toHaveLength(0)
    expect(clean).toHaveLength(1)
  })

  it('allows different amount', () => {
    const incoming = [makeImported({ amount: 200 })]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(clean).toHaveLength(1)
  })

  it('allows different merchantName', () => {
    const incoming = [makeImported({ merchantName: 'OtherStore' })]
    const existing = [makeExisting()]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(clean).toHaveLength(1)
  })

  it('handles mix of duplicates and clean', () => {
    const incoming = [
      makeImported({ merchantName: 'Dup', date: '2026-06-01', amount: 50 }),
      makeImported({ merchantName: 'New', date: '2026-06-02', amount: 75 }),
    ]
    const existing = [makeExisting({ merchantName: 'Dup', date: '2026-06-01', amount: 50 })]
    const { duplicates, clean } = detectDuplicates(incoming, existing)
    expect(duplicates).toHaveLength(1)
    expect(clean).toHaveLength(1)
    expect(clean[0].merchantName).toBe('New')
  })
})
