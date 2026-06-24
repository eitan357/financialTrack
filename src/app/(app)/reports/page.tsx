'use client'
import { useState, useEffect } from 'react'
import { getTransactionsForMonths } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { computeMonthlyReports } from '@/lib/reports/compute'
import { MonthSummaryRow } from '@/components/reports/MonthSummaryRow'
import type { Category } from '@/lib/types'
import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, '0')}`
  )
}

export default function ReportsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [summaries, setSummaries] = useState<MonthlyExpenseSummary[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const months = monthsOfYear(year)
    async function load() {
      try {
        const [txs, cats, accs] = await Promise.all([
          getTransactionsForMonths(months),
          getCategories(),
          getAccounts(),
        ])
        setCategories(cats)
        const creditIds = new Set(accs.filter(a => a.type === 'credit').map(a => a.id))
        const txsForCompute = txs.filter(t => !(t.isImmediate && creditIds.has(t.accountId)))
        setSummaries(computeMonthlyReports(txsForCompute, months, cats))
      } catch (e) {
        setError('שגיאה בטעינת הדוחות. בדוק את חיבור הרשת.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year])

  const monthsWithData = summaries.filter(s => s.totalExpenses > 0)
  const totalYear = summaries.reduce((s, m) => s + m.totalExpenses, 0)
  const avgMonthly = monthsWithData.length > 0 ? Math.round(totalYear / monthsWithData.length) : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setYear(y => y - 1)}
          aria-label="שנה קודמת"
          className="text-slate-400 text-2xl w-10 text-center"
        >‹</button>
        <h1 className="text-lg font-bold">{year}</h1>
        <button
          onClick={() => setYear(y => y + 1)}
          aria-label="שנה הבאה"
          className="text-slate-400 text-2xl w-10 text-center"
          disabled={year >= new Date().getFullYear()}
        >›</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">ממוצע חודשי</p>
              <p className="text-xl font-bold tabular-nums">₪{avgMonthly.toLocaleString('he-IL')}</p>
            </div>
            <div className="bg-surface rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">סה&quot;כ {year}</p>
              <p className="text-xl font-bold tabular-nums">₪{totalYear.toLocaleString('he-IL')}</p>
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
