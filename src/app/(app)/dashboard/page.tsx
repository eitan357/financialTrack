'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntry } from '@/lib/firestore/salary'
import { getIncomeEntries } from '@/lib/firestore/income'
import { getDividends } from '@/lib/firestore/dividends'
import { getInvestmentEntries, getInvestmentTypes } from '@/lib/firestore/investments'
import { getBankReconciliations } from '@/lib/firestore/bank-reconciliations'
import { getMonthlySettings } from '@/lib/firestore/monthly-settings'
import { getCategories } from '@/lib/firestore/categories'
import { computeDashboard } from '@/lib/dashboard/compute'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { CategoryProgress } from '@/components/dashboard/CategoryProgress'
import { BankReconciliationCard } from '@/components/dashboard/BankReconciliationCard'
import { DividendsCard } from '@/components/dashboard/DividendsCard'
import type { BankReconciliation, Dividend, InvestmentType } from '@/lib/types'
import type { DashboardSummary } from '@/lib/dashboard/compute'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null)
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const [txs, salary, income, divs, invEntries, invTypes, recs, cats, settings] = await Promise.all([
          getTransactions(month),
          getSalaryEntry(month),
          getIncomeEntries(month),
          getDividends(month),
          getInvestmentEntries(month),
          getInvestmentTypes(),
          getBankReconciliations(month),
          getCategories(),
          getMonthlySettings(month),
        ])
        setSummary(computeDashboard({
          transactions: txs, salaryEntry: salary, incomeEntries: income,
          dividends: divs, investmentEntries: invEntries, categories: cats, monthlySettings: settings,
        }))
        setReconciliation(recs[0] ?? null)
        setDividends(divs)
        setInvestmentTypes(invTypes)
      } catch (e) {
        setError('שגיאה בטעינת הנתונים. בדוק שה-Firestore מוגדר בפרויקט Firebase.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="הכנסות" amount={summary.totalIncome} color="text-green-400" />
            <SummaryCard label="הוצאות" amount={summary.totalExpenses} color="text-red-400" />
            <SummaryCard label="חיסכון" amount={summary.totalSavings} />
            <SummaryCard label="להשקעות" amount={summary.totalInvestments} color="text-accent" />
          </div>
          <CategoryProgress categories={summary.categoryTotals} />
          <BankReconciliationCard reconciliation={reconciliation} />
          <DividendsCard dividends={dividends} investmentTypes={investmentTypes} />
        </div>
      )}
    </main>
  )
}
