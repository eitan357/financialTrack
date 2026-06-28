'use client'
import { useState } from 'react'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Account, Category } from '@/lib/types'
import { FormField } from '@/components/ui/FormField'
import { DirectionToggle } from '@/components/ui/DirectionToggle'
import { CurrencyPicker } from '@/components/ui/CurrencyPicker'
import { SelectField } from '@/components/ui/SelectField'

interface Props {
  month: string
  accounts: Account[]
  categories: Category[]
  defaultAccountId?: string
  onSaved: () => void
  onClose: () => void
}

export function AddTransactionForm({ month, accounts, categories, defaultAccountId, onSaved, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ILS')
  const [direction, setDirection] = useState<'expense' | 'income'>('expense')
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts.find(a => a.isActive && a.type !== 'investment')?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({})

  async function save() {
    const errs: { name?: string; amount?: string } = {}
    if (!name.trim()) errs.name = 'שדה חובה'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'יש להזין סכום חיובי'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    setError(null)
    try {
      await addTransactions([{
        date,
        merchantName: name.trim(),
        amount: parseFloat(amount) || 0,
        currency,
        accountId,
        source: 'manual',
        isImmediate: true,
        month,
        direction,
        ...(direction === 'expense' && categoryId ? { categoryId } : {}),
      }])
      onSaved()
    } catch (e) {
      console.error(e)
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface rounded-2xl p-4 mb-4 space-y-3">
      <h3 className="font-semibold text-sm">הוספת עסקה</h3>

      <DirectionToggle value={direction} onChange={setDirection} />

      <FormField label="תאריך">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </FormField>

      <FormField label={direction === 'income' ? 'מקור ההכנסה' : 'שם עסק'} error={errors.name}>
        <input value={name}
          onChange={e => { setName(e.target.value); if (errors.name && e.target.value.trim()) setErrors(p => ({ ...p, name: undefined })) }}
          placeholder={direction === 'income' ? 'למשל: שם מעסיק' : 'שם עסק'}
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${errors.name ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
      </FormField>

      <FormField label="סכום" error={errors.amount}>
        <div className="flex gap-2">
          <input type="number" value={amount}
            onChange={e => { setAmount(e.target.value); if (errors.amount && parseFloat(e.target.value) > 0) setErrors(p => ({ ...p, amount: undefined })) }}
            step="0.01" min="0"
            className={`flex-1 bg-background rounded-lg px-3 py-2 text-sm outline-none tabular-nums ${errors.amount ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </div>
      </FormField>

      <FormField label="חשבון">
        <select value={accountId} onChange={e => setAccountId(e.target.value)}
          className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 ring-accent">
          {accounts.filter(a => a.isActive && a.type !== 'investment').map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

      {direction === 'expense' && (
        <FormField label="קטגוריה">
          <SelectField
            value={categoryId}
            onChange={setCategoryId}
            options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))}
            nullable
            nullLabel="— ללא —"
            placeholder="— ללא —"
          />
        </FormField>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 py-2.5 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-2.5 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}
