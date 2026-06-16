'use client'
import { useState } from 'react'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { addTransactions } from '@/lib/firestore/transactions'
import { upsertSalaryEntry } from '@/lib/firestore/salary'
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

interface SeedData {
  month: string
  transactions: ParsedTx[]
  salary: ParsedSal | null
}

interface SeedSummary {
  months: string[]
  totalTransactions: number
  totalSalaries: number
  data: SeedData[]
}

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<SeedSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ transactions: number; salaries: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        for (const t of monthData.transactions) {
          const accountId = accMap[t.accountName]
          if (!accountId) continue
          allTxs.push({
            date: t.date,
            merchantName: t.merchantName,
            description: t.description || undefined,
            amount: t.amount,
            currency: 'ILS',
            accountId,
            categoryId: catMap[t.categoryName] ?? undefined,
            source: 'csv_import',
            isImmediate: false,
            month: t.month,
          })
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

      setDone({ transactions: allTxs.length, salaries: salaryEntries.length })
    } catch (e) {
      setError(String(e))
    } finally {
      setImporting(false)
    }
  }

  if (done) {
    return (
      <main className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">ייבוא הושלם</h1>
        <div className="bg-surface rounded-2xl p-4 space-y-2">
          <p className="text-sm">עסקאות שיובאו: <span className="font-bold">{done.transactions}</span></p>
          <p className="text-sm">משכורות שיובאו: <span className="font-bold">{done.salaries}</span></p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-2">ייבוא נתונים היסטוריים</h1>
      <p className="text-slate-400 text-sm mb-6">טוען נתונים מקבצי הדוגמה בתיקיית examples/</p>

      {error && <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>}

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
            <p className="text-sm">עסקאות: <span className="font-bold">{summary.totalTransactions}</span></p>
            <p className="text-sm">משכורות: <span className="font-bold">{summary.totalSalaries}</span></p>
            <div className="text-xs text-slate-500 mt-2">
              {summary.months.sort().join(' • ')}
            </div>
          </div>
          <button
            onClick={importAll}
            disabled={importing}
            className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
          >
            {importing ? 'מייבא...' : 'ייבא הכל לדאטה בייס'}
          </button>
        </div>
      )}
    </main>
  )
}
