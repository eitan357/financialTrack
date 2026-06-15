'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Category } from '@/lib/types'
import type { CashExpense } from '../ImportWizard'

interface Props {
  month: string
  categories: Category[]
  initialExpenses: CashExpense[]
  onComplete: (expenses: CashExpense[]) => void
  onBack: () => void
}

function emptyExpense(): CashExpense {
  return { description: '', amount: 0, date: new Date().toISOString().split('T')[0], categoryId: null }
}

export function CashStep({ categories, initialExpenses, onComplete, onBack }: Props) {
  const [expenses, setExpenses] = useState<CashExpense[]>(initialExpenses)

  function add() { setExpenses(p => [...p, emptyExpense()]) }

  function update(i: number, u: Partial<CashExpense>) {
    setExpenses(p => p.map((e, idx) => idx === i ? { ...e, ...u } : e))
  }

  function remove(i: number) { setExpenses(p => p.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב 5 — מזומן</h2>

      {expenses.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-6">אין הוצאות מזומן</p>
      )}

      <div className="space-y-3 mb-4">
        {expenses.map((exp, i) => (
          <div key={i} className="bg-surface rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">הוצאה {i + 1}</span>
              <button onClick={() => remove(i)} aria-label={`מחק הוצאה ${i + 1}`} className="text-red-400 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input type="text" placeholder="תיאור" value={exp.description}
                onChange={e => update(i, { description: e.target.value })}
                aria-label={`תיאור הוצאה ${i + 1}`}
                className="w-full bg-background rounded px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <input type="number" placeholder="סכום" value={exp.amount || ''}
                  onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
                  aria-label={`סכום הוצאה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums" />
                <input type="date" value={exp.date}
                  onChange={e => update(i, { date: e.target.value })}
                  aria-label={`תאריך הוצאה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm" />
              </div>
              <select value={exp.categoryId ?? ''} onChange={e => update(i, { categoryId: e.target.value || null })}
                aria-label={`קטגוריה הוצאה ${i + 1}`}
                className="w-full bg-background rounded px-3 py-2 text-sm">
                <option value="">— ללא קטגוריה —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      <button onClick={add}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הוצאה
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>
        <button onClick={() => onComplete(expenses)} className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">סיכום →</button>
      </div>
    </div>
  )
}
