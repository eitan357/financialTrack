import type { InvestmentEntry, Dividend } from '@/lib/types'

export function InvestmentDepositRow({ entry, typeName, bankName }: {
  entry: InvestmentEntry
  typeName: string
  bankName: string | undefined
}) {
  const [, mm, dd] = entry.date.split('-')
  const ilsAmount = entry.ilsEquivalent ?? (entry.currency === 'ILS' ? entry.amount : null)
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-purple-400">הפקדה: {typeName}</span>
        {bankName && <span className="text-xs text-slate-500 block">{bankName}</span>}
      </div>
      {ilsAmount !== null && (
        <span className="text-sm tabular-nums text-purple-400 flex-shrink-0" dir="ltr">
          ₪-{ilsAmount.toLocaleString('he-IL')}
        </span>
      )}
    </div>
  )
}

export function DividendPayoutRow({ dividend, typeName }: {
  dividend: Dividend
  typeName: string
}) {
  const [, mm, dd] = dividend.date.split('-')
  const ilsAmount = dividend.ilsEquivalent ?? (dividend.currency === 'ILS' ? dividend.amount : null)
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-purple-400">הכנסה: {typeName}</span>
      </div>
      {ilsAmount !== null && (
        <span className="text-sm tabular-nums text-green-400 flex-shrink-0" dir="ltr">
          ₪+{ilsAmount.toLocaleString('he-IL')}
        </span>
      )}
    </div>
  )
}
