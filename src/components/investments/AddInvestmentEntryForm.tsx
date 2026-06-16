import { useState } from 'react'
import type { InvestmentType, InvestmentEntry } from '@/lib/types'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  types: InvestmentType[]
  onSubmit: (entry: Omit<InvestmentEntry, 'id'>) => void
  onCancel: () => void
}

export function AddInvestmentEntryForm({ types, onSubmit, onCancel }: Props) {
  const [typeId, setTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)

  const selectedType = types.find(t => t.id === typeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeId || !amount || !date || !selectedType) return
    onSubmit({
      investmentTypeId: typeId,
      amount: parseFloat(amount),
      currency: selectedType.currency,
      date,
      month: date.slice(0, 7),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div>
        <label htmlFor="inv-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
        <select
          id="inv-type"
          value={typeId}
          onChange={e => setTypeId(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="">בחר סוג...</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="inv-amount" className="text-xs text-slate-400 block mb-1">סכום</label>
          <input
            id="inv-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="inv-date" className="text-xs text-slate-400 block mb-1">תאריך</label>
          <input
            id="inv-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" className="bg-accent text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40" disabled={!typeId || !amount}>הוסף</button>
      </div>
    </form>
  )
}
