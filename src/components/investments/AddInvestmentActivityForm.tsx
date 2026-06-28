'use client'
import { useState } from 'react'
import { AddInvestmentEntryForm } from './AddInvestmentEntryForm'
import { AddDividendForm } from './AddDividendForm'
import { AddInvestmentConversionForm } from './AddInvestmentConversionForm'
import type { InvestmentType, InvestmentEntry, Dividend, Account, InvestmentConversion } from '@/lib/types'

type ActivityType = 'deposit' | 'dividend' | 'conversion'

interface Props {
  types: InvestmentType[]
  portfolios: Account[]
  bankAccounts: Account[]
  onSubmitEntry: (entry: Omit<InvestmentEntry, 'id'>) => void
  onSubmitDividend: (dividend: Omit<Dividend, 'id'>) => void
  onSubmitConversion: (conv: Omit<InvestmentConversion, 'id'>) => void
  onCancel: () => void
}

const TOGGLE_OPTIONS: { type: ActivityType; label: string }[] = [
  { type: 'deposit', label: 'קנייה' },
  { type: 'dividend', label: 'הכנסה' },
  { type: 'conversion', label: 'מכירה' },
]

export function AddInvestmentActivityForm({
  types, portfolios, bankAccounts,
  onSubmitEntry, onSubmitDividend, onSubmitConversion,
  onCancel,
}: Props) {
  const [activityType, setActivityType] = useState<ActivityType>('deposit')

  return (
    <div className="mb-4 space-y-3">
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        {TOGGLE_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setActivityType(type)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activityType === type
                ? 'bg-accent/20 text-accent'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activityType === 'deposit' && (
        <AddInvestmentEntryForm
          types={types}
          portfolios={portfolios}
          bankAccounts={bankAccounts}
          onSubmit={onSubmitEntry}
          onCancel={onCancel}
        />
      )}
      {activityType === 'dividend' && (
        <AddDividendForm
          types={types}
          bankAccounts={bankAccounts}
          onSubmit={onSubmitDividend}
          onCancel={onCancel}
        />
      )}
      {activityType === 'conversion' && (
        <AddInvestmentConversionForm
          types={types}
          bankAccounts={bankAccounts}
          onSubmit={onSubmitConversion}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
