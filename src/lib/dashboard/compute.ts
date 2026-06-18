import type { Transaction, SalaryEntry, Dividend, InvestmentEntry, Category, MonthlySettings } from '../types'

export interface CategorySummary {
  id: string
  name: string
  color: string
  actual: number
  target: number | null
}

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  totalInvestments: number
  categoryTotals: CategorySummary[]
  uncategorizedTotal: number
}

export interface DashboardInput {
  transactions: Transaction[]
  salaryEntry: SalaryEntry | null
  dividends: Dividend[]
  investmentEntries: InvestmentEntry[]
  categories: Category[]
  monthlySettings: MonthlySettings | null
}

export function computeDashboard(input: DashboardInput): DashboardSummary {
  const { transactions, salaryEntry, dividends, investmentEntries, categories, monthlySettings } = input

  const salaryNet = salaryEntry?.netAmount ?? 0
  const dividendTotal = dividends.reduce((s, d) => s + (d.ilsEquivalent ?? 0), 0)
  // Exclude salary transactions — already counted via salaryEntry.netAmount
  const txIncomeTotal = transactions
    .filter(t => t.direction === 'income' && !t.salaryDetails)
    .reduce((s, t) => s + t.amount, 0)
  const totalIncome = salaryNet + dividendTotal + txIncomeTotal

  const totalExpenses = transactions.filter(t => t.direction !== 'income').reduce((s, t) => s + t.amount, 0)
  const totalSavings = totalIncome - totalExpenses
  const totalInvestments = investmentEntries.reduce((s, e) => s + e.amount, 0)

  const amountByCategory: Record<string, number> = {}
  let uncategorizedTotal = 0
  for (const tx of transactions) {
    if (tx.direction === 'income') continue
    if (tx.categoryId) {
      amountByCategory[tx.categoryId] = (amountByCategory[tx.categoryId] ?? 0) + tx.amount
    } else {
      uncategorizedTotal += tx.amount
    }
  }

  // All categories — isActive only controls the picker, not historical display.
  // A hidden category still shows in the breakdown if it has actual spending.
  const categoryTotals: CategorySummary[] = categories
    .map(c => {
      const target = monthlySettings?.categoryTargets[c.id] ?? c.monthlyTarget ?? null
      return { id: c.id, name: c.name, color: c.color, actual: amountByCategory[c.id] ?? 0, target }
    })
    .filter(c => c.actual > 0 || c.target !== null)
    .sort((a, b) => b.actual - a.actual)

  return { totalIncome, totalExpenses, totalSavings, totalInvestments, categoryTotals, uncategorizedTotal }
}
