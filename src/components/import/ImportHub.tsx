'use client'
import { useState, useEffect, useCallback } from 'react'
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
import { IncomeFlow } from './flows/IncomeFlow'
import { CashFlow } from './flows/CashFlow'
import type { Account, Category, CategorizationRule, SalaryEntry, Transaction } from '@/lib/types'

type FlowId =
  | { type: 'credit'; accountId: string }
  | { type: 'bank'; accountId: string; bankType: BankType }
  | { type: 'salary' }
  | { type: 'income' }
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
  const salaryBankAccounts = bankAccounts

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
            bankAccounts={salaryBankAccounts}
            previousSalary={previousSalary}
            onDone={handleFlowDone}
            onBack={() => setActiveFlow(null)}
          />
        </main>
      )
    }
    if (activeFlow.type === 'income') {
      const incomeTxs = status.transactions.filter(t => t.direction === 'income' && !t.salaryDetails)
      return (
        <main className="p-4 max-w-lg mx-auto">
          <IncomeFlow
            month={month}
            existingTransactions={incomeTxs}
            bankAccounts={salaryBankAccounts}
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
  const incomeTxCount = status.transactions.filter(t => t.direction === 'income' && !t.salaryDetails).length
  const cashTxCount = cashAccount ? txCount(status.transactions, cashAccount.id) : 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={m => { setMonth(m); setActiveFlow(null) }} />
      <p className="text-sm text-slate-400 mb-4">בחר תהליך ייבוא:</p>

      <div className="space-y-2">
        {creditAccounts.map(acc => {
          const count = txCount(status.transactions, acc.id)
          return (
            <button
              key={acc.id}
              onClick={() => setActiveFlow({ type: 'credit', accountId: acc.id })}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
                <span className="text-sm font-medium">{acc.name}</span>
              </div>
              <span className="text-xs text-slate-400">{count > 0 ? `${count} עסקאות` : 'לא יובא'}</span>
            </button>
          )
        })}

        {bankAccounts.map(acc => {
          const count = txCount(status.transactions, acc.id)
          const bankType = detectBankType(acc)
          return (
            <button
              key={acc.id}
              onClick={() => setActiveFlow({ type: 'bank', accountId: acc.id, bankType })}
              className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: acc.color }} />
                <span className="text-sm font-medium">{acc.name}</span>
                <span className="text-xs text-slate-500">בנק</span>
              </div>
              <span className="text-xs text-slate-400">{count > 0 ? `${count} עסקאות` : 'לא יובא'}</span>
            </button>
          )
        })}

        <button
          onClick={() => setActiveFlow({ type: 'salary' })}
          className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
        >
          <span className="text-sm font-medium">משכורות</span>
          <span className="text-xs text-slate-400">
            {status.salaryEntries.length > 0
              ? `${status.salaryEntries.length} משכורות — נטו ₪${status.salaryEntries.reduce((s, e) => s + e.netAmount, 0).toLocaleString('he-IL')}`
              : 'לא הוזן'}
          </span>
        </button>

        <button
          onClick={() => setActiveFlow({ type: 'income' })}
          className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
        >
          <span className="text-sm font-medium">הכנסות נוספות</span>
          <span className="text-xs text-slate-400">{incomeTxCount > 0 ? `${incomeTxCount} הכנסות` : 'אין'}</span>
        </button>

        {cashAccount && (
          <button
            onClick={() => setActiveFlow({ type: 'cash' })}
            className="w-full bg-surface rounded-2xl px-4 py-3 flex justify-between items-center hover:bg-surface/80 transition-colors"
          >
            <span className="text-sm font-medium">מזומן</span>
            <span className="text-xs text-slate-400">{cashTxCount > 0 ? `${cashTxCount} הוצאות` : 'אין'}</span>
          </button>
        )}
      </div>
    </main>
  )
}
