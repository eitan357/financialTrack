'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { getAccounts } from '@/lib/firestore/accounts'
import { getRules, addRule, deleteRule } from '@/lib/firestore/categorization-rules'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { RulesModal } from '@/components/transactions/RulesModal'
import type { Transaction, Category, CategorizationRule, Account } from '@/lib/types'

type Filter = 'all' | 'uncategorized'

export default function TransactionsPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [rulesOpen, setRulesOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    async function load() {
      try {
        const [txs, cats, rls, accs] = await Promise.all([
          getTransactions(month),
          getCategories(),
          getRules(),
          getAccounts(),
        ])
        setTransactions(txs)
        setCategories(cats)
        setRules(rls)
        setAccounts(accs)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  async function handleCategoryChange(transactionId: string, categoryId: string | undefined) {
    await updateTransaction(transactionId, { categoryId })
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, categoryId } : t))
  }

  async function handleUpdate(transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) {
    // Keep month in sync when date changes
    if (updates.date) updates.month = updates.date.slice(0, 7)
    await updateTransaction(transactionId, updates)
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, ...updates } : t))
  }

  async function handleDelete(transactionId: string) {
    await deleteTransaction(transactionId)
    setTransactions(prev => prev.filter(t => t.id !== transactionId))
  }

  async function handleAddRule(rule: Omit<CategorizationRule, 'id'>) {
    const newRule = await addRule(rule)
    setRules(prev => [...prev, newRule])
  }

  async function handleDeleteRule(ruleId: string) {
    await deleteRule(ruleId)
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  const activeAccounts = accounts.filter(a => a.isActive)
  const byAccount = accountFilter === 'all'
    ? transactions
    : transactions.filter(t => t.accountId === accountFilter)
  const uncategorizedCount = byAccount.filter(t => !t.categoryId).length
  const displayed = filter === 'uncategorized'
    ? byAccount.filter(t => !t.categoryId)
    : byAccount
  const total = displayed.reduce((s, t) => s + t.amount, 0)

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={setMonth} />

      {activeAccounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 no-scrollbar" dir="ltr">
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

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full ${filter === 'all' ? 'bg-accent text-white' : 'bg-surface text-slate-400'}`}
          >הכל ({byAccount.length})</button>
          <button
            onClick={() => setFilter('uncategorized')}
            className={`text-xs px-3 py-1.5 rounded-full ${filter === 'uncategorized' ? 'bg-amber-600 text-white' : 'bg-surface text-slate-400'}`}
          >ללא קטגוריה ({uncategorizedCount})</button>
        </div>
        <button onClick={() => setRulesOpen(true)} className="text-xs text-accent">חוקים</button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {filter === 'uncategorized' ? 'כל העסקאות מקוטלגות!' : 'אין עסקאות בחודש זה'}
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
          <div className="py-3 flex justify-between text-sm font-semibold border-t border-slate-700">
            <span>סה&quot;כ</span>
            <span className="tabular-nums">₪{total.toLocaleString('he-IL')}</span>
          </div>
        </div>
      )}

      <RulesModal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
        rules={rules}
        categories={categories}
        onAdd={handleAddRule}
        onDelete={handleDeleteRule}
      />
    </main>
  )
}
