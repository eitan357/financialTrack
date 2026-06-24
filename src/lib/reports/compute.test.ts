import { computeMonthlyReports } from './compute'
import type { Transaction, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
  { id: 'c2', name: 'תחבורה', color: '#3b82f6', isActive: true },
]

const txs: Transaction[] = [
  { id: 'a', date: '2026-06-01', merchantName: 'שופרסל', amount: 300, currency: 'ILS', accountId: 'x', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
  { id: 'b', date: '2026-06-05', merchantName: 'גט', amount: 100, currency: 'ILS', accountId: 'x', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c2' },
  { id: 'c', date: '2026-05-10', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'x', source: 'csv_import', isImmediate: false, month: '2026-05', categoryId: 'c1' },
]

describe('computeMonthlyReports', () => {
  it('returns one entry per requested month', () => {
    const result = computeMonthlyReports(txs, ['2026-06', '2026-05'], cats)
    expect(result).toHaveLength(2)
  })

  it('returns months in descending order (most recent first)', () => {
    const result = computeMonthlyReports(txs, ['2026-05', '2026-06'], cats)
    expect(result[0].month).toBe('2026-06')
    expect(result[1].month).toBe('2026-05')
  })

  it('computes correct total expenses per month', () => {
    const result = computeMonthlyReports(txs, ['2026-06', '2026-05'], cats)
    expect(result.find(r => r.month === '2026-06')?.totalExpenses).toBe(400)
    expect(result.find(r => r.month === '2026-05')?.totalExpenses).toBe(200)
  })

  it('computes category totals sorted by amount desc', () => {
    const result = computeMonthlyReports(txs, ['2026-06'], cats)
    const june = result[0]
    expect(june.byCategory[0].categoryId).toBe('c1')
    expect(june.byCategory[0].total).toBe(300)
    expect(june.byCategory[0].name).toBe('אוכל')
  })

  it('returns zero total for months with no transactions', () => {
    const result = computeMonthlyReports(txs, ['2026-04'], cats)
    expect(result[0].totalExpenses).toBe(0)
    expect(result[0].byCategory).toHaveLength(0)
  })

  it('excludes income transactions from totalExpenses and byCategory', () => {
    const txsWithIncome: Transaction[] = [
      ...txs,
      {
        id: 'inc',
        date: '2026-06-10',
        merchantName: 'משכורת',
        amount: 5000,
        currency: 'ILS',
        accountId: 'y',
        source: 'manual' as const,
        isImmediate: true,
        month: '2026-06',
        direction: 'income' as const,
      },
    ]
    const result = computeMonthlyReports(txsWithIncome, ['2026-06'], cats)
    // income transaction (5000) must NOT be added to expenses (400)
    expect(result[0].totalExpenses).toBe(400)
    // byCategory must still be same length as without income
    expect(result[0].byCategory).toHaveLength(2)
  })
})
