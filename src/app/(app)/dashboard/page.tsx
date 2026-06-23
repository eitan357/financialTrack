'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntry } from '@/lib/firestore/salary'
import { getIncomeEntries } from '@/lib/firestore/income'
import { getDividends } from '@/lib/firestore/dividends'
import { getInvestmentEntries, getInvestmentTypes } from '@/lib/firestore/investments'
import { getBankReconciliations } from '@/lib/firestore/bank-reconciliations'
import { getMonthlySettings } from '@/lib/firestore/monthly-settings'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { computeDashboard } from '@/lib/dashboard/compute'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { CategoryProgress } from '@/components/dashboard/CategoryProgress'
import { BankReconciliationCard } from '@/components/dashboard/BankReconciliationCard'
import { DividendsCard } from '@/components/dashboard/DividendsCard'
import { BreakdownDrawer } from '@/components/dashboard/BreakdownDrawer'
import type { BankReconciliation, Dividend, InvestmentType, Transaction, SalaryEntry, InvestmentEntry, Category, Account } from '@/lib/types'
import type { DashboardSummary } from '@/lib/dashboard/compute'
import type { DrawerData } from '@/components/dashboard/BreakdownDrawer'

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

interface RawData {
  transactions: Transaction[]
  salary: SalaryEntry | null
  investmentEntries: InvestmentEntry[]
  categories: Category[]
  accounts: Account[]
}

export default function DashboardPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [rawData, setRawData] = useState<RawData | null>(null)
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([])
  const [prevReconciliations, setPrevReconciliations] = useState<BankReconciliation[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [drawer, setDrawer] = useState<DrawerData | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setDrawer(null)
    async function load() {
      try {
        const [txs, salary, income, divs, invEntries, invTypes, recs, prevRecs, cats, settings, accs] = await Promise.all([
          getTransactions(month),
          getSalaryEntry(month),
          getIncomeEntries(month),
          getDividends(month),
          getInvestmentEntries(month),
          getInvestmentTypes(),
          getBankReconciliations(month),
          getBankReconciliations(prevMonth(month)),
          getCategories(),
          getMonthlySettings(month),
          getAccounts(),
        ])
        const creditIds = new Set(accs.filter(a => a.type === 'credit').map(a => a.id))
        const txsForCompute = txs.filter(t => !(t.isImmediate && creditIds.has(t.accountId)))
        setSummary(computeDashboard({
          transactions: txsForCompute, salaryEntry: salary,
          dividends: divs, investmentEntries: invEntries, categories: cats, monthlySettings: settings,
        }))
        setRawData({ transactions: txs, salary, investmentEntries: invEntries, categories: cats, accounts: accs })
        setReconciliations(recs)
        setPrevReconciliations(prevRecs)
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

  function openIncome() {
    if (!rawData || !summary) return
    const salaryTx = rawData.salary?.salaryTxId
      ? rawData.transactions.find(t => t.id === rawData.salary!.salaryTxId)
      : undefined
    setDrawer({
      type: 'income',
      total: summary.totalIncome,
      salary: rawData.salary,
      salaryDate: salaryTx?.date,
      dividends,
      incomeTransactions: rawData.transactions.filter(t => t.direction === 'income' && !t.salaryDetails),
    })
  }

  function openExpenses() {
    if (!rawData || !summary) return
    const creditIds = new Set(rawData.accounts.filter(a => a.type === 'credit').map(a => a.id))
    const expenseTxs = rawData.transactions.filter(t =>
      t.direction !== 'income' && !(t.isImmediate && creditIds.has(t.accountId))
    )
    setDrawer({
      type: 'expenses',
      total: summary.totalExpenses,
      transactions: expenseTxs,
      categories: rawData.categories,
      accounts: rawData.accounts,
    })
  }

  function openCategoryBreakdown() {
    if (!rawData || !summary) return
    const creditIds = new Set(rawData.accounts.filter(a => a.type === 'credit').map(a => a.id))
    const expenseTxs = rawData.transactions.filter(t =>
      t.direction !== 'income' && !(t.isImmediate && creditIds.has(t.accountId))
    )
    setDrawer({
      type: 'expenses-by-category',
      total: summary.totalExpenses,
      transactions: expenseTxs,
      categories: rawData.categories,
    })
  }

  function openInvestments() {
    if (!rawData || !summary) return
    setDrawer({
      type: 'investments',
      total: summary.totalInvestments,
      entries: rawData.investmentEntries,
      types: investmentTypes,
    })
  }

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={setMonth} />

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="הכנסות" amount={summary.totalIncome} color="text-green-400" onClick={openIncome} />
            <SummaryCard label="הוצאות" amount={summary.totalExpenses} color="text-red-400" onClick={openExpenses} />
            <SummaryCard label="חיסכון" amount={summary.totalSavings} />
            <SummaryCard label="השקעות" amount={summary.totalInvestments} color="text-accent" onClick={openInvestments} />
          </div>
          <CategoryProgress categories={summary.categoryTotals} onClick={openCategoryBreakdown} />
          <BankReconciliationCard
            accounts={rawData?.accounts ?? []}
            transactions={rawData?.transactions ?? []}
            reconciliations={reconciliations}
            prevReconciliations={prevReconciliations}
            month={month}
            onSaved={saved => setReconciliations(prev => {
              const without = prev.filter(r => r.accountId !== saved.accountId)
              return [...without, saved]
            })}
          />
          <DividendsCard dividends={dividends} investmentTypes={investmentTypes} />
        </div>
      )}

      {drawer && <BreakdownDrawer data={drawer} onClose={() => setDrawer(null)} />}
    </main>
  )
}
