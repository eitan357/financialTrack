'use client'
import { useState } from 'react'
import type { Transaction, Category } from '@/lib/types'
import { FormField } from '@/components/ui/FormField'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryChange: (transactionId: string, categoryId: string | undefined) => void
  onUpdate: (transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  onDelete: (transactionId: string) => void
}

function amountDisplay(transaction: Transaction): { text: string; colorClass: string } {
  const fmt = (n: number) => n.toLocaleString('he-IL')
  if (transaction.direction === 'income')
    return { text: `₪${fmt(transaction.amount)}`, colorClass: 'text-green-400' }
  if (transaction.amount < 0)
    return { text: `₪${fmt(Math.abs(transaction.amount))}`, colorClass: 'text-green-400' }
  return { text: `₪-${fmt(transaction.amount)}`, colorClass: 'text-red-400' }
}

function EditForm({ transaction, categories, onUpdate, onDelete, onClose }: {
  transaction: Transaction
  categories: Category[]
  onUpdate: Props['onUpdate']
  onDelete: Props['onDelete']
  onClose: () => void
}) {
  const [date, setDate] = useState(transaction.date)
  const [name, setName] = useState(transaction.merchantName)
  const [description, setDescription] = useState(transaction.description ?? '')
  const [amount, setAmount] = useState(String(Math.abs(transaction.amount)))
  const [direction, setDirection] = useState<'expense' | 'income'>(transaction.direction === 'income' ? 'income' : 'expense')
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({})

  async function save() {
    const errs: { name?: string; amount?: string } = {}
    if (!name.trim()) errs.name = 'שדה חובה'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'יש להזין סכום חיובי'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    const rawAmount = parseFloat(amount)
    const finalAmount = direction === 'income' ? rawAmount : (transaction.amount < 0 ? -rawAmount : rawAmount)
    const updates: Parameters<Props['onUpdate']>[1] = {
      date,
      merchantName: name.trim(),
      amount: finalAmount,
      direction,
    }
    if (description.trim()) updates.description = description.trim()
    if (direction === 'expense' && categoryId) updates.categoryId = categoryId
    if (direction === 'income') updates.categoryId = undefined
    await onUpdate(transaction.id, updates)
    setSaving(false)
    onClose()
  }

  return (
    <div className="py-3 border-b border-slate-800 last:border-0 space-y-3">
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        <button
          onClick={() => setDirection('expense')}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${direction === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'}`}
        >הוצאה</button>
        <button
          onClick={() => setDirection('income')}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${direction === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'}`}
        >הכנסה</button>
      </div>
      <FormField label="תאריך">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
        />
      </FormField>
      <FormField label="שם עסק" error={errors.name}>
        <input
          value={name}
          onChange={e => { setName(e.target.value); if (errors.name && e.target.value.trim()) setErrors(p => ({ ...p, name: undefined })) }}
          placeholder="שם עסק"
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${errors.name ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`}
        />
      </FormField>
      <FormField label="תיאור (אופציונלי)">
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="פרטים נוספים"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
        />
      </FormField>
      <FormField label="סכום (₪)" error={errors.amount}>
        <input
          type="number"
          value={amount}
          onChange={e => { setAmount(e.target.value); if (errors.amount && parseFloat(e.target.value) > 0) setErrors(p => ({ ...p, amount: undefined })) }}
          step="0.01"
          min="0"
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none tabular-nums ${errors.amount ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`}
        />
      </FormField>
      {direction === 'expense' && (
        <FormField label="קטגוריה">
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 ring-accent"
          >
            <option value="">— ללא —</option>
            {categories.filter(c => c.isActive).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { onDelete(transaction.id); onClose() }}
          className="text-sm text-red-400 hover:text-red-300 px-2 py-2"
        >מחק</button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="py-2 px-4 border border-slate-600 rounded-lg text-sm"
        >ביטול</button>
        <button
          onClick={save}
          disabled={saving}
          className="py-2 px-4 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50"
        >{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </div>
  )
}

function DetailView({ transaction, categories, onEdit, onClose }: {
  transaction: Transaction
  categories: Category[]
  onEdit: () => void
  onClose: () => void
}) {
  const [yyyy, mm, dd] = transaction.date.split('-')
  const categoryName = categories.find(c => c.id === transaction.categoryId)?.name
  const { text, colorClass } = amountDisplay(transaction)
  const isIncome = transaction.direction === 'income'
  const isRefund = !isIncome && transaction.amount < 0

  return (
    <div
      className="py-3 border-b border-slate-800 last:border-0 cursor-pointer"
      onClick={onClose}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs text-slate-500 mb-0.5">{dd}/{mm}/{yyyy}</div>
          <div className="font-medium text-sm">{transaction.merchantName}</div>
          {transaction.description && (
            <div className="text-xs text-slate-500 mt-0.5">{transaction.description}</div>
          )}
        </div>
        <div className="text-left">
          <div className={`text-base font-semibold tabular-nums ${colorClass}`} dir="ltr">
            {text}
          </div>
          {isIncome ? (
            <div className="text-xs text-green-500/70 mt-0.5">הכנסה</div>
          ) : isRefund ? (
            <div className="text-xs text-green-500/70 mt-0.5">זיכוי</div>
          ) : categoryName ? (
            <div className="text-xs text-slate-400 mt-0.5">{categoryName}</div>
          ) : (
            <div className="text-xs text-amber-400 mt-0.5">ללא קטגוריה</div>
          )}
        </div>
      </div>
      {transaction.salaryDetails && (
        <div className="text-xs text-slate-500 mb-3 space-y-0.5" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><span>ברוטו</span><span className="tabular-nums" dir="ltr">₪{transaction.salaryDetails.grossAmount.toLocaleString('he-IL')}</span></div>
          {transaction.salaryDetails.deductions.incomeTax > 0 && <div className="flex justify-between"><span>מס הכנסה</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.incomeTax.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.nationalInsurance > 0 && <div className="flex justify-between"><span>ביטוח לאומי</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.nationalInsurance.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.healthInsurance > 0 && <div className="flex justify-between"><span>ביטוח בריאות</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.healthInsurance.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.pension > 0 && <div className="flex justify-between"><span>פנסיה</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.pension.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.trainingFund > 0 && <div className="flex justify-between"><span>קרן השתלמות</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.trainingFund.toLocaleString('he-IL')}</span></div>}
          <div className="flex justify-between font-medium text-slate-400 border-t border-slate-800 pt-0.5 mt-0.5"><span>נטו</span><span className="tabular-nums text-green-400/80" dir="ltr">₪{transaction.salaryDetails.netAmount.toLocaleString('he-IL')}</span></div>
        </div>
      )}
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <button
          onClick={onEdit}
          className="text-sm py-1.5 px-4 border border-accent text-accent rounded-lg hover:bg-accent hover:text-white transition-colors"
        >ערוך</button>
      </div>
    </div>
  )
}

export function TransactionRow({ transaction, categories, onCategoryChange: _onCategoryChange, onUpdate, onDelete }: Props) {
  const [mode, setMode] = useState<'row' | 'detail' | 'edit'>('row')
  const [, mm, dd] = transaction.date.split('-')
  const hasCategory = !!transaction.categoryId
  const isIncome = transaction.direction === 'income'
  const { text, colorClass } = amountDisplay(transaction)

  if (mode === 'edit') {
    return (
      <EditForm
        transaction={transaction}
        categories={categories}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => setMode('row')}
      />
    )
  }

  if (mode === 'detail') {
    return (
      <DetailView
        transaction={transaction}
        categories={categories}
        onEdit={() => setMode('edit')}
        onClose={() => setMode('row')}
      />
    )
  }

  return (
    <div
      className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0 cursor-pointer hover:bg-slate-800/40 transition-colors rounded-sm"
      onClick={() => setMode('detail')}
    >
      <span className="text-xs text-slate-500 w-10 flex-shrink-0 tabular-nums">{dd}/{mm}</span>
      <span className={`flex-1 text-sm truncate ${isIncome ? 'text-foreground' : !hasCategory ? 'text-amber-400' : 'text-foreground'}`}>
        {transaction.merchantName}
      </span>
      <span className={`text-sm tabular-nums flex-shrink-0 ${colorClass}`} dir="ltr">
        {text}
      </span>
    </div>
  )
}
