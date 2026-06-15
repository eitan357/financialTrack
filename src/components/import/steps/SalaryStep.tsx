'use client'
import { useState } from 'react'
import type { SalaryEntry, SalaryDeductions } from '@/lib/types'

const EMPTY_DEDUCTIONS: SalaryDeductions = { incomeTax: 0, nationalInsurance: 0, healthInsurance: 0, pension: 0, trainingFund: 0 }

const DEDUCTION_LABELS: [keyof SalaryDeductions, string][] = [
  ['incomeTax',           'מס הכנסה'],
  ['nationalInsurance',   'ביטוח לאומי'],
  ['healthInsurance',     'ביטוח בריאות'],
  ['pension',             'פנסיה'],
  ['trainingFund',        'קרן השתלמות'],
]

interface Props {
  month: string
  initialSalary: Omit<SalaryEntry, 'id'> | null
  onComplete: (salary: Omit<SalaryEntry, 'id'>) => void
  onSkip: () => void
  onBack: () => void
}

export function SalaryStep({ month, initialSalary, onComplete, onSkip, onBack }: Props) {
  const [employerName, setEmployerName] = useState(initialSalary?.employerName ?? '')
  const [grossAmount, setGrossAmount] = useState(initialSalary?.grossAmount ?? 0)
  const [deductions, setDeductions] = useState<SalaryDeductions>(initialSalary?.deductions ?? EMPTY_DEDUCTIONS)

  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)
  const netAmount = Math.max(0, grossAmount - totalDeductions)

  function updateDeduction(key: keyof SalaryDeductions, val: number) {
    setDeductions(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב 3 — משכורת</h2>

      <div className="space-y-3">
        <div>
          <label htmlFor="employer" className="block text-sm text-slate-400 mb-1">שם מעסיק</label>
          <input id="employer" aria-label="שם מעסיק" type="text" value={employerName}
            onChange={e => setEmployerName(e.target.value)}
            className="w-full bg-surface rounded-lg px-3 py-2" />
        </div>
        <div>
          <label htmlFor="gross" className="block text-sm text-slate-400 mb-1">ברוטו</label>
          <input id="gross" aria-label="ברוטו" type="number" value={grossAmount || ''}
            onChange={e => setGrossAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-surface rounded-lg px-3 py-2 tabular-nums" />
        </div>

        <div className="bg-surface rounded-xl p-4 space-y-2">
          <p className="text-sm text-slate-400 font-medium mb-1">ניכויים</p>
          {DEDUCTION_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <label htmlFor={key} className="flex-1 text-sm">{label}</label>
              <input id={key} aria-label={label} type="number" value={deductions[key] || ''}
                onChange={e => updateDeduction(key, parseFloat(e.target.value) || 0)}
                className="w-28 bg-background rounded px-2 py-1 text-left tabular-nums text-sm" />
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center bg-accent/10 rounded-xl px-4 py-3">
          <span className="font-semibold text-sm">נטו</span>
          <span data-testid="net-amount" className="font-bold text-lg tabular-nums">
            {netAmount.toLocaleString('he-IL')} ₪
          </span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>
        <button onClick={onSkip} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm text-slate-400">דלג</button>
        <button onClick={() => onComplete({ month, employerName, grossAmount, deductions, netAmount })}
          className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">הבא →</button>
      </div>
    </div>
  )
}
