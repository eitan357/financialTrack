'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { seedDefaultAccounts, getAccounts } from '@/lib/firestore/accounts'
import { seedDefaultCategories, getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntries, getSalaryEntry } from '@/lib/firestore/salary'
import { CreditFlow } from './flows/CreditFlow'
import { BankFlow, type BankType } from './flows/BankFlow'
import { SalaryFlow } from './flows/SalaryFlow'
import { CashFlow } from './flows/CashFlow'
import type { Account, Category, CategorizationRule, SalaryEntry, Transaction } from '@/lib/types'

type FlowId =
  | { type: 'credit'; accountId: string }
  | { type: 'bank'; accountId: string; bankType: BankType }
  | { type: 'salary' }
  | { type: 'cash' }

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function detectBankType(account: Account): BankType {
  const id = (account.csvIdentifier ?? account.name).toLowerCase()
  if (id.includes('one-zero') || id.includes('one zero')) return 'one-zero'
  if (id.includes('leumi') || id.includes('לאומי')) return 'leumi'
  return 'generic'
}

interface HubStatus {
  transactions: Transaction[]
  salaryEntries: SalaryEntry[]
}

function txCount(txs: Transaction[], accountId: string) {
  return txs.filter(t => t.accountId === accountId).length
}

export function ImportHub() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [status, setStatus] = useState<HubStatus>({ transactions: [], salaryEntries: [] })
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)
  const [activeFlow, setActiveFlow] = useState<FlowId | null>(null)

  const loadStatus = useCallback(async (m: string) => {
    const [txs, salaries] = await Promise.all([
      getTransactions(m),
      getSalaryEntries(m),
    ])
    setStatus({ transactions: txs, salaryEntries: salaries })
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setActiveFlow(null)
    async function init() {
      try {
        await Promise.all([seedDefaultAccounts(), seedDefaultCategories()])
        const [accs, cats, rls, prevSal] = await Promise.all([
          getAccounts(),
          getCategories(),
          getRules(),
          getSalaryEntry(prevMonthStr(month)),
        ])
        setAccounts(accs)
        setCategories(cats)
        setRules(rls)
        if (prevSal) { const { id: _salId, ...rest } = prevSal; setPreviousSalary(rest) }
        await loadStatus(month)
      } catch {
        setError('שגיאה בטעינת הנתונים.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [month, loadStatus])

  function handleFlowDone() {
    setActiveFlow(null)
    loadStatus(month).catch(() => setError('שגיאה בטעינת הנתונים.'))
  }

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

  // Render active flow
  if (activeFlow) {
    if (activeFlow.type === 'credit') {
      const account = accounts.find(a => a.id === activeFlow.accountId)
      if (!account) { setActiveFlow(null); return null }
      return (
        <main className="p-4 max-w-lg mx-auto">
          <CreditFlow
            month={month}
            accountId={activeFlow.accountId}
            accountName={account.name}
            categories={categories}
            rules={rules}
            previousTransactions={status.transactions}
            existingTransactions={status.transactions.filter(t => t.accountId === activeFlow.accountId)}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'bank') {
      const account = accounts.find(a => a.id === activeFlow.accountId)
      if (!account) { setActiveFlow(null); return null }
      return (
        <main className="p-4 max-w-lg mx-auto">
          <BankFlow
            month={month}
            accountId={activeFlow.accountId}
            accountName={account.name}
            bankType={activeFlow.bankType}
            categories={categories}
            rules={rules}
            previousTransactions={status.transactions}
            existingTransactions={status.transactions.filter(t => t.accountId === activeFlow.accountId)}
            salaryEntries={status.salaryEntries}
            creditAccounts={accounts.filter(a => a.type === 'credit')}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'salary') {
      return (
        <main className="p-4 max-w-lg mx-auto">
          <SalaryFlow
            month={month}
            existingEntries={status.salaryEntries}
            bankAccounts={bankAccounts}
            previousSalary={previousSalary}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'cash') {
      const cashTxs = cashAccount
        ? status.transactions.filter(t => t.accountId === cashAccount.id)
        : []
      return (
        <main className="p-4 max-w-lg mx-auto">
          <CashFlow
            month={month}
            cashAccountId={cashAccount?.id ?? ''}
            categories={categories}
            existingTransactions={cashTxs}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
  }

  // Hub screen
  const cashTxCount = cashAccount ? txCount(status.transactions, cashAccount.id) : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={m => { setMonth(m); setActiveFlow(null) }} />

      <div className="space-y-2">
        {creditAccounts.map(acc => {
          const count = txCount(status.transactions, acc.id)
          return (
            <button
              key={acc.id}
              onClick={() => setActiveFlow({ type: 'credit', accountId: acc.id })}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{acc.name}</div>
                <div className="text-xs text-slate-500">ייבוא קובץ CSV · {count > 0 ? `${count} עסקאות יובאו` : 'לא יובא עדיין'}</div>
              </div>
              <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
            </button>
          )
        })}

        {bankAccounts.map(acc => {
          const count = txCount(status.transactions, acc.id)
          const bankType = detectBankType(acc)
          const fileLabel = bankType === 'leumi' ? 'PDF' : bankType === 'one-zero' ? 'XLS' : 'XLS / PDF'
          return (
            <button
              key={acc.id}
              onClick={() => setActiveFlow({ type: 'bank', accountId: acc.id, bankType })}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{acc.name}</div>
                <div className="text-xs text-slate-500">ייבוא קובץ {fileLabel} · {count > 0 ? `${count} עסקאות יובאו` : 'לא יובא עדיין'}</div>
              </div>
              <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
            </button>
          )
        })}

        <button
          onClick={() => setActiveFlow({ type: 'salary' })}
          className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">משכורות</div>
            <div className="text-xs text-slate-500">
              {status.salaryEntries.length > 0
                ? `${status.salaryEntries.length} משכורות · נטו ₪${status.salaryEntries.reduce((s, e) => s + e.netAmount, 0).toLocaleString('he-IL')}`
                : 'לחץ להוספה / עריכה'}
            </div>
          </div>
          <ChevronLeft size={16} className="text-slate-500 flex-shrink-0" />
        </button>

        {cashAccount && (
          <button
            onClick={() => setActiveFlow({ type: 'cash' })}
            className="w-full bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-surface/80 transition-colors text-right"
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cashAccount.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">מזומן</div>
              <div className="text-xs text-slate-500">{cashTxCount > 0 ? `${cashTxCount} הוצאות` : 'לחץ להוספה / עריכה'}</div>
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
