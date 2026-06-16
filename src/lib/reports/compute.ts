import type { Transaction, Category } from '@/lib/types'

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  total: number
}

export interface MonthlyExpenseSummary {
  month: string
  totalExpenses: number
  byCategory: CategoryTotal[]
}

export function computeMonthlyReports(
  transactions: Transaction[],
  months: string[],
  categories: Category[]
): MonthlyExpenseSummary[] {
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))

  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map(month => {
      const monthTxs = transactions.filter(t => t.month === month)
      const totalExpenses = monthTxs.reduce((s, t) => s + t.amount, 0)

      const totals: Record<string, number> = {}
      for (const tx of monthTxs) {
        if (tx.categoryId) {
          totals[tx.categoryId] = (totals[tx.categoryId] ?? 0) + tx.amount
        }
      }

      const byCategory: CategoryTotal[] = Object.entries(totals)
        .map(([categoryId, total]) => {
          const cat = categoryMap[categoryId]
          return { categoryId, name: cat?.name ?? categoryId, color: cat?.color ?? '#64748b', total }
        })
        .sort((a, b) => b.total - a.total)

      return { month, totalExpenses, byCategory }
    })
}
