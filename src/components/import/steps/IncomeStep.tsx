'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { IncomeEntry } from '@/lib/types'

type IncomeRow = Omit<IncomeEntry, 'id'>

interface Props {
  month: string
  initialEntries: IncomeRow[]
  onComplete: (entries: IncomeRow[]) => void
  onBack: () => void
}

function emptyRow(month: string): IncomeRow {
  return { month, sourceName: '', amount: 0, currency: 'ILS', date: new Date().toISOString().split('T')[0] }
}

export function IncomeStep({ month, initialEntries, onComplete, onBack }: Props) {
  const [entries, setEntries] = useState<IncomeRow[]>(initialEntries)

  function addEntry() { setEntries(p => [...p, emptyRow(month)]) }

  function update(i: number, updates: Partial<IncomeRow>) {
    setEntries(p => p.map((e, idx) => idx === i ? { ...e, ...updates } : e))
  }

  function remove(i: number) { setEntries(p => p.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב 4 — הכנסות נוספות</h2>

      {entries.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-6">אין הכנסות נוספות החודש</p>
      )}

      <div className="space-y-3 mb-4">
        {entries.map((entry, i) => (
          <div key={i} className="bg-surface rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">הכנסה {i + 1}</span>
              <button onClick={() => remove(i)} aria-label={`מחק הכנסה ${i + 1}`} className="text-red-400 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input type="text" placeholder="שם מקור (מילואים, בונוס, ...)" value={entry.sourceName}
                onChange={e => update(i, { sourceName: e.target.value })}
                aria-label={`שם מקור הכנסה ${i + 1}`}
                className="w-full bg-background rounded px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <input type="number" placeholder="סכום" value={entry.amount || ''}
                  onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
                  aria-label={`סכום הכנסה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm tabular-nums" />
                <input type="date" value={entry.date}
                  onChange={e => update(i, { date: e.target.value })}
                  aria-label={`תאריך הכנסה ${i + 1}`}
                  className="flex-1 bg-background rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addEntry}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4">
        <Plus size={16} />הוסף הכנסה
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>
        <button onClick={() => onComplete(entries)} className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">הבא →</button>
      </div>
    </div>
  )
}
