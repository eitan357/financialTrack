'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { addTransactions, deleteTransaction } from '@/lib/firestore/transactions'
import type { Category, Transaction } from '@/lib/types'

interface CashRow {
  id: string
  description: string
  amount: number
  date: string
  categoryId: string | null
}

function emptyRow(month: string): CashRow {
  return { id: crypto.randomUUID(), description: '', amount: 0, date: `${month}-01`, categoryId: null }
}

interface Props {
  month: string
  cashAccountId: string
  categories: Category[]
  existingTransactions: Transaction[]
  onDone: () => void
}

export function CashFlow({ month, cashAccountId, categories, existingTransactions, onDone }: Props) {
  const router = useRouter()
  const [entries, setEntries] = useState<Transaction[]>(existingTransactions)
  const [newRows, setNewRows] = useState<CashRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRow() { setNewRows(prev => [...prev, emptyRow(month)]) }
  function updateRow(i: number, u: Partial<CashRow>) { setNewRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...u } : r)) }
  function removeRow(i: number) { setNewRows(prev => prev.filter((_, idx) => idx !== i)) }

  async function deleteEntry(id: string) {
    if (!window.confirm('למחוק הוצאה זו?')) return
    setSaving(true)
    try {
      await deleteTransaction(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      setError('שגיאה במחיקה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNewRows() {
    const valid = newRows.filter(r => r.description.trim() && r.amount > 0)
    if (valid.length === 0) return
    setSaving(true); setError(null)
    try {
      await addTransactions(valid.map(r => ({
        date: r.date,
        merchantName: r.description.trim(),
        amount: r.amount,
        currency: 'ILS',
        accountId: cashAccountId,
        source: 'manual' as const,
        isImmediate: true,
        month,
        direction: 'expense' as const,
        ...(r.categoryId ? { categoryId: r.categoryId } : {}),
      })))
      setNewRows([])
      onDone()
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-foreground transition-colors">
          <ChevronRight size={22} />
        </button>
        <h2 className="text-lg font-semibold">מזומן — {month}</h2>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-2 mb-4">
        {entries.length === 0 && newRows.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-4">אין הוצאות מזומן לחודש זה</p>
        )}

        {entries.map(entry => (
          <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium">{entry.merchantName}</div>
              <div className="text-xs text-slate-400">{entry.date}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-sm text-red-400">₪{entry.amount.toLocaleString('he-IL')}</span>
              <button onClick={() => deleteEntry(entry.id)} disabled={saving} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {newRows.map((row, i) => (
          <div key={row.id} className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">הוצאה חדשה</span>
              <button onClick={() => removeRow(i)} disabled={saving} className="text-red-400 disabled:opacity-50"><Trash2 size={14} /></button>
            </div>
            <input type="text" placeholder="תיאור" value={row.description}
              onChange={e => updateRow(i, { description: e.target.value })}
              className="w-full bg-background rounded px-3 py-2 text-sm"
              aria-label={`תיאור הוצאה ${i + 1}`}
            />
            <div className="flex gap-2">
              <input type="number" placeholder="סכום" value={row.amount || ''}
                onChange={e => updateRow(i, { amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="flex-1 min-w-0 bg-background rounded px-3 py-2 text-sm tabular-nums"
                aria-label={`סכום הוצאה ${i + 1}`}
              />
              <input type="date" value={row.date}
                onChange={e => updateRow(i, { date: e.target.value })}
                className="flex-1 min-w-0 bg-background rounded px-3 py-2 text-sm"
                aria-label={`תאריך הוצאה ${i + 1}`}
              />
            </div>
            <select value={row.categoryId ?? ''} onChange={e => updateRow(i, { categoryId: e.target.value || null })}
              className="w-full bg-background rounded px-3 py-2 text-sm"
              aria-label={`קטגוריה הוצאה ${i + 1}`}>
              <option value="">— ללא קטגוריה —</option>
              {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הוצאה
      </button>

      {newRows.length > 0 ? (
        <button onClick={saveNewRows} disabled={saving}
          className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
          {saving ? 'שומר...' : `שמור ${newRows.filter(r => r.description && r.amount > 0).length} הוצאות`}
        </button>
      ) : (
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
      )}
    </div>
  )
}
