'use client'
import { useState } from 'react'
import { InvestmentPicker } from './InvestmentPicker'
import type { InvestmentSelection } from './InvestmentPicker'
import type { Account, InvestmentType, Transaction } from '@/lib/types'

interface Props {
  initial?: Transaction
  defaultDirection?: 'investment' | 'divestment'
  portfolios: Account[]
  investmentTypes: InvestmentType[]
  bankAccounts: Account[]
  onSave: (data: {
    date: string
    merchantName: string
    amount: number
    portfolioAccountId: string
    investmentTypeId?: string
    direction: 'investment' | 'divestment'
    accountId: string
    notes?: string
  }) => Promise<void>
  onCancel: () => void
}

export function InvestmentTransferEditForm({
  initial, defaultDirection = 'investment', portfolios, investmentTypes, bankAccounts, onSave, onCancel,
}: Props) {
  const initDir = initial?.direction === 'divestment' ? 'divestment' : (initial?.direction === 'investment' ? 'investment' : defaultDirection)
  const [direction, setDirection] = useState<'investment' | 'divestment'>(initDir)
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [merchantName, setMerchantName] = useState(initial?.merchantName ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [selection, setSelection] = useState<InvestmentSelection | null>(
    initial?.portfolioAccountId
      ? { portfolioAccountId: initial.portfolioAccountId, investmentTypeId: initial.investmentTypeId }
      : null
  )
  const [accountId, setAccountId] = useState(initial?.accountId ?? bankAccounts[0]?.id ?? '')
  const [notes, setNotes] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!date || !merchantName.trim() || !amount || parseFloat(amount) <= 0 || !selection || !accountId) {
      setError('יש למלא את כל השדות הנדרשים')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        date,
        merchantName: merchantName.trim(),
        amount: parseFloat(amount),
        portfolioAccountId: selection.portfolioAccountId,
        investmentTypeId: selection.investmentTypeId,
        direction,
        accountId,
        notes: notes.trim() || undefined,
      })
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  const isBuy = direction === 'investment'

  return (
    <div className="space-y-3">
      {/* Buy/Sell toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        <button
          type="button"
          onClick={() => setDirection('investment')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${isBuy ? 'bg-green-900/40 text-green-400' : 'text-slate-400 hover:text-slate-300'}`}
        >קנייה</button>
        <button
          type="button"
          onClick={() => setDirection('divestment')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${!isBuy ? 'bg-red-900/40 text-red-400' : 'text-slate-400 hover:text-slate-300'}`}
        >מכירה</button>
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">תאריך</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">תיאור (שם בבנק)</label>
        <input type="text" value={merchantName} onChange={e => setMerchantName(e.target.value)}
          placeholder='למשל: פסגות ני"ע'
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">סכום (₪)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          min="0" step="0.01" placeholder="0"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm tabular-nums outline-none focus:ring-1 ring-accent" />
      </div>

      {/* Investment selection */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">השקעה / תיק</label>
        <InvestmentPicker
          portfolios={portfolios}
          types={investmentTypes}
          value={selection}
          onChange={setSelection}
          placeholder="בחר תיק או השקעה"
        />
      </div>

      {/* Bank account */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">חשבון בנק</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)}
          className="w-full bg-background text-foreground rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent">
          {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">הערות (אופציונלי)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="הערה חופשית"
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="py-2 px-4 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}
