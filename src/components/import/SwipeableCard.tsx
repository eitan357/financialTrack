'use client'
import { useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Check, Trash2 } from 'lucide-react'
import { SelectField } from '@/components/ui/SelectField'
import { DirectionToggle } from '@/components/ui/DirectionToggle'
import { CurrencyPicker } from '@/components/ui/CurrencyPicker'
import { InvestmentPicker } from '@/components/investments/InvestmentPicker'
import type { InvestmentSelection } from '@/components/investments/InvestmentPicker'
import type { Category, Account, InvestmentType } from '@/lib/types'
import type { DeckCard, SwipeRow } from './deckUtils'

interface Props {
  card: DeckCard
  categories: Category[]
  portfolioAccounts: Account[]
  investmentTypes: InvestmentType[]
  peek?: boolean
  onSwipe: (direction: 'left' | 'right') => void
  onChange: (updates: Partial<SwipeRow>) => void
}

export function SwipeableCard({
  card,
  categories,
  portfolioAccounts,
  investmentTypes,
  peek = false,
  onSwipe,
  onChange,
}: Props) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx] }) => {
      if (active) {
        setIsDragging(true)
        setDragX(mx)
      } else {
        setIsDragging(false)
        const shouldSwipe = Math.abs(mx) > 60 || Math.abs(vx) > 0.5
        if (shouldSwipe) {
          const dir = dx > 0 ? 'right' : 'left'
          setDragX(dx > 0 ? 600 : -600)
          setTimeout(() => {
            onSwipe(dir)
            setDragX(0)
          }, 300)
        } else {
          setDragX(0)
        }
      }
    },
    { axis: 'x', filterTaps: true }
  )

  const rotation = Math.min(Math.max(dragX / 20, -15), 15)
  const approveOpacity = Math.min(dragX / 120, 0.9)
  const skipOpacity = Math.min(Math.abs(dragX) / 120, 0.9)

  const activeCategories = categories.filter(c => c.isActive !== false)

  const skipReasonLabel =
    card.skipReason === 'salary' ? 'משכורת — מסונן אוטומטית'
    : card.skipReason === 'credit-payment' ? 'תשלום אשראי — מסונן אוטומטית'
    : card.skipReason === 'investment-transfer' ? 'העברה להשקעות — מסונן אוטומטית'
    : null

  return (
    <div
      {...(peek ? {} : bind())}
      className={`w-full h-full bg-surface rounded-2xl shadow-xl border border-slate-700 overflow-hidden select-none relative ${peek ? 'pointer-events-none' : ''}`}
      style={{
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        touchAction: 'pan-y',
        cursor: peek ? 'default' : 'grab',
      }}
    >
      {/* Approve overlay */}
      {!peek && dragX > 0 && (
        <div
          className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center pointer-events-none z-10"
          style={{ opacity: approveOpacity }}
        >
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}
      {/* Skip overlay */}
      {!peek && dragX < 0 && (
        <div
          className="absolute inset-0 bg-red-500/20 rounded-2xl flex items-center justify-center pointer-events-none z-10"
          style={{ opacity: skipOpacity }}
        >
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 size={28} className="text-white" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between p-4 pb-3 border-b border-slate-700/50 ${card.skip ? 'opacity-60' : ''}`}>
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
        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 80px)' }}>
          {/* Skip reason badge */}
          {skipReasonLabel && (
            <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-400">
              {skipReasonLabel}
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

          {/* Direction */}
          {!card.portfolioAccountId && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">כיוון</label>
              <DirectionToggle
                value={card.direction}
                onChange={v => onChange({ direction: v, categoryId: v === 'income' ? null : card.categoryId })}
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
      )}
    </div>
  )
}
