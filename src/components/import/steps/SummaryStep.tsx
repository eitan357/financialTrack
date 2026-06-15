'use client'
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { addTransactions } from '@/lib/firestore/transactions'
import { upsertSalaryEntry } from '@/lib/firestore/salary'
import { addIncomeEntry } from '@/lib/firestore/income'
import type { ImportedTransaction, SalaryEntry, IncomeEntry, Transaction, TransactionSource } from '@/lib/types'
import type { CashExpense } from '../ImportWizard'

interface WizardData {
  step1Transactions: ImportedTransaction[]
  step2Transactions: ImportedTransaction[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}

interface Props {
  month: string
  data: WizardData
  hatzlaadaAccountId: string
  oneZeroAccountId: string
  cashAccountId: string
  onDone: () => void
}

function toTx(t: ImportedTransaction, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  return {
    date: t.date, merchantName: t.merchantName, description: t.notes || undefined,
    amount: t.amount, currency: t.currency, accountId,
    categoryId: t.categoryId ?? undefined, source, isImmediate: t.isImmediate, month,
  }
}

export function SummaryStep({ month, data, hatzlaadaAccountId, oneZeroAccountId, cashAccountId, onDone }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const allTxs: Omit<Transaction, 'id'>[] = [
        ...data.step1Transactions.map(t => toTx(t, hatzlaadaAccountId, month, 'xlsx_import')),
        ...data.step2Transactions.map(t => toTx(t, oneZeroAccountId, month, 'xlsx_import')),
        ...data.cashExpenses.map(e => ({
          date: e.date, merchantName: e.description, amount: e.amount, currency: 'ILS',
          accountId: cashAccountId, categoryId: e.categoryId ?? undefined,
          source: 'manual' as TransactionSource, isImmediate: true, month,
        })),
      ]
      await addTransactions(allTxs)
      if (data.salary) await upsertSalaryEntry(data.salary)
      for (const entry of data.incomeEntries) await addIncomeEntry(entry)
      setSaved(true)
    } catch {
      setError('שגיאה בשמירת הנתונים. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">הנתונים נשמרו בהצלחה!</h2>
        <p className="text-slate-400 text-sm mb-6">
          {data.step1Transactions.length + data.step2Transactions.length + data.cashExpenses.length} עסקאות יובאו
        </p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לייבוא</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">סיכום — מה ייובא?</h2>
      <div className="space-y-2 mb-6">
        {[
          ['עסקאות אשראי בהצדעה',  data.step1Transactions.length],
          ['עסקאות אשראי One Zero', data.step2Transactions.length],
          ['הכנסות נוספות',         data.incomeEntries.length],
          ['הוצאות מזומן',          data.cashExpenses.length],
        ].map(([label, count]) => (
          <div key={label as string} className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">{label}</span>
            <span className="text-sm text-slate-400">{count} פריטים</span>
          </div>
        ))}
        {data.salary && (
          <div className="flex justify-between bg-surface rounded-xl px-4 py-3">
            <span className="text-sm">משכורת</span>
            <span className="text-sm tabular-nums">{data.salary.netAmount.toLocaleString('he-IL')} ₪ נטו</span>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50">
        {saving ? 'שומר...' : 'שמור הכל'}
      </button>
    </div>
  )
}
