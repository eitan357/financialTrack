'use client'
import { SelectField } from '@/components/ui/SelectField'
import { CurrencyPicker } from '@/components/ui/CurrencyPicker'
import { InvestmentPicker } from '@/components/investments/InvestmentPicker'
import type { InvestmentSelection } from '@/components/investments/InvestmentPicker'
import { Check, Trash2 } from 'lucide-react'
import type { Category, Account, InvestmentType } from '@/lib/types'
import type { DeckCard, SwipeRow } from './deckUtils'

interface Props {
  card: DeckCard
  categories: Category[]
  portfolioAccounts: Account[]
  investmentTypes: InvestmentType[]
  peek?: boolean
  swipeOverlay?: 'left' | 'right' | null
  onSwipe: (direction: 'left' | 'right') => void
  onChange: (updates: Partial<SwipeRow>) => void
}

export function SwipeableCard({
  card,
  categories,
  portfolioAccounts,
  investmentTypes,
  peek = false,
  swipeOverlay = null,
  onSwipe,
  onChange,
}: Props) {
  const activeCategories = categories.filter(c => c.isActive !== false)

  const skipReasonLabel =
    card.skipReason === 'salary' ? 'משכורת — מסונן אוטומטית'
    : card.skipReason === 'credit-payment' ? 'תשלום אשראי — מסונן אוטומטית'
    : card.skipReason === 'investment-transfer' ? 'העברה להשקעות — מסונן אוטומטית'
    : null

  return (
    <div
      className={`w-full h-full bg-surface rounded-2xl shadow-xl border border-slate-700 overflow-hidden select-none relative flex flex-col ${peek ? 'pointer-events-none' : ''}`}
    >
      {/* Approve overlay */}
      {!peek && swipeOverlay === 'right' && (
        <div className="absolute inset-0 bg-green-500/30 rounded-2xl flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}
      {/* Skip overlay */}
      {!peek && swipeOverlay === 'left' && (
        <div className="absolute inset-0 bg-red-500/30 rounded-2xl flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 size={28} className="text-white" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between p-4 pb-3 border-b border-slate-700/50 flex-shrink-0 ${card.skip ? 'opacity-60' : ''}`}>
        <div>
          <h3 className="text-base font-semibold leading-tight">{card.merchantName}</h3>
          <p className="text-slate-400 text-sm mt-0.5">{card.date}</p>
        </div>
        <div className="text-left flex items-center gap-1">
          <span className="text-xl font-bold tabular-nums">{card.amount.toFixed(2)}</span>
          {!peek && (
            <CurrencyPicker
              value={card.currency}
              onChange={v => onChange({ currency: v })}
            />
          )}
          {peek && <span className="text-sm text-slate-400">{card.currency}</span>}
        </div>
      </div>

      {/* Body (hidden in peek mode) */}
      {!peek && (
        <>
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {skipReasonLabel && (
              <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-400">
                {skipReasonLabel}
              </div>
            )}

            {!card.portfolioAccountId && (
              <div className="flex flex-col items-center">
                <label className="text-xs text-slate-400 mb-1 block">כיוון</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm w-48">
                  <button
                    type="button"
                    onClick={() => onChange({ direction: 'expense', categoryId: card.direction === 'income' ? null : card.categoryId })}
                    className={`flex-1 py-1.5 transition-colors ${card.direction === 'expense' ? 'bg-red-900/60 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    הוצאה
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ direction: 'income', categoryId: null })}
                    className={`flex-1 py-1.5 transition-colors ${card.direction === 'income' ? 'bg-green-900/60 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    הכנסה
                  </button>
                </div>
              </div>
            )}

            {/* Category */}
            {card.direction === 'expense' && !card.portfolioAccountId && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">קטגוריה</label>
                <SelectField
                  value={card.categoryId ?? ''}
                  onChange={v => onChange({ categoryId: v || null, categorizationSource: 'manual' })}
                  options={activeCategories.map(c => ({ value: c.id, label: c.name, color: c.color }))}
                  nullable
                  nullLabel="— ללא —"
                  placeholder="⚠️ לא מוגדרת"
                  className={!card.categoryId ? 'ring-1 ring-amber-400' : undefined}
                />
              </div>
            )}

            {/* Immediate debit toggle */}
            <button
              type="button"
              onClick={() => onChange({ isImmediate: !card.isImmediate })}
              className={`w-full py-2 rounded-full text-sm transition-colors ${
                card.isImmediate
                  ? 'bg-amber-500/20 border border-amber-500 text-amber-400 font-semibold'
                  : 'border border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              חיוב מיידי
            </button>

            {/* Notes */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">הערה</label>
              <input
                value={card.notes ?? ''}
                onChange={e => onChange({ notes: e.target.value })}
                placeholder="הוסף הערה..."
                className="w-full bg-background text-sm rounded-lg px-3 py-2 border border-slate-700 outline-none focus:border-slate-500"
              />
            </div>

            {/* Investment picker */}
            {portfolioAccounts.length > 0 && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">השקעה</label>
                <InvestmentPicker
                  portfolios={portfolioAccounts}
                  types={investmentTypes}
                  openInPortal
                  value={
                    card.portfolioAccountId
                      ? { portfolioAccountId: card.portfolioAccountId, investmentTypeId: card.investmentTypeId }
                      : null
                  }
                  onChange={(sel: InvestmentSelection | null) => {
                    if (sel) {
                      onChange({
                        portfolioAccountId: sel.portfolioAccountId,
                        investmentTypeId: sel.investmentTypeId,
                        investmentDirection: card.investmentDirection ?? 'investment',
                        skip: false,
                        categoryId: null,
                      })
                    } else {
                      onChange({ portfolioAccountId: undefined, investmentTypeId: undefined, investmentDirection: undefined })
                    }
                  }}
                />
                {card.portfolioAccountId && (
                  <div className="flex mt-1 rounded-lg overflow-hidden border border-slate-700 text-sm">
                    <button
                      type="button"
                      onClick={() => onChange({ investmentDirection: 'investment' })}
                      className={`flex-1 py-1 ${(card.investmentDirection ?? 'investment') === 'investment' ? 'bg-green-900/60 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      קנייה
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ investmentDirection: 'divestment' })}
                      className={`flex-1 py-1 ${card.investmentDirection === 'divestment' ? 'bg-red-900/60 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      מכירה
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons — sticky at card bottom */}
          <div className="flex border-t border-slate-700/50 flex-shrink-0">
            <button
              type="button"
              onClick={() => onSwipe('left')}
              className="flex-1 py-3 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
            >
              ✗ דלג
            </button>
            <div className="w-px bg-slate-700/50" />
            <button
              type="button"
              onClick={() => onSwipe('right')}
              className="flex-1 py-3 text-green-400 text-sm font-semibold hover:bg-green-500/10 transition-colors"
            >
              ✓ אשר
            </button>
          </div>
        </>
      )}
    </div>
  )
}
