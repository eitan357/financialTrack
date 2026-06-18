'use client'
import { useState } from 'react'
import { getCategories, cleanupDuplicateCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { updateCreditLinkage } from '@/lib/settings-mutations'
import { addTransactions, deleteAllTransactions, deleteTransaction, getTransactionsForMonths } from '@/lib/firestore/transactions'
import { upsertSalaryEntry, deleteAllSalaryEntries, getAllSalaryEntries } from '@/lib/firestore/salary'
import { addIncomeEntry, deleteAllIncomeEntries } from '@/lib/firestore/income'
import { saveBankReconciliation, deleteAllBankReconciliations } from '@/lib/firestore/bank-reconciliations'
import type { Transaction, SalaryEntry } from '@/lib/types'

// Actual bank balances extracted from CSV "החודש הזה" rows.
// 2024-12: only Leumi existed (One Zero account opened Jan 2025)
// 2025: Leumi at col 18, One Zero at col ~23. March uses the revised (שינוי תשלום אשראי) file.
// 2026: columns swapped — One Zero at col 18, Leumi at col 23.
const BANK_BALANCES: Record<string, { leumi: number | null; oneZero: number | null }> = {
  '2024-12': { leumi: 24704.63, oneZero: null },
  '2025-01': { leumi: 60032.72, oneZero: 22000.00 },
  '2025-02': { leumi: 8219.81,  oneZero: 1745.90 },
  '2025-03': { leumi: 9020.74,  oneZero: 4963.87 },
  '2025-04': { leumi: 15055.10, oneZero: 19916.08 },
  '2025-05': { leumi: 18312.97, oneZero: 19082.08 },
  '2025-06': { leumi: 9155.93,  oneZero: 17032.72 },
  '2025-07': { leumi: 8294.39,  oneZero: 6446.72 },
  '2025-08': { leumi: 15537.01, oneZero: 8290.72 },
  '2025-09': { leumi: 11364.33, oneZero: 3388.72 },
  '2025-10': { leumi: 13427.01, oneZero: 1354.72 },
  '2025-11': { leumi: 14256.80, oneZero: 2912.72 },
  '2025-12': { leumi: 20485.87, oneZero: 1044.72 },
  '2026-01': { leumi: 1044.72,  oneZero: 23155.19 },
  '2026-02': { leumi: 1044.72,  oneZero: 27635.31 },
  '2026-03': { leumi: 1180.72,  oneZero: 38380.12 },
  '2026-04': { leumi: 24082.85, oneZero: 35203.83 },
}

// Bank routing based on CSV analysis: most months → One Zero; only Feb 2025 → Leumi
const SALARY_BANK_ROUTING: Record<string, 'leumi' | 'one-zero'> = {
  '2025-02': 'leumi',
  // all other months default to 'one-zero'
}

// Actual deposit dates extracted from CSV bank income sections
const SALARY_DEPOSIT_DATES: Record<string, string> = {
  '2025-02': '2025-01-31',
  '2025-03': '2025-04-01',
  '2025-04': '2025-04-30',
  '2025-05': '2025-05-31',
  '2025-06': '2025-07-01',
  '2025-07': '2025-07-31',
  '2025-08': '2025-09-01',
  '2025-09': '2025-09-30',
  '2025-10': '2025-11-01',
  '2025-11': '2025-12-01',
  '2025-12': '2026-01-01',
  '2026-01': '2026-01-31',
  '2026-02': '2026-03-01',
  '2026-03': '2026-03-31',
  '2026-04': '2026-05-02',
}

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
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<{ created: number; deleted: number } | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<number | null>(null)
  const [seedingRecs, setSeedingRecs] = useState(false)
  const [seedRecsResult, setSeedRecsResult] = useState<number | null>(null)

  async function backfillLinkedBankHistory() {
    setBackfilling(true); setError(null)
    try {
      const accounts = await getAccounts()
      const creditAccounts = accounts.filter(
        a => a.type === 'credit' && a.linkedBankAccountId && !a.linkedBankHistory?.length
      )
      for (const acc of creditAccounts) {
        // fromMonth '2000-01' means "applies to all months since the beginning of time"
        await updateCreditLinkage(acc.id, acc.linkedBankAccountId!, acc.creditPaymentDay, '2000-01')
      }
      setBackfillResult(creditAccounts.length)
    } catch (e) {
      setError(String(e))
    } finally {
      setBackfilling(false)
    }
  }

  async function seedBankReconciliations() {
    setSeedingRecs(true); setError(null)
    try {
      const accounts = await getAccounts()
      const leumiId = accounts.find(a => a.name === 'בנק לאומי')?.id
      const oneZeroId = accounts.find(a => a.name === 'בנק One Zero')?.id
      if (!leumiId || !oneZeroId) throw new Error('לא נמצאו חשבונות בנק לאומי / One Zero')

      await deleteAllBankReconciliations()

      let count = 0
      for (const [month, { leumi, oneZero }] of Object.entries(BANK_BALANCES)) {
        const lastDay = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0)
          .toISOString().slice(0, 10)
        if (leumi !== null) {
          await saveBankReconciliation({ month, accountId: leumiId, actualBalance: leumi, date: lastDay })
          count++
        }
        if (oneZero !== null) {
          await saveBankReconciliation({ month, accountId: oneZeroId, actualBalance: oneZero, date: lastDay })
          count++
        }
      }
      setSeedRecsResult(count)
    } catch (e) {
      setError(String(e))
    } finally {
      setSeedingRecs(false)
    }
  }

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

  async function migrateSalaryTransactions() {
    setMigrating(true); setError(null)
    try {
      const [salaryEntries, accounts] = await Promise.all([getAllSalaryEntries(), getAccounts()])
      const leumiId = accounts.find(a => a.name === 'בנק לאומי')?.id
      const oneZeroId = accounts.find(a => a.name === 'בנק One Zero')?.id

      // Delete any existing salary income transactions first (idempotent re-run)
      const salaryMonths = salaryEntries.map(e => e.month)
      const existingTxs = salaryMonths.length > 0 ? await getTransactionsForMonths(salaryMonths) : []
      const existingSalaryTxs = existingTxs.filter(t => t.direction === 'income' && t.salaryDetails)
      for (const tx of existingSalaryTxs) {
        await deleteTransaction(tx.id)
      }

      const newTxs: Omit<Transaction, 'id'>[] = []
      for (const entry of salaryEntries) {
        const bankKey = SALARY_BANK_ROUTING[entry.month] ?? 'one-zero'
        const accountId = bankKey === 'one-zero' ? oneZeroId : leumiId
        if (!accountId) continue
        const date = SALARY_DEPOSIT_DATES[entry.month] ?? `${entry.month}-28`
        newTxs.push({
          date,
          merchantName: entry.employerName || 'משכורת',
          amount: entry.netAmount,
          currency: 'ILS',
          accountId,
          source: 'csv_import',
          isImmediate: false,
          month: entry.month,
          direction: 'income',
          salaryDetails: {
            grossAmount: entry.grossAmount,
            deductions: entry.deductions,
            netAmount: entry.netAmount,
            employerName: entry.employerName,
          },
        })
      }

      if (newTxs.length > 0) await addTransactions(newTxs)
      setMigrateResult({ created: newTxs.length, deleted: existingSalaryTxs.length })
    } catch (e) {
      setError(String(e))
    } finally {
      setMigrating(false)
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
        <h2 className="text-lg font-bold mb-2">מיגרציה — היסטוריית קישור אשראי</h2>
        <p className="text-slate-400 text-sm mb-4">
          יוצר linkedBankHistory לכרטיסי אשראי שעדיין אין להם — חד פעמי, בטוח להריץ שוב
        </p>
        <div className="bg-surface rounded-2xl p-4 space-y-3">
          {backfillResult !== null && (
            <p className="text-sm text-green-400">הושלם: עודכנו {backfillResult} חשבונות</p>
          )}
          <button
            onClick={backfillLinkedBankHistory}
            disabled={backfilling}
            className="w-full py-2 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {backfilling ? 'מריץ...' : 'הוסף היסטוריית קישור לחשבונות אשראי'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">מיגרציה — יתרות בנק היסטוריות</h2>
        <p className="text-slate-400 text-sm mb-4">
          מייבא יתרות בנק חודשיות מהטבלאות (2024-12 עד 2026-04) — מוחק ומייצר מחדש
        </p>
        <div className="bg-surface rounded-2xl p-4 space-y-3">
          {seedRecsResult !== null && (
            <p className="text-sm text-green-400">הושלם: נשמרו {seedRecsResult} רשומות</p>
          )}
          <button
            onClick={seedBankReconciliations}
            disabled={seedingRecs}
            className="w-full py-2 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {seedingRecs ? 'מייבא...' : seedRecsResult !== null ? 'הרץ שוב' : 'ייבא יתרות בנק'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">מיגרציה — עסקאות משכורת</h2>
        <p className="text-slate-400 text-sm mb-4">יוצר עסקאות הכנסה בבנק עבור משכורות קיימות שאין להן עסקה משויכת</p>
        <div className="bg-surface rounded-2xl p-4 space-y-3">
          {migrateResult && (
            <p className="text-sm text-green-400">
              הושלם: נמחקו {migrateResult.deleted} ישנות, נוצרו {migrateResult.created} חדשות
            </p>
          )}
          <button
            onClick={migrateSalaryTransactions}
            disabled={migrating}
            className="w-full py-2 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {migrating ? 'מריץ...' : migrateResult ? 'הרץ שוב' : 'שייך משכורות לחשבונות בנק'}
          </button>
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
