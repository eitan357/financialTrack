'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { addTransactions, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
import type { Category, Transaction } from '@/lib/types'

interface CashRow {
  id: string
  description: string
  amount: number
  date: string
  categoryId: string | null
  direction: 'income' | 'expense'
}

interface EditValues {
  description: string
  amount: number
  date: string
  categoryId: string | null
  direction: 'income' | 'expense'
}

function emptyRow(month: string): CashRow {
  return { id: crypto.randomUUID(), description: '', amount: 0, date: `${month}-01`, categoryId: null, direction: 'income' }
}

function DirectionToggle({ value, onChange }: { value: 'income' | 'expense'; onChange: (v: 'income' | 'expense') => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-700">
      <button type="button" onClick={() => onChange('expense')}
        className={`flex-1 py-2 text-sm font-medium transition-colors ${value === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'}`}>
        הוצאה
      </button>
      <button type="button" onClick={() => onChange('income')}
        className={`flex-1 py-2 text-sm font-medium transition-colors ${value === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}>
        הכנסה
      </button>
    </div>
  )
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRow() { setNewRows(prev => [...prev, emptyRow(month)]) }
  function updateRow(i: number, u: Partial<CashRow>) { setNewRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...u } : r)) }
  function removeRow(i: number) { setNewRows(prev => prev.filter((_, idx) => idx !== i)) }

  function startEdit(entry: Transaction) {
    setEditingId(entry.id)
    setEditValues({
      description: entry.merchantName,
      amount: entry.amount,
      date: entry.date,
      categoryId: entry.categoryId ?? null,
      direction: entry.direction ?? 'expense',
    })
  }

  function cancelEdit() { setEditingId(null); setEditValues(null) }

  async function saveEdit() {
    if (!editingId || !editValues || !editValues.description.trim() || editValues.amount <= 0) return
    setSaving(true); setError(null)
    try {
      await updateTransaction(editingId, {
        merchantName: editValues.description.trim(),
        amount: editValues.amount,
        date: editValues.date,
        direction: editValues.direction,
        ...(editValues.categoryId ? { categoryId: editValues.categoryId } : { categoryId: undefined }),
      })
      setEntries(prev => prev.map(e => e.id === editingId ? {
        ...e,
        merchantName: editValues.description.trim(),
        amount: editValues.amount,
        date: editValues.date,
        direction: editValues.direction,
        categoryId: editValues.categoryId ?? undefined,
      } : e))
      cancelEdit()
    } catch {
      setError('שגיאה בעדכון. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('למחוק פעולה זו?')) return
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
        direction: r.direction,
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
          <p className="text-slate-400 text-sm text-center py-4">אין פעולות מזומן לחודש זה</p>
        )}

        {entries.map(entry => {
          if (editingId === entry.id && editValues) {
            return (
              <div key={entry.id} className="bg-surface rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
                  <p className="text-sm font-medium">עריכת פעולה</p>
                  <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-foreground">ביטול</button>
                </div>
                <DirectionToggle value={editValues.direction}
                  onChange={dir => setEditValues(v => v ? { ...v, direction: dir } : v)} />
                <div>
                  <label className="block text-xs text-slate-400 mb-1">תיאור</label>
                  <input type="text" value={editValues.description}
                    onChange={e => setEditValues(v => v ? { ...v, description: e.target.value } : v)}
                    className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-slate-400 mb-1">סכום (₪)</label>
                    <input type="number" value={editValues.amount || ''}
                      onChange={e => setEditValues(v => v ? { ...v, amount: Math.max(0, parseFloat(e.target.value) || 0) } : v)}
                      className="w-full bg-background rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:ring-1 ring-accent"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-slate-400 mb-1">תאריך</label>
                    <input type="date" value={editValues.date}
                      onChange={e => setEditValues(v => v ? { ...v, date: e.target.value } : v)}
                      dir="rtl"
                      className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">קטגוריה</label>
                  <select value={editValues.categoryId ?? ''}
                    onChange={e => setEditValues(v => v ? { ...v, categoryId: e.target.value || null } : v)}
                    className="w-full bg-background text-foreground rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent">
                    <option value="">— ללא קטגוריה —</option>
                    {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={cancelEdit} className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
                  <button onClick={saveEdit} disabled={saving || !editValues.description.trim() || editValues.amount <= 0}
                    className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
                    {saving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
              </div>
            )
          }

          const isIncome = (entry.direction ?? 'expense') === 'income'
          return (
            <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{entry.merchantName}</div>
                <div className="text-xs text-slate-400">{entry.date}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`tabular-nums text-sm ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                  {isIncome ? '+' : ''}₪{entry.amount.toLocaleString('he-IL')}
                </span>
                <button onClick={() => startEdit(entry)} disabled={saving}
                  className="text-xs text-accent hover:underline disabled:opacity-50">
                  ערוך
                </button>
                <button onClick={() => deleteEntry(entry.id)} disabled={saving}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}

        {newRows.map((row, i) => (
          <div key={row.id} className="bg-surface rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
              <p className="text-sm font-medium">{row.direction === 'income' ? 'הכנסה חדשה' : 'הוצאה חדשה'}</p>
              <button onClick={() => removeRow(i)} disabled={saving} className="text-red-400 disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            </div>
            <DirectionToggle value={row.direction} onChange={dir => updateRow(i, { direction: dir })} />
            <div>
              <label className="block text-xs text-slate-400 mb-1">תיאור</label>
              <input type="text" placeholder="למשל: שם מעסיק / שם עסק" value={row.description}
                onChange={e => updateRow(i, { description: e.target.value })}
                className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
                aria-label={`תיאור פעולה ${i + 1}`}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-slate-400 mb-1">סכום (₪)</label>
                <input type="number" placeholder="0" value={row.amount || ''}
                  onChange={e => updateRow(i, { amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-background rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:ring-1 ring-accent"
                  aria-label={`סכום פעולה ${i + 1}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-slate-400 mb-1">תאריך</label>
                <input type="date" value={row.date}
                  onChange={e => updateRow(i, { date: e.target.value })}
                  dir="rtl"
                  className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
                  aria-label={`תאריך פעולה ${i + 1}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">קטגוריה</label>
              <select value={row.categoryId ?? ''} onChange={e => updateRow(i, { categoryId: e.target.value || null })}
                className="w-full bg-background text-foreground rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
                aria-label={`קטגוריה פעולה ${i + 1}`}>
                <option value="">— ללא קטגוריה —</option>
                {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף פעולה
      </button>

      {newRows.length > 0 ? (
        <button onClick={saveNewRows} disabled={saving}
          className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
          {saving ? 'שומר...' : `שמור ${newRows.filter(r => r.description && r.amount > 0).length} פעולות`}
        </button>
      ) : (
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
      )}
    </div>
  )
}
