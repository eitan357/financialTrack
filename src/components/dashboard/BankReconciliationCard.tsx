import type { BankReconciliation } from '@/lib/types'

interface Props {
  reconciliation: BankReconciliation | null
}

export function BankReconciliationCard({ reconciliation }: Props) {
  if (!reconciliation) {
    return (
      <div className="bg-surface rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-2">אימות יתרת בנק</h2>
        <p className="text-slate-500 text-sm">לא בוצע אימות החודש</p>
      </div>
    )
  }
  const diff = reconciliation.actualBalance - reconciliation.expectedBalance
  const isMatch = Math.abs(diff) < 1
  return (
    <div className="bg-surface rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-slate-400 mb-3">אימות יתרת בנק</h2>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-lg font-bold ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
          {isMatch ? '✓' : '✗'}
        </span>
        <span className={`font-semibold text-sm ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
          {isMatch ? 'תואם' : `פער: ₪${Math.abs(diff).toLocaleString('he-IL')}`}
        </span>
      </div>
      <div className="text-xs text-slate-400 space-y-0.5">
        <div>יתרה בפועל: <span className="text-slate-200 tabular-nums">₪{reconciliation.actualBalance.toLocaleString('he-IL')}</span></div>
        <div>יתרה צפויה: <span className="text-slate-200 tabular-nums">₪{reconciliation.expectedBalance.toLocaleString('he-IL')}</span></div>
      </div>
    </div>
  )
}
