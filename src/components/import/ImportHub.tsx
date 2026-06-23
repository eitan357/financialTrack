'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { seedDefaultAccounts, getAccounts } from '@/lib/firestore/accounts'
import { seedDefaultCategories } from '@/lib/firestore/categories'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntries } from '@/lib/firestore/salary'
import type { Account, SalaryEntry, Transaction } from '@/lib/types'

type BankType = 'one-zero' | 'leumi' | 'generic'

function detectBankType(account: Account): BankType {
  const id = (account.csvIdentifier ?? account.name).toLowerCase()
  if (id.includes('one-zero') || id.includes('one zero')) return 'one-zero'
  if (id.includes('leumi') || id.includes('לאומי')) return 'leumi'
  return 'generic'
}

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function txCount(txs: Transaction[], accountId: string) {
  return txs.filter(t => t.accountId === accountId).length
}

export function ImportHub() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [month, setMonthState] = useState<string>(currentMonth)

  // Hydrate month from localStorage after mount (avoids SSR/client mismatch)
  useEffect(() => {
    const stored = localStorage.getItem('ft_month')
    if (stored) setMonthState(stored)
  }, [])

  // Sync month from URL search param
  useEffect(() => {
    const urlMonth = searchParams.get('month')
    if (urlMonth) setMonthState(urlMonth)
  }, [searchParams])

  const setMonth = useCallback((m: string) => {
    setMonthState(m)
    localStorage.setItem('ft_month', m)
    router.replace(`/import?month=${m}`)
  }, [router])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([])

  const loadStatus = useCallback(async (m: string) => {
    const [txs, salaries] = await Promise.all([getTransactions(m), getSalaryEntries(m)])
    setTransactions(txs)
    setSalaryEntries(salaries)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function init() {
      try {
        await Promise.all([seedDefaultAccounts(), seedDefaultCategories()])
        const accs = await getAccounts()
        setAccounts(accs)
        await loadStatus(month)
      } catch {
        setError('שגיאה בטעינת הנתונים.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [month, loadStatus])

  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.isActive)
  const bankAccounts = accounts.filter(a => a.type === 'bank' && a.isActive)
  const cashAccount = accounts.find(a => a.type === 'cash' && a.isActive)

  if (loading) {
    return (
      <main className="p-4 max-w-lg mx-auto">
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="p-4 max-w-lg mx-auto">
        <p className="text-red-400 text-sm">{error}</p>
      </main>
    )
  }

  const cashTxCount = cashAccount
    ? transactions.filter(t => t.accountId === cashAccount.id && !t.salaryDetails).length
    : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={setMonth} />

      <div className="space-y-2">
        {creditAccounts.map(acc => {
          const count = txCount(transactions, acc.id)
          return (
            <button
              key={acc.id}
              onClick={() => router.push(`/import/credit/${acc.id}?month=${month}`)}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{acc.name}</div>
                <div className="text-xs text-slate-500">{count > 0 ? `${count} עסקאות יובאו` : 'לא יובא עדיין'}</div>
              </div>
              <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
            </button>
          )
        })}

        {bankAccounts.map(acc => {
          const count = txCount(transactions, acc.id)
          return (
            <button
              key={acc.id}
              onClick={() => router.push(`/import/bank/${acc.id}?month=${month}`)}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{acc.name}</div>
                <div className="text-xs text-slate-500">{count > 0 ? `${count} עסקאות יובאו` : 'לא יובא עדיין'}</div>
              </div>
              <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
            </button>
          )
        })}

        <button
          onClick={() => router.push(`/import/salary?month=${month}`)}
          className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">משכורות</div>
            <div className="text-xs text-slate-500">
              {salaryEntries.length > 0
                ? `${salaryEntries.length} משכורות · נטו ₪${salaryEntries.reduce((s, e) => s + e.netAmount, 0).toLocaleString('he-IL')}`
                : 'לחץ להוספה / עריכה'}
            </div>
          </div>
          <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
        </button>

        {cashAccount && (
          <button
            onClick={() => router.push(`/import/cash?month=${month}`)}
            className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cashAccount.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">מזומן</div>
              <div className="text-xs text-slate-500">{cashTxCount > 0 ? `${cashTxCount} עסקאות` : 'לחץ להוספה / עריכה'}</div>
            </div>
            <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
          </button>
        )}

        {bankAccounts.length === 0 && creditAccounts.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-2">
            אין חשבונות פעילים — <a href="/settings" className="text-accent underline">הוסף בהגדרות</a>
          </p>
        )}
      </div>
    </main>
  )
}
