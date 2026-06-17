'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { AddTransactionForm } from '@/components/transactions/AddTransactionForm'
import type { Transaction, Category, Account } from '@/lib/types'

export default function TransactionsPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setLoading(true)
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

  const byAccount = accountFilter === 'all'
    ? transactions
    : transactions.filter(t => t.accountId === accountFilter)

  const displayed = categoryFilter === 'all'
    ? byAccount
    : categoryFilter === 'uncategorized'
      ? byAccount.filter(t => !t.categoryId)
      : byAccount.filter(t => t.categoryId === categoryFilter)

  const uncategorizedCount = byAccount.filter(t => !t.categoryId && t.direction !== 'income' && t.amount > 0).length
  // income = direction:income transactions (positive) + refunds (negative amounts on expenses)
  const incomeTotal = displayed
    .filter(t => t.direction === 'income')
    .reduce((s, t) => s + t.amount, 0)
  // expenses = non-income transactions with positive amount; refunds (negative) reduce the expense total
  const expenseTotal = displayed
    .filter(t => t.direction !== 'income')
    .reduce((s, t) => s + t.amount, 0)
  const net = incomeTotal - expenseTotal
  const hasIncome = incomeTotal > 0

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={setMonth} />

      {/* Account tabs — RTL natural order */}
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
        >הכל ({byAccount.length})</button>
        <button
          onClick={() => setCategoryFilter('uncategorized')}
          className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${categoryFilter === 'uncategorized' ? 'bg-amber-600 text-white' : 'bg-surface text-slate-400'}`}
        >ללא קטגוריה ({uncategorizedCount})</button>
        {activeCategories.map(cat => {
          const count = byAccount.filter(t => t.categoryId === cat.id).length
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
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {categoryFilter !== 'all' ? 'אין עסקאות בקטגוריה זו' : 'אין עסקאות בחודש זה'}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl px-4">
          {displayed.map(tx => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              categories={categories}
              onCategoryChange={handleCategoryChange}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
          <div className="py-3 border-t border-slate-700 space-y-1.5">
            {hasIncome && (
              <>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>הכנסות</span>
                  <span className="tabular-nums text-green-400">+₪{incomeTotal.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>הוצאות</span>
                  <span className="tabular-nums text-red-400">-₪{expenseTotal.toLocaleString('he-IL')}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-semibold">
              <span>{hasIncome ? 'נטו' : 'סה"כ'}</span>
              <span className={`tabular-nums ${hasIncome ? (net >= 0 ? 'text-green-400' : 'text-red-400') : ''}`}>
                {hasIncome ? (net >= 0 ? '+' : '-') + '₪' + Math.abs(net).toLocaleString('he-IL') : '₪' + expenseTotal.toLocaleString('he-IL')}
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
