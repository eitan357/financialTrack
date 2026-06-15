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
    const r = rule({ matchType: 'startsWith', keyword: 'פארמ' })
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
