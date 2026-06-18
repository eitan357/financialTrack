'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { addTransactions, deleteTransaction } from '@/lib/firestore/transactions'
import type { Account, Transaction } from '@/lib/types'

interface IncomeFormRow {
  id: string
  sourceName: string
  amount: number
  date: string
  bankAccountId: string
}

function emptyRow(month: string, defaultBankId: string): IncomeFormRow {
  return { id: crypto.randomUUID(), sourceName: '', amount: 0, date: `${month}-01`, bankAccountId: defaultBankId }
}

interface Props {
  month: string
  existingTransactions: Transaction[]
  bankAccounts: Account[]
  onDone: () => void
  onBack: () => void
}

export function IncomeFlow({ month, existingTransactions, bankAccounts, onDone, onBack }: Props) {
  const defaultBankId = bankAccounts[0]?.id ?? ''
  const [entries, setEntries] = useState<Transaction[]>(existingTransactions)
  const [newRows, setNewRows] = useState<IncomeFormRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRow() {
    setNewRows(prev => [...prev, emptyRow(month, defaultBankId)])
  }

  function updateRow(i: number, updates: Partial<IncomeFormRow>) {
    setNewRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...updates } : r))
  }

  function removeNewRow(i: number) {
    setNewRows(prev => prev.filter((_, idx) => idx !== i))
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('למחוק הכנסה זו?')) return
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
    const valid = newRows.filter(r => r.sourceName.trim() && r.amount > 0)
    if (valid.length === 0) return
    setSaving(true); setError(null)
    try {
      await addTransactions(valid.map(r => ({
        date: r.date,
        merchantName: r.sourceName.trim(),
        amount: r.amount,
        currency: 'ILS',
        accountId: r.bankAccountId || defaultBankId,
        source: 'manual' as const,
        isImmediate: true,
        month,
        direction: 'income' as const,
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
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">הכנסות נוספות — {month}</h2>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-2 mb-4">
        {entries.length === 0 && newRows.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-4">אין הכנסות נוספות לחודש זה</p>
        )}

        {entries.map(entry => (
          <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium">{entry.merchantName}</div>
              <div className="text-xs text-slate-400">{entry.date}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-sm text-green-400">₪{entry.amount.toLocaleString('he-IL')}</span>
              <button onClick={() => deleteEntry(entry.id)} disabled={saving} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {newRows.map((row, i) => (
          <div key={row.id} className="bg-surface rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">הכנסה חדשה</span>
              <button onClick={() => removeNewRow(i)} disabled={saving} className="text-red-400 disabled:opacity-50"><Trash2 size={14} /></button>
            </div>
            <input type="text" placeholder="מקור ההכנסה" value={row.sourceName}
              onChange={e => updateRow(i, { sourceName: e.target.value })}
              className="w-full bg-background rounded px-3 py-2 text-sm"
              aria-label={`שם מקור הכנסה ${i + 1}`}
            />
            <div className="flex gap-2">
              <input type="number" placeholder="סכום" value={row.amount || ''}
                onChange={e => updateRow(i, { amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums"
                aria-label={`סכום הכנסה ${i + 1}`}
              />
              <input type="date" value={row.date}
                onChange={e => updateRow(i, { date: e.target.value })}
                className="flex-1 bg-background rounded px-3 py-2 text-sm"
                aria-label={`תאריך הכנסה ${i + 1}`}
              />
            </div>
            {bankAccounts.length > 0 && (
              <select value={row.bankAccountId} onChange={e => updateRow(i, { bankAccountId: e.target.value })}
                className="w-full bg-background text-foreground text-sm rounded px-3 py-2"
                aria-label={`חשבון בנק הכנסה ${i + 1}`}>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הכנסה
      </button>

      {newRows.length > 0 ? (
        <button onClick={saveNewRows} disabled={saving}
          className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
          {saving ? 'שומר...' : `שמור ${newRows.filter(r => r.sourceName && r.amount > 0).length} הכנסות`}
        </button>
      ) : (
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
      )}
    </div>
  )
}
