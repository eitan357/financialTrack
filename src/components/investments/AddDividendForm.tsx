import { useState } from 'react'
import type { InvestmentType, Dividend, Account } from '@/lib/types'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  types: InvestmentType[]
  bankAccounts?: Account[]
  onSubmit: (dividend: Omit<Dividend, 'id'>) => void
  onCancel: () => void
}

export function AddDividendForm({ types, bankAccounts = [], onSubmit, onCancel }: Props) {
  const [typeId, setTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [ilsEquivalent, setIlsEquivalent] = useState('')
  const [date, setDate] = useState(todayISO)
  const [staysInPortfolio, setStaysInPortfolio] = useState(true)
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [errors, setErrors] = useState<{ typeId?: string; amount?: string; destination?: string }>({})

  const selectedType = types.find(t => t.id === typeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!typeId) errs.typeId = 'יש לבחור ערך'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'יש להזין סכום חיובי'
    if (!staysInPortfolio && !destinationAccountId) errs.destination = 'יש לבחור חשבון יעד'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (!date || !selectedType) return
    setErrors({})
    const result: Omit<Dividend, 'id'> = {
      investmentTypeId: typeId,
      amount: parseFloat(amount),
      currency: selectedType.currency,
      date,
      month: date.slice(0, 7),
      staysInPortfolio,
      ...(staysInPortfolio ? {} : { destinationAccountId }),
    }
    if (ilsEquivalent) result.ilsEquivalent = parseFloat(ilsEquivalent)
    onSubmit(result)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        <button type="button"
          onClick={() => setStaysInPortfolio(true)}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${staysInPortfolio ? 'bg-accent/20 text-accent' : 'text-slate-400'}`}>
          נשאר בתיק
        </button>
        <button type="button"
          onClick={() => setStaysInPortfolio(false)}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${!staysInPortfolio ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}>
          הועבר לבנק
        </button>
      </div>

      <div>
        <label htmlFor="div-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
        <select
          id="div-type"
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
          <label htmlFor="div-amount" className="text-xs text-slate-400 block mb-1">סכום</label>
          <input
            id="div-amount"
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
          <label htmlFor="div-ils" className="text-xs text-slate-400 block mb-1">שווי ב-₪</label>
          <input
            id="div-ils"
            type="number"
            min="0"
            step="0.01"
            value={ilsEquivalent}
            onChange={e => setIlsEquivalent(e.target.value)}
            placeholder="אופציונלי"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      {!staysInPortfolio && bankAccounts.length > 0 && (
        <div>
          <label htmlFor="div-dest" className="text-xs text-slate-400 block mb-1">חשבון יעד</label>
          <select
            id="div-dest"
            value={destinationAccountId}
            onChange={e => { setDestinationAccountId(e.target.value); if (errors.destination) setErrors(p => ({ ...p, destination: undefined })) }}
            className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-sm text-foreground ${errors.destination ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-600'}`}
          >
            <option value="">בחר חשבון...</option>
            {bankAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {errors.destination && <p className="text-xs text-red-400 mt-1">{errors.destination}</p>}
        </div>
      )}

      <div>
        <label htmlFor="div-date" className="text-xs text-slate-400 block mb-1">תאריך</label>
        <input
          id="div-date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" className="bg-accent text-white text-sm px-4 py-2 rounded-lg">הוסף</button>
      </div>
    </form>
  )
}
