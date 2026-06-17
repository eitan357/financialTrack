'use client'
import { useState } from 'react'
import { getCategories, cleanupDuplicateCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { addTransactions, deleteAllTransactions } from '@/lib/firestore/transactions'
import { upsertSalaryEntry, deleteAllSalaryEntries } from '@/lib/firestore/salary'
import { addIncomeEntry, deleteAllIncomeEntries } from '@/lib/firestore/income'
import type { Transaction, SalaryEntry } from '@/lib/types'

interface ParsedTx {
  date: string
  merchantName: string
  description: string
  amount: number
  categoryName: string
  accountName: string
  month: string
}

interface ParsedBankTx {
  date: string
  merchantName: string
  description: string
  amount: number
  accountName: string
  month: string
  direction: 'income' | 'expense'
}

interface ParsedSal {
  month: string
  grossAmount: number
  incomeTax: number
  nationalInsurance: number
  healthInsurance: number
  pension: number
  trainingFund: number
  netAmount: number
}

interface ParsedIncome {
  month: string
  sourceName: string
  amount: number
}

interface SeedData {
  month: string
  transactions: ParsedTx[]
  bankTransactions: ParsedBankTx[]
  salary: ParsedSal | null
  incomeEntries: ParsedIncome[]
}

interface SeedSummary {
  months: string[]
  totalTransactions: number
  totalBankTransactions: number
  totalSalaries: number
  totalIncomeEntries: number
  data: SeedData[]
}

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<SeedSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [done, setDone] = useState<{ transactions: number; salaries: number; incomeEntries: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; txsFixed: number } | null>(null)

  async function runCleanup() {
    setCleanupRunning(true); setError(null)
    try {
      const result = await cleanupDuplicateCategories()
      setCleanupResult(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setCleanupRunning(false)
    }
  }

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/seed-data')
      if (!res.ok) throw new Error(await res.text())
      setSummary(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function clearAll() {
    if (!window.confirm('מחיקת כל העסקאות, המשכורות וההכנסות מהדאטה בייס. האם להמשיך?')) return
    setClearing(true); setError(null)
    try {
      await Promise.all([
        deleteAllTransactions(),
        deleteAllSalaryEntries(),
        deleteAllIncomeEntries(),
      ])
    } catch (e) {
      setError(String(e))
    } finally {
      setClearing(false)
    }
  }

  async function importAll() {
    if (!summary) return
    setImporting(true); setError(null)
    try {
      const [categories, accounts] = await Promise.all([getCategories(), getAccounts()])
      const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))
      const accMap = Object.fromEntries(accounts.map(a => [a.name, a.id]))

      const allTxs: Omit<Transaction, 'id'>[] = []
      const salaryEntries: Omit<SalaryEntry, 'id'>[] = []

      for (const monthData of summary.data) {
        // Credit card transactions
        for (const t of monthData.transactions) {
          const accountId = accMap[t.accountName]
          if (!accountId) continue
          const tx: Omit<Transaction, 'id'> = {
            date: t.date,
            merchantName: t.merchantName,
            amount: t.amount,
            currency: 'ILS',
            accountId,
            source: 'csv_import',
            isImmediate: false,
            month: t.month,
          }
          if (t.description) tx.description = t.description
          if (catMap[t.categoryName]) tx.categoryId = catMap[t.categoryName]
          allTxs.push(tx)
        }

        // Bank transactions (expenses and income)
        for (const bt of monthData.bankTransactions) {
          const accountId = accMap[bt.accountName]
          if (!accountId) continue
          const tx: Omit<Transaction, 'id'> = {
            date: bt.date,
            merchantName: bt.merchantName,
            amount: bt.amount,
            currency: 'ILS',
            accountId,
            source: 'csv_import',
            isImmediate: false,
            month: bt.month,
            direction: bt.direction,
          }
          if (bt.description) tx.description = bt.description
          allTxs.push(tx)
        }

        if (monthData.salary) {
          const s = monthData.salary
          salaryEntries.push({
            month: s.month,
            employerName: 'יד 2',
            grossAmount: s.grossAmount,
            deductions: {
              incomeTax: s.incomeTax,
              nationalInsurance: s.nationalInsurance,
              healthInsurance: s.healthInsurance,
              pension: s.pension,
              trainingFund: s.trainingFund,
            },
            netAmount: s.netAmount,
          })
        }
      }

      // Insert transactions in batches of 400 (under Firestore 500 limit)
      for (let i = 0; i < allTxs.length; i += 400) {
        await addTransactions(allTxs.slice(i, i + 400))
      }

      for (const entry of salaryEntries) {
        await upsertSalaryEntry(entry)
      }

      let incomeCount = 0
      for (const monthData of summary.data) {
        for (const inc of monthData.incomeEntries) {
          await addIncomeEntry({
            month: inc.month,
            date: `${inc.month}-01`,
            sourceName: inc.sourceName,
            amount: inc.amount,
            currency: 'ILS',
          })
          incomeCount++
        }
      }

      setDone({ transactions: allTxs.length, salaries: salaryEntries.length, incomeEntries: incomeCount })
    } catch (e) {
      setError(String(e))
    } finally {
      setImporting(false)
    }
  }

  async function clearAndImport() {
    if (!summary) return
    if (!window.confirm('פעולה זו תמחק את כל הנתונים הקיימים ותייבא מחדש. האם להמשיך?')) return
    setClearing(true); setError(null)
    try {
      await Promise.all([
        deleteAllTransactions(),
        deleteAllSalaryEntries(),
        deleteAllIncomeEntries(),
      ])
    } catch (e) {
      setError(String(e))
      setClearing(false)
      return
    }
    setClearing(false)
    await importAll()
  }

  if (done) {
    return (
      <main className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">ייבוא הושלם</h1>
        <div className="bg-surface rounded-2xl p-4 space-y-2">
          <p className="text-sm">עסקאות שיובאו: <span className="font-bold">{done.transactions}</span></p>
          <p className="text-sm">משכורות שיובאו: <span className="font-bold">{done.salaries}</span></p>
          <p className="text-sm">הכנסות שיובאו: <span className="font-bold">{done.incomeEntries}</span></p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 max-w-lg mx-auto space-y-8">
      <section>
        <h1 className="text-xl font-bold mb-2">תחזוקת נתונים</h1>
        {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="bg-surface rounded-2xl p-4 space-y-3">
          <p className="text-sm text-slate-400">ניקוי קטגוריות כפולות — מאחד כפילויות ומעדכן עסקאות</p>
          {cleanupResult ? (
            <p className="text-sm text-green-400">
              הושלם: נמחקו {cleanupResult.deleted} כפילויות, עודכנו {cleanupResult.txsFixed} עסקאות
            </p>
          ) : (
            <button
              onClick={runCleanup}
              disabled={cleanupRunning}
              className="w-full py-2 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {cleanupRunning ? 'מנקה...' : 'נקה קטגוריות כפולות'}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">ייבוא נתונים היסטוריים</h2>
        <p className="text-slate-400 text-sm mb-4">טוען נתונים מקבצי הדוגמה בתיקיית examples/</p>

        {!summary ? (
          <button
            onClick={loadData}
            disabled={loading}
            className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'טען נתונים'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-surface rounded-2xl p-4 space-y-2">
              <p className="text-sm">חודשים שנמצאו: <span className="font-bold">{summary.months.length}</span></p>
              <p className="text-sm">עסקאות אשראי: <span className="font-bold">{summary.totalTransactions}</span></p>
              <p className="text-sm">עסקאות בנק: <span className="font-bold">{summary.totalBankTransactions}</span></p>
              <p className="text-sm">משכורות: <span className="font-bold">{summary.totalSalaries}</span></p>
              <p className="text-sm">הכנסות: <span className="font-bold">{summary.totalIncomeEntries}</span></p>
              <div className="text-xs text-slate-500 mt-2">
                {summary.months.sort().join(' • ')}
              </div>
            </div>
            <button
              onClick={clearAndImport}
              disabled={importing || clearing}
              className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-semibold disabled:opacity-50"
            >
              {clearing ? 'מוחק...' : importing ? 'מייבא...' : 'נקה הכל וייבא מחדש'}
            </button>
            <button
              onClick={importAll}
              disabled={importing || clearing}
              className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
            >
              {importing ? 'מייבא...' : 'הוסף לדאטה בייס (ללא מחיקה)'}
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
