'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { AddTransactionForm } from '@/components/transactions/AddTransactionForm'
import { computeCreditPayments } from '@/lib/creditPayment'
import type { Transaction, Category, Account } from '@/lib/types'
import type { CreditPaymentInfo } from '@/lib/creditPayment'

type DisplayItem =
  | { kind: 'tx'; tx: Transaction }
  | { kind: 'cp'; info: CreditPaymentInfo }

function CreditPaymentRow({ info }: { info: CreditPaymentInfo }) {
  const parts = info.date.split('-')
  const dd = parts[2]
  const mm = parts[1]
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: info.creditColor }} />
        <span className="text-sm truncate">תשלום {info.creditAccountName}</span>
      </div>
      <span className="text-sm tabular-nums text-red-400 flex-shrink-0" dir="ltr">
        ₪-{info.amount.toLocaleString('he-IL')}
      </span>
    </div>
  )
}

export default function TransactionsPage() {
  const router = useRouter()
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const [txs, cats, accs] = await Promise.all([
          getTransactions(month),
          getCategories(),
          getAccounts(),
        ])
        setTransactions(txs)
        setCategories(cats)
        setAccounts(accs)
      } catch (e) {
        setError('שגיאה בטעינת העסקאות. בדוק את חיבור הרשת.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month, reloadKey])

  async function handleCategoryChange(transactionId: string, categoryId: string | undefined) {
    await updateTransaction(transactionId, { categoryId })
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, categoryId } : t))
  }

  async function handleUpdate(transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) {
    if (updates.date) updates.month = updates.date.slice(0, 7)
    await updateTransaction(transactionId, updates)
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, ...updates } : t))
  }

  async function handleDelete(transactionId: string) {
    await deleteTransaction(transactionId)
    setTransactions(prev => prev.filter(t => t.id !== transactionId))
  }

  const activeAccounts = accounts.filter(a => a.isActive)
  const activeCategories = categories.filter(c => c.isActive)

  // Build a fast lookup for account type
  const accountTypeMap = Object.fromEntries(accounts.map(a => [a.id, a.type]))

  // Compute credit payment summary rows (virtual, not stored)
  const creditPayments = computeCreditPayments(accounts, transactions, month)

  // Determine base set of transactions and credit payment rows for the current account tab
  const selectedAccount = accountFilter !== 'all' ? accounts.find(a => a.id === accountFilter) : null

  let baseTransactions: Transaction[]
  let baseCreditPayments: CreditPaymentInfo[]

  if (accountFilter === 'all') {
    // All tab: bank + cash transactions + all credit payment rows
    // Cash salary transactions are excluded — they appear as part of the bank salary entry
    baseTransactions = transactions.filter(t => {
      const type = accountTypeMap[t.accountId]
      if (type !== 'bank' && type !== 'cash') return false
      if (t.salaryDetails && type === 'cash') return false
      return true
    })
    baseCreditPayments = creditPayments
  } else if (selectedAccount?.type === 'bank') {
    // Bank tab: bank's own transactions + credit payments linked to this bank
    baseTransactions = transactions.filter(t => t.accountId === accountFilter)
    baseCreditPayments = creditPayments.filter(cp => cp.bankAccountId === accountFilter)
  } else {
    // Credit or cash tab: only that account's transactions, no virtual rows
    baseTransactions = transactions.filter(t => t.accountId === accountFilter)
    baseCreditPayments = []
  }

  // Apply category filter to real transactions only
  const filteredTx = categoryFilter === 'all'
    ? baseTransactions
    : categoryFilter === 'uncategorized'
      ? baseTransactions.filter(t => !t.categoryId)
      : baseTransactions.filter(t => t.categoryId === categoryFilter)

  // Credit payment rows only show when category filter is 'all'
  const visibleCreditPayments = categoryFilter === 'all' ? baseCreditPayments : []

  // Combine and sort by date descending
  const displayItems: DisplayItem[] = [
    ...filteredTx.map(tx => ({ kind: 'tx' as const, tx })),
    ...visibleCreditPayments.map(info => ({ kind: 'cp' as const, info })),
  ].sort((a, b) => {
    const da = a.kind === 'tx' ? a.tx.date : a.info.date
    const db = b.kind === 'tx' ? b.tx.date : b.info.date
    return db.localeCompare(da)
  })

  const uncategorizedCount = baseTransactions.filter(t => !t.categoryId && t.direction !== 'income' && t.amount > 0).length

  const incomeTotal = filteredTx.filter(t => t.direction === 'income').reduce((s, t) => {
    if (accountFilter === 'all' && t.salaryDetails) return s + t.salaryDetails.netAmount
    return s + t.amount
  }, 0)
  const expenseTotal = filteredTx.filter(t => t.direction !== 'income').reduce((s, t) => s + t.amount, 0)
    + visibleCreditPayments.reduce((s, cp) => s + cp.amount, 0)
  const net = incomeTotal - expenseTotal
  const hasIncome = incomeTotal > 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={setMonth} />

      {/* Account tabs */}
      {activeAccounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 no-scrollbar">
          <button
            onClick={() => setAccountFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${accountFilter === 'all' ? 'bg-slate-600 text-white' : 'bg-surface text-slate-400'}`}
          >הכל</button>
          {activeAccounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => setAccountFilter(acc.id)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${accountFilter === acc.id ? 'text-white' : 'bg-surface text-slate-400'}`}
              style={accountFilter === acc.id ? { backgroundColor: acc.color } : undefined}
            >{acc.name}</button>
          ))}
        </div>
      )}

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${categoryFilter === 'all' ? 'bg-accent text-white' : 'bg-surface text-slate-400'}`}
        >הכל ({baseTransactions.length + baseCreditPayments.length})</button>
        <button
          onClick={() => setCategoryFilter('uncategorized')}
          className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${categoryFilter === 'uncategorized' ? 'bg-amber-600 text-white' : 'bg-surface text-slate-400'}`}
        >ללא קטגוריה ({uncategorizedCount})</button>
        {activeCategories.map(cat => {
          const count = baseTransactions.filter(t => t.categoryId === cat.id).length
          if (count === 0) return null
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${categoryFilter === cat.id ? 'text-white' : 'bg-surface text-slate-400'}`}
              style={categoryFilter === cat.id ? { backgroundColor: cat.color } : undefined}
            >{cat.name} ({count})</button>
          )
        })}
      </div>

      {showAddForm && (
        <AddTransactionForm
          month={month}
          accounts={accounts}
          categories={categories}
          defaultAccountId={accountFilter !== 'all' ? accountFilter : undefined}
          onSaved={() => { setShowAddForm(false); setReloadKey(k => k + 1) }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {categoryFilter !== 'all' ? 'אין עסקאות בקטגוריה זו' : 'אין עסקאות בחודש זה'}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl px-4">
          {displayItems.map(item =>
            item.kind === 'tx' ? (
              <TransactionRow
                key={item.tx.id}
                transaction={item.tx}
                categories={categories}
                onCategoryChange={handleCategoryChange}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                displayAmount={accountFilter === 'all' && item.tx.salaryDetails ? item.tx.salaryDetails.netAmount : undefined}
                onEditSalary={item.tx.salaryDetails ? () => router.push(`/import/salary?month=${month}`) : undefined}
                accountLabel={accountFilter === 'all'
                  ? (item.tx.salaryDetails && (item.tx.salaryDetails.cashAmount ?? 0) > 0
                    ? 'משכורת'
                    : accounts.find(a => a.id === item.tx.accountId)?.name)
                  : undefined}
              />
            ) : (
              <CreditPaymentRow key={`cp-${item.info.creditAccountId}`} info={item.info} />
            )
          )}
          <div className="py-3 border-t border-slate-700 space-y-1.5">
            {hasIncome && (
              <>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>הכנסות</span>
                  <span className="tabular-nums text-green-400" dir="ltr">₪{incomeTotal.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>הוצאות</span>
                  <span className="tabular-nums text-red-400" dir="ltr">₪-{expenseTotal.toLocaleString('he-IL')}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span>{hasIncome ? 'נטו' : 'סה"כ'}</span>
              <span className={`tabular-nums ${hasIncome ? (net >= 0 ? 'text-green-400' : 'text-red-400') : ''}`} dir="ltr">
                {hasIncome
                  ? (net >= 0 ? '₪' : '₪-') + Math.abs(net).toLocaleString('he-IL')
                  : '₪' + expenseTotal.toLocaleString('he-IL')}
              </span>
            </div>
          </div>
        </div>
      )}

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg"
        >+ הוסף עסקה</button>
      )}
    </main>
  )
}
