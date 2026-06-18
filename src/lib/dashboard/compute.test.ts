import { computeDashboard } from './compute'
import type { DashboardInput } from './compute'

function emptyInput(): DashboardInput {
  return {
    transactions: [],
    salaryEntry: null,
    dividends: [],
    investmentEntries: [],
    categories: [],
    monthlySettings: null,
  }
}

describe('computeDashboard', () => {
  it('returns zeros for empty input', () => {
    const result = computeDashboard(emptyInput())
    expect(result.totalIncome).toBe(0)
    expect(result.totalExpenses).toBe(0)
    expect(result.totalSavings).toBe(0)
    expect(result.totalInvestments).toBe(0)
    expect(result.categoryTotals).toEqual([])
    expect(result.uncategorizedTotal).toBe(0)
  })

  it('computes totalIncome from salary net + non-salary income transactions + dividends', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      salaryEntry: { id: 's1', month: '2026-06', employerName: 'חברה', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 100, pension: 1500, trainingFund: 750 }, netAmount: 10150 },
      transactions: [
        { id: 't1', date: '2026-06-15', merchantName: 'מילואים', amount: 3000, currency: 'ILS', accountId: 'a1', source: 'manual', isImmediate: false, month: '2026-06', direction: 'income' },
      ],
      dividends: [
        { id: 'd1', month: '2026-06', investmentTypeId: 'msty', amount: 100, currency: 'USD', ilsEquivalent: 370, date: '2026-06-01' },
      ],
    }
    expect(computeDashboard(input).totalIncome).toBe(10150 + 3000 + 370)
  })

  it('counts dividends without ilsEquivalent as zero income', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      dividends: [{ id: 'd1', month: '2026-06', investmentTypeId: 'msty', amount: 100, currency: 'USD', date: '2026-06-01' }],
    }
    expect(computeDashboard(input).totalIncome).toBe(0)
  })

  it('computes totalExpenses as sum of all transactions', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
        { id: 't2', date: '2026-06-02', merchantName: 'YES', amount: 350, currency: 'ILS', accountId: 'a1', categoryId: 'c2', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    expect(computeDashboard(input).totalExpenses).toBe(550)
  })

  it('computes totalSavings as income minus expenses', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      salaryEntry: { id: 's1', month: '2026-06', employerName: 'חברה', grossAmount: 10000, deductions: { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }, netAmount: 10000 },
      transactions: [{ id: 't1', date: '2026-06-01', merchantName: 'test', amount: 3000, currency: 'ILS', accountId: 'a1', source: 'xlsx_import', isImmediate: false, month: '2026-06' }],
    }
    expect(computeDashboard(input).totalSavings).toBe(7000)
  })

  it('computes totalInvestments as sum of investment entries', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      investmentEntries: [
        { id: 'e1', date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 5000, currency: 'ILS' },
        { id: 'e2', date: '2026-06-15', month: '2026-06', investmentTypeId: 't1', amount: 2000, currency: 'ILS' },
      ],
    }
    expect(computeDashboard(input).totalInvestments).toBe(7000)
  })

  it('sums transactions per category', () => {
    const cats = [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true, monthlyTarget: 2000 }]
    const input: DashboardInput = {
      ...emptyInput(),
      categories: cats,
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
        { id: 't2', date: '2026-06-02', merchantName: 'רמי לוי', amount: 150, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    const result = computeDashboard(input)
    expect(result.categoryTotals[0]).toEqual({ id: 'c1', name: 'אוכל', color: '#ef4444', actual: 350, target: 2000 })
  })

  it('uses monthlySettings target over category default', () => {
    const cats = [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true, monthlyTarget: 2000 }]
    const input: DashboardInput = {
      ...emptyInput(),
      categories: cats,
      monthlySettings: { id: 'ms1', month: '2026-06', categoryTargets: { c1: 1800 } },
      transactions: [{ id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 100, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' }],
    }
    const result = computeDashboard(input)
    expect(result.categoryTotals[0].target).toBe(1800)
  })

  it('tracks uncategorized transactions separately', () => {
    const input: DashboardInput = {
      ...emptyInput(),
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'חנות', amount: 99, currency: 'ILS', accountId: 'a1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    expect(computeDashboard(input).uncategorizedTotal).toBe(99)
  })

  it('excludes categories with no actual and no target from results', () => {
    const cats = [
      { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
      { id: 'c2', name: 'חשבונות', color: '#f97316', isActive: true, monthlyTarget: 500 },
    ]
    const input: DashboardInput = { ...emptyInput(), categories: cats }
    const result = computeDashboard(input)
    expect(result.categoryTotals).toHaveLength(1)
    expect(result.categoryTotals[0].id).toBe('c2')
  })

  it('sorts categories by actual amount descending', () => {
    const cats = [
      { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
      { id: 'c2', name: 'חשבונות', color: '#f97316', isActive: true },
    ]
    const input: DashboardInput = {
      ...emptyInput(),
      categories: cats,
      transactions: [
        { id: 't1', date: '2026-06-01', merchantName: 'שופרסל', amount: 100, currency: 'ILS', accountId: 'a1', categoryId: 'c1', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
        { id: 't2', date: '2026-06-02', merchantName: 'YES', amount: 500, currency: 'ILS', accountId: 'a1', categoryId: 'c2', source: 'xlsx_import', isImmediate: false, month: '2026-06' },
      ],
    }
    const result = computeDashboard(input)
    expect(result.categoryTotals[0].id).toBe('c2')
    expect(result.categoryTotals[1].id).toBe('c1')
  })
})
