import { useState } from 'react'
import type { InvestmentType } from '@/lib/types'

interface Props {
  onSubmit: (type: Omit<InvestmentType, 'id'>) => void
  onCancel: () => void
}

export function AddInvestmentTypeForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [nameError, setNameError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameError('שדה חובה'); return }
    if (!currency.trim()) return
    setNameError(null)
    onSubmit({ name: name.trim(), currency: currency.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="type-name" className="text-xs text-slate-400 block mb-1">שם</label>
          <input
            id="type-name"
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); if (nameError && e.target.value.trim()) setNameError(null) }}
            placeholder="למשל: MSTY"
            className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500 ${nameError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-600'}`}
          />
          {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
        </div>
        <div>
          <label htmlFor="type-currency" className="text-xs text-slate-400 block mb-1">מטבע</label>
          <input
            id="type-currency"
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            placeholder="USD"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" disabled={!name.trim()} className="bg-accent text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40">הוסף</button>
      </div>
    </form>
  )
}
