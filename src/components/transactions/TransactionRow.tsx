'use client'
import { useState } from 'react'
import type { Transaction, Category } from '@/lib/types'
import { CategorySelect } from './CategorySelect'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryChange: (transactionId: string, categoryId: string | undefined) => void
  onUpdate: (transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  onDelete: (transactionId: string) => void
}

function EditRow({ transaction, categories, onUpdate, onDelete, onClose }: {
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

  async function remove() {
    onDelete(transaction.id)
    onClose()
  }

  return (
    <div className="py-3 border-b border-slate-800 last:border-0 space-y-2">
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="w-full bg-background rounded px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-accent"
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="שם עסק"
        className="w-full bg-background rounded px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-accent"
      />
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        step="0.01"
        className="w-full bg-background rounded px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 ring-accent tabular-nums"
      />
      <select
        value={categoryId}
        onChange={e => setCategoryId(e.target.value)}
        className="w-full bg-background text-foreground text-xs rounded px-2 py-1.5 outline-none"
      >
        <option value="">— ללא —</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex gap-2 pt-1">
        <button
          onClick={remove}
          className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
        >מחק</button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-xs px-3 py-1 border border-slate-600 rounded"
        >ביטול</button>
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-3 py-1 bg-accent rounded font-semibold disabled:opacity-50"
        >{saving ? '...' : 'שמור'}</button>
      </div>
    </div>
  )
}

export function TransactionRow({ transaction, categories, onCategoryChange, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [, mm, dd] = transaction.date.split('-')
  const hasCategory = !!transaction.categoryId

  if (editing) {
    return (
      <EditRow
        transaction={transaction}
        categories={categories}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => setEditing(false)}
      />
    )
  }

  return (
    <div
      className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0 cursor-pointer group"
      onClick={() => setEditing(true)}
    >
      <span className="text-xs text-slate-500 w-10 flex-shrink-0 tabular-nums">{dd}/{mm}</span>
      <span className={`flex-1 text-sm truncate ${!hasCategory ? 'text-amber-400' : 'text-foreground'}`}>
        {transaction.merchantName}
      </span>
      <span className="text-sm tabular-nums flex-shrink-0">₪{transaction.amount.toLocaleString('he-IL')}</span>
      <div onClick={e => e.stopPropagation()}>
        <CategorySelect
          value={transaction.categoryId}
          categories={categories}
          onChange={categoryId => onCategoryChange(transaction.id, categoryId)}
          className="w-28 flex-shrink-0"
        />
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(transaction.id) }}
        aria-label="מחק עסקה"
        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 text-sm px-1 opacity-0 group-hover:opacity-100"
      >✕</button>
    </div>
  )
}
