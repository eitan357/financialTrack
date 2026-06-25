'use client'
import { useState } from 'react'
import type { Transaction, Category } from '@/lib/types'
import { FormField } from '@/components/ui/FormField'
import { DirectionToggle } from '@/components/ui/DirectionToggle'
import { CurrencyPicker } from '@/components/ui/CurrencyPicker'
import { getCurrency } from '@/lib/currencies'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryChange: (transactionId: string, categoryId: string | undefined) => void
  onUpdate: (transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  onDelete: (transactionId: string) => void
  onEditSalary?: () => void
  displayAmount?: number
  accountLabel?: string
}

function amountDisplay(amount: number, direction: Transaction['direction'], currency = 'ILS'): { text: string; colorClass: string } {
  const fmt = (n: number) => n.toLocaleString('he-IL')
  const sym = getCurrency(currency).symbol
  if (direction === 'income')
    return { text: `${sym}${fmt(amount)}`, colorClass: 'text-green-400' }
  if (amount < 0)
    return { text: `${sym}${fmt(Math.abs(amount))}`, colorClass: 'text-green-400' }
  return { text: `${sym}-${fmt(amount)}`, colorClass: 'text-red-400' }
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
  const [isImmediate, setIsImmediate] = useState(transaction.isImmediate)
  const [currency, setCurrency] = useState(transaction.currency ?? 'ILS')
  const [errors, setErrors] = useState<{ date?: string; name?: string; amount?: string }>({})

  async function save() {
    const errs: { date?: string; name?: string; amount?: string } = {}
    if (!date) errs.date = 'יש לבחור תאריך'
    if (!name.trim()) errs.name = 'שדה חובה'
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'יש להזין סכום חיובי'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      const rawAmount = parseFloat(amount)
      const finalAmount = direction === 'income' ? rawAmount : (transaction.amount < 0 ? -rawAmount : rawAmount)
      const updates: Parameters<Props['onUpdate']>[1] = {
        date,
        merchantName: name.trim(),
        amount: finalAmount,
        direction,
        currency,
      }
      if (description.trim()) updates.description = description.trim()
      if (direction === 'expense' && categoryId) updates.categoryId = categoryId
      if (direction === 'income') updates.categoryId = undefined
      updates.isImmediate = isImmediate
      await onUpdate(transaction.id, updates)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-3 border-b border-slate-800 last:border-0 space-y-3">
      <DirectionToggle value={direction} onChange={setDirection} size="sm" />
      <FormField label="תאריך" error={errors.date}>
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); if (errors.date && e.target.value) setErrors(p => ({ ...p, date: undefined })) }}
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${errors.date ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`}
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
      <FormField label="סכום" error={errors.amount}>
        <div className="flex gap-2">
          <CurrencyPicker value={currency} onChange={setCurrency} />
          <input
            type="number"
            value={amount}
            onChange={e => { setAmount(e.target.value); if (errors.amount && parseFloat(e.target.value) > 0) setErrors(p => ({ ...p, amount: undefined })) }}
            step="0.01"
            min="0"
            className={`flex-1 bg-background rounded-lg px-3 py-2 text-sm outline-none tabular-nums ${errors.amount ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`}
          />
        </div>
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
      {direction !== 'income' && (
        <label className="flex items-center gap-2 text-sm text-slate-400 py-1">
          <input
            type="checkbox"
            checked={isImmediate}
            onChange={e => setIsImmediate(e.target.checked)}
            className="accent-amber-400"
            aria-label="חיוב מיידי"
          />
          חיוב מיידי
        </label>
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

function DetailView({ transaction, categories, onEdit, onClose, onEditSalary, displayAmount }: {
  transaction: Transaction
  categories: Category[]
  onEdit: () => void
  onClose: () => void
  onEditSalary?: () => void
  displayAmount?: number
}) {
  const [yyyy, mm, dd] = transaction.date.split('-')
  const categoryName = categories.find(c => c.id === transaction.categoryId)?.name
  const { text, colorClass } = amountDisplay(displayAmount ?? transaction.amount, transaction.direction, transaction.currency ?? 'ILS')
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
          {!isIncome && transaction.isImmediate && (
            <div className="text-xs text-amber-400/80 mt-0.5">חיוב מיידי</div>
          )}
        </div>
      </div>
      {transaction.salaryDetails && (
        <div className="text-xs text-slate-500 mb-3 space-y-0.5" onClick={e => e.stopPropagation()}>
          {transaction.salaryDetails.employerName && (
            <div className="flex justify-between font-medium text-slate-400 pb-0.5 mb-0.5 border-b border-slate-800">
              <span>מעסיק</span><span>{transaction.salaryDetails.employerName}</span>
            </div>
          )}
          <div className="flex justify-between"><span>ברוטו</span><span className="tabular-nums" dir="ltr">₪{transaction.salaryDetails.grossAmount.toLocaleString('he-IL')}</span></div>
          {transaction.salaryDetails.deductions.incomeTax > 0 && <div className="flex justify-between"><span>מס הכנסה</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.incomeTax.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.nationalInsurance > 0 && <div className="flex justify-between"><span>ביטוח לאומי</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.nationalInsurance.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.healthInsurance > 0 && <div className="flex justify-between"><span>ביטוח בריאות</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.healthInsurance.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.pension > 0 && <div className="flex justify-between"><span>פנסיה</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.pension.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.deductions.trainingFund > 0 && <div className="flex justify-between"><span>קרן השתלמות</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{transaction.salaryDetails.deductions.trainingFund.toLocaleString('he-IL')}</span></div>}
          {transaction.salaryDetails.additionalDeductions?.map((d, i) => d.amount > 0 && (
            <div key={i} className="flex justify-between"><span>{d.name || 'ניכוי נוסף'}</span><span className="tabular-nums text-red-400/70" dir="ltr">₪-{d.amount.toLocaleString('he-IL')}</span></div>
          ))}
          <div className="flex justify-between font-medium text-slate-400 border-t border-slate-800 pt-0.5 mt-0.5"><span>נטו</span><span className="tabular-nums text-green-400/80" dir="ltr">₪{transaction.salaryDetails.netAmount.toLocaleString('he-IL')}</span></div>
          {transaction.salaryDetails.cashAmount && transaction.salaryDetails.cashAmount > 0 && (
            <>
              <div className="flex justify-between text-slate-500 pt-0.5"><span>הכנסה לבנק</span><span className="tabular-nums" dir="ltr">₪{(transaction.salaryDetails.netAmount - transaction.salaryDetails.cashAmount).toLocaleString('he-IL')}</span></div>
              <div className="flex justify-between text-slate-500"><span>הכנסה במזומן</span><span className="tabular-nums" dir="ltr">₪{transaction.salaryDetails.cashAmount.toLocaleString('he-IL')}</span></div>
            </>
          )}
        </div>
      )}
      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
        <button
          onClick={transaction.salaryDetails && onEditSalary ? onEditSalary : onEdit}
          className="text-sm py-1.5 px-4 border border-accent text-accent rounded-lg hover:bg-accent hover:text-white transition-colors"
        >{transaction.salaryDetails && onEditSalary ? 'ערוך משכורת' : 'ערוך'}</button>
      </div>
    </div>
  )
}

export function TransactionRow({ transaction, categories, onCategoryChange: _onCategoryChange, onUpdate, onDelete, onEditSalary, displayAmount, accountLabel }: Props) {
  const [mode, setMode] = useState<'row' | 'detail' | 'edit'>('row')
  const [, mm, dd] = transaction.date.split('-')
  const hasCategory = !!transaction.categoryId
  const isIncome = transaction.direction === 'income'
  const { text, colorClass } = amountDisplay(displayAmount ?? transaction.amount, transaction.direction, transaction.currency ?? 'ILS')

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
        onEditSalary={onEditSalary}
        displayAmount={displayAmount}
      />
    )
  }

  return (
    <div
      className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0 cursor-pointer hover:bg-slate-800/40 transition-colors rounded-sm"
      onClick={() => setMode('detail')}
    >
      <span className="text-xs text-slate-500 w-10 flex-shrink-0 tabular-nums">{dd}/{mm}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${isIncome ? 'text-foreground' : !hasCategory ? 'text-amber-400' : 'text-foreground'}`}>
          {transaction.merchantName}
        </div>
        {accountLabel && <div className="text-xs text-slate-500">{accountLabel}</div>}
      </div>
      <span className={`text-sm tabular-nums flex-shrink-0 ${colorClass}`} dir="ltr">
        {text}
      </span>
    </div>
  )
}
