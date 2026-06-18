'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { upsertSalaryEntry, deleteSalaryEntry } from '@/lib/firestore/salary'
import { addTransactions } from '@/lib/firestore/transactions'
import type { SalaryEntry, SalaryDeductions, Account } from '@/lib/types'

const EMPTY_DEDUCTIONS: SalaryDeductions = { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }
const DEDUCTION_LABELS: [keyof SalaryDeductions, string][] = [
  ['incomeTax', 'מס הכנסה'], ['nationalInsurance', 'ביטוח לאומי'],
  ['healthInsurance', 'ביטוח בריאות'], ['pension', 'פנסיה'], ['trainingFund', 'קרן השתלמות'],
]

interface Props {
  month: string
  existingEntries: SalaryEntry[]
  bankAccounts: Account[]
  previousSalary: Omit<SalaryEntry, 'id'> | null
  onDone: () => void
  onBack: () => void
}

interface SalaryFormState {
  entryId?: string
  employerName: string
  grossAmount: number
  deductions: SalaryDeductions
  bankAccountId: string
}

function entryToForm(entry: SalaryEntry, defaultBankId: string): SalaryFormState {
  return {
    entryId: entry.id,
    employerName: entry.employerName,
    grossAmount: entry.grossAmount,
    deductions: entry.deductions,
    bankAccountId: defaultBankId,
  }
}

function emptyForm(defaultBankId: string, prev: Omit<SalaryEntry, 'id'> | null): SalaryFormState {
  return {
    employerName: prev?.employerName ?? '',
    grossAmount: prev?.grossAmount ?? 0,
    deductions: prev?.deductions ?? EMPTY_DEDUCTIONS,
    bankAccountId: defaultBankId,
  }
}

function SalaryForm({ form, bankAccounts, onChange, onSave, onCancel, saving }: {
  form: SalaryFormState
  bankAccounts: Account[]
  onChange: (updates: Partial<SalaryFormState>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const totalDeductions = Object.values(form.deductions).reduce((s, v) => s + v, 0)
  const netAmount = Math.max(0, form.grossAmount - totalDeductions)

  return (
    <div className="bg-surface rounded-xl p-4 space-y-3">
      <input
        type="text"
        placeholder="שם מעסיק"
        value={form.employerName}
        onChange={e => onChange({ employerName: e.target.value })}
        className="w-full bg-background rounded-lg px-3 py-2 text-sm"
        aria-label="שם מעסיק"
      />
      <div>
        <label className="block text-xs text-slate-400 mb-1">ברוטו</label>
        <input
          type="number"
          value={form.grossAmount || ''}
          onChange={e => onChange({ grossAmount: parseFloat(e.target.value) || 0 })}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm tabular-nums"
          aria-label="ברוטו"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">ניכויים</p>
        {DEDUCTION_LABELS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="flex-1 text-xs">{label}</span>
            <input
              type="number"
              value={form.deductions[key] || ''}
              onChange={e => onChange({ deductions: { ...form.deductions, [key]: parseFloat(e.target.value) || 0 } })}
              className="w-24 bg-background rounded px-2 py-1 text-xs tabular-nums text-left"
              aria-label={label}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center bg-accent/10 rounded-xl px-3 py-2">
        <span className="text-xs font-semibold">נטו</span>
        <span className="font-bold tabular-nums text-sm" dir="ltr">₪{netAmount.toLocaleString('he-IL')}</span>
      </div>
      {bankAccounts.length > 0 && (
        <select
          value={form.bankAccountId}
          onChange={e => onChange({ bankAccountId: e.target.value })}
          className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2"
          aria-label="חשבון בנק"
        >
          {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button onClick={onSave} disabled={saving || !form.grossAmount}
          className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

export function SalaryFlow({ month, existingEntries, bankAccounts, previousSalary, onDone, onBack }: Props) {
  const defaultBankId = bankAccounts[0]?.id ?? ''
  const [entries, setEntries] = useState<SalaryEntry[]>(existingEntries)
  const [form, setForm] = useState<SalaryFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!form || !form.grossAmount) return
    setSaving(true); setError(null)
    try {
      const totalDed = Object.values(form.deductions).reduce((s, v) => s + v, 0)
      const netAmount = Math.max(0, form.grossAmount - totalDed)
      const entryData: Omit<SalaryEntry, 'id'> = {
        month,
        employerName: form.employerName,
        grossAmount: form.grossAmount,
        deductions: form.deductions,
        netAmount,
      }
      await upsertSalaryEntry(form.entryId ? { ...entryData, id: form.entryId } : entryData)
      // Only create a transaction for new entries — editing leaves existing transaction intact
      if (!form.entryId) {
        await addTransactions([{
          date: `${month}-01`,
          merchantName: form.employerName || 'משכורת',
          amount: netAmount,
          currency: 'ILS',
          accountId: form.bankAccountId || defaultBankId,
          source: 'manual' as const,
          isImmediate: true,
          month,
          direction: 'income' as const,
          salaryDetails: { grossAmount: form.grossAmount, deductions: form.deductions, netAmount, employerName: form.employerName },
        }])
      }
      const updated: SalaryEntry = { id: form.entryId ?? `tmp-${Date.now()}`, ...entryData }
      setEntries(prev => form.entryId ? prev.map(e => e.id === form.entryId ? updated : e) : [...prev, updated])
      setForm(null)
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('למחוק משכורת זו?')) return
    setSaving(true)
    try {
      await deleteSalaryEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">משכורות — {month}</h2>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-3 mb-4">
        {entries.length === 0 && !form && (
          <p className="text-slate-400 text-sm text-center py-4">אין משכורות לחודש זה</p>
        )}
        {entries.map(entry => {
          const isEditing = form?.entryId === entry.id
          if (isEditing && form) {
            return (
              <SalaryForm key={entry.id} form={form} bankAccounts={bankAccounts}
                onChange={u => setForm(prev => prev ? { ...prev, ...u } : prev)}
                onSave={handleSave} onCancel={() => setForm(null)} saving={saving} />
            )
          }
          return (
            <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{entry.employerName || 'משכורת'}</div>
                <div className="text-xs text-slate-400">נטו: <span className="tabular-nums text-foreground">₪{entry.netAmount.toLocaleString('he-IL')}</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(entryToForm(entry, defaultBankId))}
                  className="text-xs text-accent hover:underline">ערוך</button>
                <button onClick={() => handleDelete(entry.id)}
                  className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
        {form && !form.entryId && (
          <SalaryForm form={form} bankAccounts={bankAccounts}
            onChange={u => setForm(prev => prev ? { ...prev, ...u } : prev)}
            onSave={handleSave} onCancel={() => setForm(null)} saving={saving} />
        )}
      </div>

      {!form && (
        <button
          onClick={() => setForm(emptyForm(defaultBankId, previousSalary))}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4"
        >
          <Plus size={16} />הוסף משכורת
        </button>
      )}

      <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
    </div>
  )
}
