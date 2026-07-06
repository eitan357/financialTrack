import { describe, it, expect } from 'vitest'
import { sortDeckCards, computeTotals, computeDisplayTotals } from './deckUtils'
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

describe('computeDisplayTotals', () => {
  it('includes pending cards in totals', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', direction: 'expense', amount: 100 },
      { ...base, _id: '2', status: 'approved', direction: 'expense', amount: 50 },
    ]
    const totals = computeDisplayTotals(cards)
    expect(totals.expenses).toBe(150)
  })

  it('excludes status=skipped cards', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', direction: 'expense', amount: 100 },
      { ...base, _id: '2', status: 'skipped', direction: 'expense', amount: 200 },
    ]
    const totals = computeDisplayTotals(cards)
    expect(totals.expenses).toBe(100)
  })

  it('excludes pre-skipped cards (skip=true)', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', skip: false, direction: 'expense', amount: 100 },
      { ...base, _id: '2', status: 'pending', skip: true, direction: 'expense', amount: 500 },
    ]
    const totals = computeDisplayTotals(cards)
    expect(totals.expenses).toBe(100)
  })

  it('reflects direction changes on pending cards immediately', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'pending', direction: 'income', amount: 300 },
    ]
    const totals = computeDisplayTotals(cards)
    expect(totals.income).toBe(300)
    expect(totals.expenses).toBe(0)
  })

  it('returns zeros when all cards are skipped', () => {
    const cards: DeckCard[] = [
      { ...base, _id: '1', status: 'skipped', direction: 'expense', amount: 100 },
      { ...base, _id: '2', status: 'pending', skip: true, direction: 'expense', amount: 200 },
    ]
    const totals = computeDisplayTotals(cards)
    expect(totals).toEqual({ income: 0, expenses: 0, net: 0 })
  })
})
