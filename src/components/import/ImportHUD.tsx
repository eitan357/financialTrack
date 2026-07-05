'use client'
import { Star, HelpCircle } from 'lucide-react'
import { computeTotals } from './deckUtils'
import type { DeckCard } from './deckUtils'

interface Props {
  accountName: string
  month: string
  cards: DeckCard[]
  points: number
  approvedCount: number
  saving: boolean
  onSave: () => void
  onShowTutorial: () => void
}

export function ImportHUD({
  accountName,
  month,
  cards,
  points,
  approvedCount,
  saving,
  onSave,
  onShowTutorial,
}: Props) {
  const total = cards.length
  const processed = cards.filter(c => c.status !== 'pending').length
  const progress = total > 0 ? processed / total : 0
  const { income, expenses, net } = computeTotals(cards)

  return (
    <div className="mb-4 space-y-2">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-200 font-medium truncate">{accountName}</span>
          <span className="text-slate-500 text-sm flex-shrink-0">{month}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onShowTutorial}
            className="p-1 text-slate-400 hover:text-foreground transition-colors"
            title="עזרה"
            aria-label="פתח מדריך"
          >
            <HelpCircle size={18} />
          </button>
          <button
            onClick={onSave}
            disabled={saving || approvedCount === 0}
            className="px-3 py-1.5 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50 tabular-nums"
          >
            {saving ? '...' : `שמור ${approvedCount}`}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
          {processed} / {total}
        </span>
      </div>

      {/* Points */}
      <div className="flex items-center gap-1 text-sm text-amber-400">
        <Star size={14} className="fill-amber-400" />
        <span className="tabular-nums">{points}</span>
        <span>נקודות</span>
      </div>

      {/* Totals */}
      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span>
          הוצאות{' '}
          <span className="text-red-400 tabular-nums">₪{expenses.toFixed(0)}</span>
        </span>
        <span>·</span>
        <span>
          הכנסות{' '}
          <span className="text-green-400 tabular-nums">₪{income.toFixed(0)}</span>
        </span>
        <span>·</span>
        <span>
          נטו{' '}
          <span className={`tabular-nums ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ₪{net.toFixed(0)}
          </span>
        </span>
      </div>
    </div>
  )
}
