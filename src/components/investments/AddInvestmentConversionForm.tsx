import { useState } from 'react'
import type { InvestmentType, InvestmentConversion, Account } from '@/lib/types'
import { SelectField } from '@/components/ui/SelectField'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  types: InvestmentType[]
  bankAccounts?: Account[]
  onSubmit: (conv: Omit<InvestmentConversion, 'id'>) => void
  onCancel: () => void
}

export function AddInvestmentConversionForm({ types, bankAccounts = [], onSubmit, onCancel }: Props) {
  const [typeId, setTypeId] = useState('')
  const [ilsReceived, setIlsReceived] = useState('')
  const [foreignAmountReduced, setForeignAmountReduced] = useState('')
  const [date, setDate] = useState(todayISO)
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [errors, setErrors] = useState<{ typeId?: string; ilsReceived?: string }>({})

  const selectedType = types.find(t => t.id === typeId)
  const hasForeignCurrency = selectedType !== undefined && selectedType.currency !== 'ILS'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!typeId) errs.typeId = 'יש לבחור ערך'
    if (!ilsReceived || parseFloat(ilsReceived) <= 0) errs.ilsReceived = 'יש להזין סכום חיובי'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (!date) return
    setErrors({})
    onSubmit({
      investmentTypeId: typeId,
      ilsReceived: parseFloat(ilsReceived),
      date,
      month: date.slice(0, 7),
      ...(foreignAmountReduced && parseFloat(foreignAmountReduced) > 0 ? { foreignAmountReduced: parseFloat(foreignAmountReduced) } : {}),
      ...(destinationAccountId ? { destinationAccountId } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-4 space-y-3">
      <div>
        <label htmlFor="conv-type" className="text-xs text-slate-400 block mb-1">סוג השקעה</label>
        <SelectField
          value={typeId}
          onChange={v => { setTypeId(v); if (errors.typeId && v) setErrors(p => ({ ...p, typeId: undefined })) }}
          options={types.map(t => ({ value: t.id, label: t.name }))}
          placeholder="בחר סוג..."
          error={!!errors.typeId}
        />
        {errors.typeId && <p className="text-xs text-red-400 mt-1">{errors.typeId}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="conv-ils" className="text-xs text-slate-400 block mb-1">התקבל ב-₪</label>
          <input
            id="conv-ils"
            type="number"
            min="0"
            step="0.01"
            value={ilsReceived}
            onChange={e => { setIlsReceived(e.target.value); if (errors.ilsReceived && parseFloat(e.target.value) > 0) setErrors(p => ({ ...p, ilsReceived: undefined })) }}
            placeholder="0"
            className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-sm text-foreground ${errors.ilsReceived ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-600'}`}
          />
          {errors.ilsReceived && <p className="text-xs text-red-400 mt-1">{errors.ilsReceived}</p>}
        </div>
        <div>
          <label htmlFor="conv-date" className="text-xs text-slate-400 block mb-1">תאריך</label>
          <input
            id="conv-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      {hasForeignCurrency && (
        <div>
          <label htmlFor="conv-foreign" className="text-xs text-slate-400 block mb-1">הופחת ({selectedType.currency})</label>
          <input
            id="conv-foreign"
            type="number"
            min="0"
            step="0.01"
            value={foreignAmountReduced}
            onChange={e => setForeignAmountReduced(e.target.value)}
            placeholder="אופציונלי"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
      )}

      {bankAccounts.length > 0 && (
        <div>
          <label htmlFor="conv-dest" className="text-xs text-slate-400 block mb-1">חשבון שקיבל</label>
          <select
            id="conv-dest"
            value={destinationAccountId}
            onChange={e => setDestinationAccountId(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-foreground"
          >
            <option value="">בחר חשבון (אופציונלי)...</option>
            {bankAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} aria-label="ביטול" className="text-sm text-slate-400 px-4 py-2">ביטול</button>
        <button type="submit" aria-label="הוסף" className="bg-accent text-white text-sm px-4 py-2 rounded-lg">הוסף</button>
      </div>
    </form>
  )
}
