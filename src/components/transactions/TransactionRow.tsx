'use client'
import { useState } from 'react'
import type { Transaction, Category } from '@/lib/types'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryChange: (transactionId: string, categoryId: string | undefined) => void
  onUpdate: (transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  onDelete: (transactionId: string) => void
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
  const [amount, setAmount] = useState(String(transaction.amount))
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onUpdate(transaction.id, {
      date,
      merchantName: name.trim(),
      amount: parseFloat(amount) || transaction.amount,
      categoryId: categoryId || undefined,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="py-3 border-b border-slate-800 last:border-0 space-y-3">
      <div>
        <label className="text-xs text-slate-400 block mb-1">תאריך</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">שם עסק</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="שם עסק"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">סכום (₪)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          step="0.01"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent tabular-nums"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">קטגוריה</label>
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
      </div>
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
          <div className="text-base font-semibold tabular-nums">₪{transaction.amount.toLocaleString('he-IL')}</div>
          {categoryName ? (
            <div className="text-xs text-slate-400 mt-0.5">{categoryName}</div>
          ) : (
            <div className="text-xs text-amber-400 mt-0.5">ללא קטגוריה</div>
          )}
        </div>
      </div>
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
      <span className={`flex-1 text-sm truncate ${!hasCategory ? 'text-amber-400' : 'text-foreground'}`}>
        {transaction.merchantName}
      </span>
      <span className="text-sm tabular-nums flex-shrink-0">₪{transaction.amount.toLocaleString('he-IL')}</span>
    </div>
  )
}
