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
  const [errors, setErrors] = useState<{ typeId?: string; amount?: string }>({})

  const selectedType = types.find(t => t.id === typeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!typeId) errs.typeId = 'יש לבחור ערך'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'יש להזין סכום חיובי'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (!date || !selectedType) return
    setErrors({})
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
          onChange={e => { setTypeId(e.target.value); if (errors.typeId && e.target.value) setErrors(p => ({ ...p, typeId: undefined })) }}
          className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-sm text-foreground ${errors.typeId ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-600'}`}
        >
          <option value="">בחר סוג...</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {errors.typeId && <p className="text-xs text-red-400 mt-1">{errors.typeId}</p>}
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
            onChange={e => { setAmount(e.target.value); if (errors.amount && parseFloat(e.target.value) > 0) setErrors(p => ({ ...p, amount: undefined })) }}
            placeholder="0"
            className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-sm text-foreground ${errors.amount ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-600'}`}
          />
          {errors.amount && <p className="text-xs text-red-400 mt-1">{errors.amount}</p>}
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
        <button type="submit" aria-label="הוסף" className="bg-accent text-white text-sm px-4 py-2 rounded-lg">הוסף</button>
      </div>
    </form>
  )
}
