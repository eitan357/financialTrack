'use client'
import { useState } from 'react'
import { saveBankReconciliation } from '@/lib/firestore/bank-reconciliations'
import type { Account, Transaction, BankReconciliation } from '@/lib/types'

interface Props {
  accounts: Account[]
  transactions: Transaction[]
  reconciliations: BankReconciliation[]
  prevReconciliations: BankReconciliation[]
  month: string
  onSaved: (rec: BankReconciliation) => void
}

function computeNet(transactions: Transaction[], accountId: string): number {
  return transactions
    .filter(t => t.accountId === accountId)
    .reduce((sum, t) => sum + (t.direction === 'income' ? t.amount : -t.amount), 0)
}

function fmt(n: number): string {
  return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface BankRowProps {
  account: Account
  transactions: Transaction[]
  rec: BankReconciliation | null
  prevRec: BankReconciliation | null
  month: string
  onSaved: (rec: BankReconciliation) => void
}

function BankRow({ account, transactions, rec, prevRec, month, onSaved }: BankRowProps) {
  const [editing, setEditing] = useState(!rec)
  const [input, setInput] = useState(rec ? String(rec.actualBalance) : '')
  const [saving, setSaving] = useState(false)

  const net = computeNet(transactions, account.id)
  const expectedBalance = prevRec !== null ? +(prevRec.actualBalance + net).toFixed(2) : null

  async function save() {
    const parsed = parseFloat(input.replace(/,/g, ''))
    if (isNaN(parsed)) return
    setSaving(true)
    try {
      const saved = await saveBankReconciliation({
        ...(rec?.id ? { id: rec.id } : {}),
        month,
        accountId: account.id,
        actualBalance: +parsed.toFixed(2),
        date: `${month}-28`,
      })
      onSaved(saved)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const actual = rec?.actualBalance ?? null
  const diff = actual !== null && expectedBalance !== null
    ? +(actual - expectedBalance).toFixed(2)
    : null
  const isMatch = diff !== null && parseFloat(Math.abs(diff).toFixed(2)) === 0

  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: account.color }} />
        <span className="text-sm font-medium">{account.name}</span>
        {actual !== null && !editing && (
          <button
            onClick={() => { setInput(String(actual)); setEditing(true) }}
            className="mr-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            עדכן
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex gap-2 items-center">
          <input
            type="number"
            step="0.01"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-sm text-right tabular-nums"
            onKeyDown={e => { if (e.key === 'Enter') save() }}
          />
          <button
            onClick={save}
            disabled={saving || !input}
            className="px-3 py-2 bg-accent rounded-xl text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? '...' : 'שמור'}
          </button>
          {rec && (
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300">
              ביטול
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>יתרה בפועל</span>
            <span className="tabular-nums text-slate-200">₪{fmt(actual!)}</span>
          </div>
          <div className="flex justify-between">
            <span>יתרה צפויה</span>
            {expectedBalance !== null ? (
              <span className="tabular-nums text-slate-200">₪{fmt(expectedBalance)}</span>
            ) : (
              <span className="text-slate-500 text-xs">אין נתון לחודש קודם</span>
            )}
          </div>
          {diff !== null && (
            <div className={`flex justify-between font-semibold pt-0.5 ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
              <span>{isMatch ? '✓ תואם' : 'פער'}</span>
              {!isMatch && (
                <span className="tabular-nums">
                  {diff > 0 ? '+' : ''}₪{fmt(diff)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BankReconciliationCard({ accounts, transactions, reconciliations, prevReconciliations, month, onSaved }: Props) {
  const bankAccounts = accounts.filter(a => a.type === 'bank' && a.isActive)
  if (bankAccounts.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-slate-400 mb-1">אימות יתרת בנק</h2>
      {bankAccounts.map(account => (
        <BankRow
          key={account.id}
          account={account}
          transactions={transactions}
          rec={reconciliations.find(r => r.accountId === account.id) ?? null}
          prevRec={prevReconciliations.find(r => r.accountId === account.id) ?? null}
          month={month}
          onSaved={onSaved}
        />
      ))}
    </div>
  )
}
