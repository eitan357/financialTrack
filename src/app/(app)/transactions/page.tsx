'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { getTransactions, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
import { getCategories } from '@/lib/firestore/categories'
import { getRules, addRule, deleteRule } from '@/lib/firestore/categorization-rules'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { RulesModal } from '@/components/transactions/RulesModal'
import { MonthPicker } from '@/components/MonthPicker'
import type { Transaction, Category, CategorizationRule } from '@/lib/types'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Filter = 'all' | 'uncategorized'

export default function TransactionsPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    async function load() {
      try {
        const [txs, cats, rls] = await Promise.all([
          getTransactions(month),
          getCategories(),
          getRules(),
        ])
        setTransactions(txs)
        setCategories(cats)
        setRules(rls)
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

  const uncategorizedCount = transactions.filter(t => !t.categoryId).length
  const displayed = filter === 'uncategorized'
    ? transactions.filter(t => !t.categoryId)
    : transactions
  const total = displayed.reduce((s, t) => s + t.amount, 0)

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <button
          onClick={() => setPickerOpen(p => !p)}
          aria-label="בחר חודש"
          className="text-base font-semibold hover:text-accent transition-colors"
        >
          {formatMonth(month)}
        </button>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>
      {pickerOpen && (
        <MonthPicker
          value={month}
          onChange={m => { setMonth(m); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full ${filter === 'all' ? 'bg-accent text-white' : 'bg-surface text-slate-400'}`}
          >הכל ({transactions.length})</button>
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
