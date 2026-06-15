import type { Dividend, InvestmentType } from '@/lib/types'

interface Props {
  dividends: Dividend[]
  investmentTypes: InvestmentType[]
}

export function DividendsCard({ dividends, investmentTypes }: Props) {
  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))
  const totalIls = dividends.reduce((s, d) => s + (d.ilsEquivalent ?? 0), 0)
  return (
    <div className="bg-surface rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-slate-400">דיבידנדים החודש</h2>
        {totalIls > 0 && (
          <span data-testid="dividends-total" className="text-sm font-bold text-green-400 tabular-nums">
            ₪{totalIls.toLocaleString('he-IL')}
          </span>
        )}
      </div>
      {dividends.length === 0 ? (
        <p className="text-slate-500 text-sm">אין דיבידנדים החודש</p>
      ) : (
        <div className="space-y-1.5">
          {dividends.map(d => (
            <div key={d.id} className="flex justify-between text-xs">
              <span className="text-slate-300">{typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId}</span>
              <span className="tabular-nums">
                {d.amount.toLocaleString('he-IL')} {d.currency}
                {d.ilsEquivalent !== undefined && (
                  <span className="text-slate-500 mr-1.5">(₪{d.ilsEquivalent.toLocaleString('he-IL')})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
