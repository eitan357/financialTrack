'use client'
import { useState } from 'react'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Account, Category, SalaryDeductions } from '@/lib/types'

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
  onSaved: () => void
  onClose: () => void
}

export function AddTransactionForm({ month, accounts, categories, onSaved, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'expense' | 'income'>('expense')
  const [accountId, setAccountId] = useState(accounts.find(a => a.isActive)?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [showSalary, setShowSalary] = useState(false)
  const [deductions, setDeductions] = useState<SalaryDeductions>(EMPTY_DEDUCTIONS)
  const [saving, setSaving] = useState(false)

  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)
  const grossAmount = parseFloat(amount) || 0
  const netAmount = Math.max(0, grossAmount - totalDeductions)

  function updateDeduction(key: keyof SalaryDeductions, val: number) {
    setDeductions(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    if (!name.trim() || !amount || !accountId) return
    setSaving(true)
    try {
      const finalAmount = direction === 'income' && showSalary ? netAmount : grossAmount
      const txMonth = date.slice(0, 7)
      await addTransactions([{
        date,
        merchantName: name.trim(),
        amount: finalAmount,
        currency: 'ILS',
        accountId,
        categoryId: direction === 'expense' ? (categoryId || undefined) : undefined,
        source: 'manual',
        isImmediate: true,
        month: txMonth,
        direction,
        ...(direction === 'income' && showSalary ? {
          salaryDetails: {
            grossAmount,
            deductions,
            netAmount,
            employerName: name.trim(),
          }
        } : {}),
      }])
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const isValid = name.trim().length > 0 && parseFloat(amount) > 0 && accountId

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

      <div>
        <label className="text-xs text-slate-400 block mb-1">תאריך</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">{direction === 'income' ? 'מקור ההכנסה' : 'שם עסק'}</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={direction === 'income' ? 'למשל: שם מעסיק' : 'שם עסק'}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">{direction === 'income' && showSalary ? 'ברוטו (₪)' : 'סכום (₪)'}</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent tabular-nums" />
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">חשבון</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)}
          className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 ring-accent">
          {accounts.filter(a => a.isActive).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {direction === 'expense' && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">קטגוריה</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 ring-accent">
            <option value="">— ללא —</option>
            {categories.filter(c => c.isActive).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
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
            <span className="text-sm font-bold tabular-nums text-green-400">{netAmount.toLocaleString('he-IL')} ₪</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 py-2.5 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button onClick={save} disabled={saving || !isValid}
          className="flex-1 py-2.5 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}
