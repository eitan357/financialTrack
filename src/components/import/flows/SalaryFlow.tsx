'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { upsertSalaryEntry, deleteSalaryEntry } from '@/lib/firestore/salary'
import { addTransactionGetId, updateTransaction, deleteTransaction } from '@/lib/firestore/transactions'
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
  cashAccounts: Account[]
  previousSalary: Omit<SalaryEntry, 'id'> | null
  onDone: () => void
}

interface SalaryFormState {
  entryId?: string
  salaryTxId?: string
  cashTxId?: string
  employerName: string
  grossAmount: number
  deductions: SalaryDeductions
  additionalDeductions: { name: string; amount: number }[]
  bankAccountId: string
  cashAmount: number
  cashAccountId: string
  date: string
}

function entryToForm(entry: SalaryEntry, defaultBankId: string, defaultCashId: string, month: string): SalaryFormState {
  return {
    entryId: entry.id,
    salaryTxId: entry.salaryTxId,
    cashTxId: entry.cashTxId,
    employerName: entry.employerName,
    grossAmount: entry.grossAmount,
    deductions: entry.deductions,
    additionalDeductions: entry.additionalDeductions ?? [],
    bankAccountId: defaultBankId,
    cashAmount: entry.cashAmount ?? 0,
    cashAccountId: defaultCashId,
    date: `${month}-01`,
  }
}

function emptyForm(defaultBankId: string, defaultCashId: string, prev: Omit<SalaryEntry, 'id'> | null, month: string): SalaryFormState {
  return {
    employerName: prev?.employerName ?? '',
    grossAmount: 0,
    deductions: EMPTY_DEDUCTIONS,
    additionalDeductions: [],
    bankAccountId: defaultBankId,
    cashAmount: 0,
    cashAccountId: defaultCashId,
    date: `${month}-01`,
  }
}

function SalaryForm({ form, bankAccounts, cashAccounts, onChange, onSave, onCancel, saving }: {
  form: SalaryFormState
  bankAccounts: Account[]
  cashAccounts: Account[]
  onChange: (updates: Partial<SalaryFormState>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const fixedDeductionsTotal = Object.values(form.deductions).reduce((s, v) => s + v, 0)
  const additionalDeductionsTotal = form.additionalDeductions.reduce((s, d) => s + d.amount, 0)
  const totalDeductions = fixedDeductionsTotal + additionalDeductionsTotal
  const netAmount = Math.max(0, form.grossAmount - totalDeductions)
  const bankAmount = Math.max(0, netAmount - (form.cashAmount || 0))

  function addCustomDeduction() {
    onChange({ additionalDeductions: [...form.additionalDeductions, { name: '', amount: 0 }] })
  }

  function updateCustomDeduction(i: number, updates: Partial<{ name: string; amount: number }>) {
    onChange({ additionalDeductions: form.additionalDeductions.map((d, idx) => idx === i ? { ...d, ...updates } : d) })
  }

  function removeCustomDeduction(i: number) {
    onChange({ additionalDeductions: form.additionalDeductions.filter((_, idx) => idx !== i) })
  }

  const cashOverflow = form.cashAmount > 0 && form.cashAmount >= netAmount

  return (
    <div className="bg-surface rounded-xl p-4 space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">שם מעסיק</label>
        <input
          type="text"
          placeholder="שם מעסיק"
          value={form.employerName}
          onChange={e => onChange({ employerName: e.target.value })}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm"
          aria-label="שם מעסיק"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">תאריך קבלת משכורת</label>
        <input
          type="date"
          value={form.date}
          onChange={e => onChange({ date: e.target.value })}
          dir="rtl"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm"
          aria-label="תאריך קבלת משכורת"
        />
      </div>
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
        {form.additionalDeductions.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="שם ניכוי"
              value={d.name}
              onChange={e => updateCustomDeduction(i, { name: e.target.value })}
              className="flex-1 bg-background rounded px-2 py-1 text-xs"
              aria-label={`שם ניכוי ${i + 1}`}
            />
            <input
              type="number"
              value={d.amount || ''}
              onChange={e => updateCustomDeduction(i, { amount: parseFloat(e.target.value) || 0 })}
              className="w-24 bg-background rounded px-2 py-1 text-xs tabular-nums text-left"
              aria-label={`סכום ניכוי ${i + 1}`}
            />
            <button onClick={() => removeCustomDeduction(i)} className="text-red-400 hover:text-red-300 flex-shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={addCustomDeduction}
          className="flex items-center gap-1 text-xs text-accent hover:underline pt-0.5"
        >
          <Plus size={12} />הוסף ניכוי
        </button>
      </div>
      <div className="flex justify-between items-center bg-accent/10 rounded-xl px-3 py-2">
        <span className="text-xs font-semibold">נטו</span>
        <span className="font-bold tabular-nums text-sm" dir="ltr">₪{netAmount.toLocaleString('he-IL')}</span>
      </div>
      {bankAccounts.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">חשבון בנק</label>
          <select
            value={form.bankAccountId}
            onChange={e => onChange({ bankAccountId: e.target.value })}
            className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2"
            aria-label="חשבון בנק"
          >
            {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      {cashAccounts.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-slate-400">חלק שולם במזומן (אופציונלי)</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0"
              value={form.cashAmount || ''}
              onChange={e => onChange({ cashAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="flex-1 bg-background rounded-lg px-3 py-2 text-sm tabular-nums"
              aria-label="סכום מזומן"
            />
            {cashAccounts.length > 1 && (
              <select
                value={form.cashAccountId}
                onChange={e => onChange({ cashAccountId: e.target.value })}
                className="flex-1 bg-background text-foreground text-sm rounded-lg px-3 py-2"
                aria-label="חשבון מזומן"
              >
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
          {form.cashAmount > 0 && !cashOverflow && (
            <div className="text-xs text-slate-400 space-y-0.5 px-1">
              <div className="flex justify-between">
                <span>לבנק</span>
                <span className="tabular-nums" dir="ltr">₪{bankAmount.toLocaleString('he-IL')}</span>
              </div>
              <div className="flex justify-between">
                <span>במזומן</span>
                <span className="tabular-nums" dir="ltr">₪{form.cashAmount.toLocaleString('he-IL')}</span>
              </div>
            </div>
          )}
          {cashOverflow && (
            <p className="text-xs text-red-400">סכום המזומן לא יכול להיות גדול מהנטו</p>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button onClick={onSave} disabled={saving || !form.grossAmount || cashOverflow}
          className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

export function SalaryFlow({ month, existingEntries, bankAccounts, cashAccounts, previousSalary, onDone }: Props) {
  const router = useRouter()
  const defaultBankId = bankAccounts[0]?.id ?? ''
  const defaultCashId = cashAccounts[0]?.id ?? ''
  const [entries, setEntries] = useState<SalaryEntry[]>(existingEntries)
  const [form, setForm] = useState<SalaryFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!form || !form.grossAmount) return
    setSaving(true); setError(null)
    try {
      const totalDed = Object.values(form.deductions).reduce((s, v) => s + v, 0)
        + form.additionalDeductions.reduce((s, d) => s + d.amount, 0)
      const netAmount = Math.max(0, form.grossAmount - totalDed)
      const cashAmount = form.cashAmount > 0 && form.cashAmount < netAmount ? form.cashAmount : 0
      const bankAmount = netAmount - cashAmount

      const entryData: Omit<SalaryEntry, 'id'> = {
        month,
        employerName: form.employerName,
        grossAmount: form.grossAmount,
        deductions: form.deductions,
        additionalDeductions: form.additionalDeductions.length > 0 ? form.additionalDeductions : undefined,
        netAmount,
        cashAmount: cashAmount > 0 ? cashAmount : undefined,
      }

      const salaryDetails = {
        grossAmount: form.grossAmount,
        deductions: form.deductions,
        ...(form.additionalDeductions.length > 0 ? { additionalDeductions: form.additionalDeductions } : {}),
        netAmount,
        employerName: form.employerName,
        ...(cashAmount > 0 ? { cashAmount } : {}),
      }

      if (form.entryId) {
        // Edit: update bank transaction; replace cash transaction if cashAmount changed
        if (form.salaryTxId) {
          await updateTransaction(form.salaryTxId, {
            merchantName: form.employerName || 'משכורת',
            amount: bankAmount,
            date: form.date,
            salaryDetails,
          })
        }
        if (form.cashTxId) await deleteTransaction(form.cashTxId)
        let newCashTxId: string | undefined
        if (cashAmount > 0 && form.cashAccountId) {
          newCashTxId = await addTransactionGetId({
            date: form.date,
            merchantName: form.employerName || 'משכורת',
            amount: cashAmount,
            currency: 'ILS',
            accountId: form.cashAccountId,
            source: 'manual',
            isImmediate: false,
            month,
            direction: 'income',
            salaryDetails,
          })
        }
        const saved = await upsertSalaryEntry({ ...entryData, id: form.entryId, salaryTxId: form.salaryTxId, cashTxId: newCashTxId })
        setEntries(prev => prev.map(e => e.id === form.entryId ? saved : e))
      } else {
        // New entry: create bank transaction (and optional cash transaction), then save salary entry
        const txId = await addTransactionGetId({
          date: form.date,
          merchantName: form.employerName || 'משכורת',
          amount: bankAmount,
          currency: 'ILS',
          accountId: form.bankAccountId || defaultBankId,
          source: 'manual',
          isImmediate: false,
          month,
          direction: 'income',
          salaryDetails,
        })
        let cashTxId: string | undefined
        if (cashAmount > 0 && (form.cashAccountId || defaultCashId)) {
          cashTxId = await addTransactionGetId({
            date: form.date,
            merchantName: form.employerName || 'משכורת',
            amount: cashAmount,
            currency: 'ILS',
            accountId: form.cashAccountId || defaultCashId,
            source: 'manual',
            isImmediate: false,
            month,
            direction: 'income',
            salaryDetails,
          })
        }
        const saved = await upsertSalaryEntry({ ...entryData, salaryTxId: txId, cashTxId })
        setEntries(prev => [...prev, saved])
      }
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
      const entry = entries.find(e => e.id === id)
      await deleteSalaryEntry(id)
      if (entry?.salaryTxId) await deleteTransaction(entry.salaryTxId)
      if (entry?.cashTxId) await deleteTransaction(entry.cashTxId)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      setError('שגיאה במחיקה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-foreground transition-colors">
          <ChevronRight size={22} />
        </button>
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
              <SalaryForm key={entry.id} form={form} bankAccounts={bankAccounts} cashAccounts={cashAccounts}
                onChange={u => setForm(prev => prev ? { ...prev, ...u } : prev)}
                onSave={handleSave} onCancel={() => setForm(null)} saving={saving} />
            )
          }
          return (
            <div key={entry.id} className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{entry.employerName || 'משכורת'}</div>
                <div className="text-xs text-slate-400">
                  נטו: <span className="tabular-nums text-foreground">₪{entry.netAmount.toLocaleString('he-IL')}</span>
                  {entry.cashAmount && entry.cashAmount > 0 && (
                    <span className="mr-2 text-slate-500">(מזומן: <span className="tabular-nums">₪{entry.cashAmount.toLocaleString('he-IL')}</span>)</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(entryToForm(entry, defaultBankId, defaultCashId, month))}
                  className="text-xs text-accent hover:underline">ערוך</button>
                <button onClick={() => handleDelete(entry.id)}
                  className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
        {form && !form.entryId && (
          <SalaryForm form={form} bankAccounts={bankAccounts} cashAccounts={cashAccounts}
            onChange={u => setForm(prev => prev ? { ...prev, ...u } : prev)}
            onSave={handleSave} onCancel={() => setForm(null)} saving={saving} />
        )}
      </div>

      <button
        onClick={() => setForm(emptyForm(defaultBankId, defaultCashId, previousSalary, month))}
        disabled={!!form}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 text-sm hover:border-accent hover:text-accent transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-600 disabled:hover:text-slate-400"
      >
        <Plus size={16} />הוסף משכורת
      </button>

      <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl text-sm font-semibold">סיום</button>
    </div>
  )
}
