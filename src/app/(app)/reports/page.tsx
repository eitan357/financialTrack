'use client'
import { useState, useEffect } from 'react'
import { getTransactionsForMonths } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { computeMonthlyReports } from '@/lib/reports/compute'
import { MonthSummaryRow } from '@/components/reports/MonthSummaryRow'
import type { Category } from '@/lib/types'
import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

function lastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [summaries, setSummaries] = useState<MonthlyExpenseSummary[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    setLoading(true)
    const months = lastNMonths(6)
    async function load() {
      try {
        const [txs, cats] = await Promise.all([
          getTransactionsForMonths(months),
          getCategories(),
        ])
        setCategories(cats)
        setSummaries(computeMonthlyReports(txs, months, cats))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalAllMonths = summaries.reduce((s, m) => s + m.totalExpenses, 0)
  const avgMonthly = summaries.length > 0 ? Math.round(totalAllMonths / summaries.length) : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <h1 className="text-lg font-bold mb-4">דוחות</h1>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">ממוצע חודשי</p>
              <p className="text-xl font-bold tabular-nums">₪{avgMonthly.toLocaleString('he-IL')}</p>
            </div>
            <div className="bg-surface rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">סה&quot;כ 6 חודשים</p>
              <p className="text-xl font-bold tabular-nums">₪{totalAllMonths.toLocaleString('he-IL')}</p>
            </div>
          </div>

          <div className="bg-surface rounded-2xl px-4">
            <div className="flex gap-3 py-2 border-b border-slate-700 text-xs text-slate-400">
              <span className="w-24">חודש</span>
              <span className="w-24">הוצאות</span>
              <span className="flex-1">קטגוריות מובילות</span>
            </div>
            {summaries.map(s => (
              <MonthSummaryRow key={s.month} summary={s} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
