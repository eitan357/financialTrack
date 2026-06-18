'use client'
import { useState } from 'react'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Account, Category, SalaryDeductions } from '@/lib/types'
import { FormField } from '@/components/ui/FormField'

const EMPTY_DEDUCTIONS: SalaryDeductions = { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }

const DEDUCTION_LABELS: [keyof SalaryDeductions, string][] = [
  ['incomeTax',         'מס הכנסה'],
  ['nationalInsurance', 'ביטוח לאומי'],
  ['healthInsurance',   'ביטוח בריאות'],
  ['pension',           'פנסיה'],
  ['trainingFund',      'קרן השתלמות'],
]

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
  const [direction, setDirection] = useState<'expense' | 'income'>('expense')
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts.find(a => a.isActive)?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [showSalary, setShowSalary] = useState(false)
  const [deductions, setDeductions] = useState<SalaryDeductions>(EMPTY_DEDUCTIONS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({})

  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)
  const grossAmount = parseFloat(amount) || 0
  const netAmount = Math.max(0, grossAmount - totalDeductions)

  function updateDeduction(key: keyof SalaryDeductions, val: number) {
    setDeductions(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    const errs: { name?: string; amount?: string } = {}
    if (!name.trim()) errs.name = 'שדה חובה'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'יש להזין סכום חיובי'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    setError(null)
    try {
      const finalAmount = direction === 'income' && showSalary ? netAmount : grossAmount
      await addTransactions([{
        date,
        merchantName: name.trim(),
        amount: finalAmount,
        currency: 'ILS',
        accountId,
        source: 'manual',
        isImmediate: true,
        month,
        direction,
        ...(direction === 'expense' && categoryId ? { categoryId } : {}),
        ...(direction === 'income' && showSalary ? {
          salaryDetails: { grossAmount, deductions, netAmount, employerName: name.trim() }
        } : {}),
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

      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        <button
          onClick={() => setDirection('expense')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'}`}
        >הוצאה</button>
        <button
          onClick={() => setDirection('income')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}
        >הכנסה</button>
      </div>

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

      <FormField label={direction === 'income' && showSalary ? 'ברוטו (₪)' : 'סכום (₪)'} error={errors.amount}>
        <input type="number" value={amount}
          onChange={e => { setAmount(e.target.value); if (errors.amount && parseFloat(e.target.value) > 0) setErrors(p => ({ ...p, amount: undefined })) }}
          step="0.01" min="0"
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none tabular-nums ${errors.amount ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
      </FormField>

      <FormField label="חשבון">
        <select value={accountId} onChange={e => setAccountId(e.target.value)}
          className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 ring-accent">
          {accounts.filter(a => a.isActive).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

      {direction === 'expense' && (
        <FormField label="קטגוריה">
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 ring-accent">
            <option value="">— ללא —</option>
            {categories.filter(c => c.isActive).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>
      )}

      {direction === 'income' && (
        <button onClick={() => setShowSalary(v => !v)}
          className="text-xs text-accent underline text-right w-full">
          {showSalary ? '— הסתר פירוט ניכויים' : '+ הוסף פירוט ניכויים (משכורת)'}
        </button>
      )}

      {direction === 'income' && showSalary && (
        <div className="bg-background rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-400 font-medium">ניכויים</p>
          {DEDUCTION_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <label className="flex-1 text-xs">{label}</label>
              <input type="number" value={deductions[key] || ''} onChange={e => updateDeduction(key, parseFloat(e.target.value) || 0)}
                className="w-24 bg-surface rounded px-2 py-1 text-left tabular-nums text-xs outline-none focus:ring-1 ring-accent" />
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t border-slate-700">
            <span className="text-xs text-slate-400">נטו</span>
            <span className="text-sm font-bold tabular-nums text-green-400" dir="ltr">₪{netAmount.toLocaleString('he-IL')}</span>
          </div>
        </div>
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
