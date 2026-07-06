'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, Star } from 'lucide-react'
import TinderCard from 'react-tinder-card'
import { SwipeableCard } from './SwipeableCard'
import { ImportHUD } from './ImportHUD'
import { ImportTutorial, shouldShowTutorial } from './ImportTutorial'
import { sortDeckCards } from './deckUtils'
import type { DeckCard, SwipeRow, UndoEntry, CardStatus } from './deckUtils'
import type { Category, Account, InvestmentType } from '@/lib/types'

type API = { swipe(dir?: string): Promise<void>; restoreCard(): Promise<void> }

interface Props {
  rows: SwipeRow[]
  categories: Category[]
  portfolioAccounts?: Account[]
  investmentTypes?: InvestmentType[]
  accountName: string
  month: string
  saving: boolean
  onSave: (approved: SwipeRow[]) => void
  onDone: () => void
}

export function SwipeImportDeck({
  rows,
  categories,
  portfolioAccounts = [],
  investmentTypes = [],
  accountName,
  month,
  saving,
  onSave,
  onDone,
}: Props) {
  const [cards, setCards] = useState<DeckCard[]>(() =>
    sortDeckCards(
      rows.map((r, i) => ({
        ...r,
        _id: String(i),
        status: 'pending' as CardStatus,
      }))
    )
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [points, setPoints] = useState(0)
  const [streakCount, setStreakCount] = useState(0)
  const [popup, setPopup] = useState<{ pts: number; streak: boolean; key: number } | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [swipeOverlay, setSwipeOverlay] = useState<'left' | 'right' | null>(null)

  const cardsRef = useRef(cards)
  const currentIndexRef = useRef(currentIndex)
  const streakCountRef = useRef(streakCount)
  const cardRef = useRef<API>(null)

  useEffect(() => { cardsRef.current = cards }, [cards])
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { streakCountRef.current = streakCount }, [streakCount])

  useEffect(() => {
    if (shouldShowTutorial()) setShowTutorial(true)
  }, [])

  function firePointsPopup(pts: number, streak: boolean) {
    setPoints(p => p + pts)
    setPopup({ pts, streak, key: Date.now() })
    setTimeout(() => setPopup(null), 900)
  }

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const idx = currentIndexRef.current
    const currentCards = cardsRef.current
    const card = currentCards[idx]
    if (!card) return

    setSwipeOverlay(null)
    const newStatus: CardStatus = direction === 'right' ? 'approved' : 'skipped'
    setCards(cs => cs.map((c, i) => i === idx ? { ...c, status: newStatus } : c))
    setUndoStack(stack => [{ index: idx, previous: card }, ...stack.slice(0, 4)])

    const currentStreak = streakCountRef.current
    const newStreak = currentStreak + 1
    let pts = direction === 'right' ? 2 : 1
    let isStreak = false
    if (newStreak % 5 === 0) { pts += 5; isStreak = true }
    firePointsPopup(pts, isStreak)

    if (idx + 1 >= currentCards.length) {
      setTimeout(() => firePointsPopup(20, false), 500)
    }

    setStreakCount(newStreak)
    setCurrentIndex(idx + 1)
  }, [])

  // Called by action buttons (inside card in Task 2, external until then)
  const handleButtonSwipe = useCallback(async (dir: 'left' | 'right') => {
    await cardRef.current?.swipe(dir)
  }, [])

  function handleUndo() {
    if (undoStack.length === 0) return
    const [entry, ...rest] = undoStack
    setCards(cs => cs.map((c, i) => i === entry.index ? entry.previous : c))
    setCurrentIndex(entry.index)
    setUndoStack(rest)
    setStreakCount(0)
    setSwipeOverlay(null)
  }

  function updateCard(index: number, updates: Partial<SwipeRow>) {
    setCards(cs => cs.map((c, i) => i === index ? { ...c, ...updates } : c))
    setStreakCount(0)
  }

  const approvedCards = cards.filter(c => c.status === 'approved')
  const currentCard = cards[currentIndex]
  const nextCard = cards[currentIndex + 1]
  const isDeckComplete = currentIndex >= cards.length

  return (
    <div dir="rtl">
      {showTutorial && <ImportTutorial onDismiss={() => setShowTutorial(false)} />}

      <ImportHUD
        accountName={accountName}
        month={month}
        cards={cards}
        points={points}
        approvedCount={approvedCards.length}
        saving={saving}
        onSave={() => onSave(approvedCards)}
        onShowTutorial={() => setShowTutorial(true)}
        onUndo={handleUndo}
        undoEnabled={undoStack.length > 0}
      />

      {isDeckComplete ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold">סיימת!</h2>
          <div className="flex items-center justify-center gap-1 text-amber-400">
            <Star size={18} className="fill-amber-400" />
            <span className="text-lg font-semibold tabular-nums">{points} נקודות</span>
          </div>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => onSave(approvedCards)}
              disabled={saving || approvedCards.length === 0}
              className="w-full py-3 bg-accent rounded-xl font-semibold disabled:opacity-50"
            >
              {saving ? 'שומר...' : `שמור ויבא ${approvedCards.length} עסקאות`}
            </button>
            <button onClick={onDone} className="w-full py-3 border border-slate-600 rounded-xl text-slate-300 text-sm">
              עבור לעמוד עסקאות
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Card stack */}
          <div className="relative w-full mb-4" style={{ height: '460px' }}>
            {popup && (
              <div
                key={popup.key}
                className="absolute bottom-4 left-1/2 pointer-events-none z-50"
                style={{ animation: 'float-up 0.8s ease-out forwards' }}
              >
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  popup.streak
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-accent/20 text-accent border border-accent/40'
                }`}>
                  ★ +{popup.pts}{popup.streak ? ' רצף!' : ''}
                </span>
              </div>
            )}

            {/* Peek card (no TinderCard wrapper) */}
            {nextCard && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ transform: 'scale(0.95) translateY(8px)', zIndex: 1, transformOrigin: 'center bottom' }}
              >
                <SwipeableCard
                  card={nextCard}
                  categories={categories}
                  portfolioAccounts={portfolioAccounts}
                  investmentTypes={investmentTypes}
                  peek
                  swipeOverlay={null}
                  onSwipe={() => {}}
                  onChange={() => {}}
                />
              </div>
            )}

            {/* Active card wrapped in TinderCard */}
            {currentCard && (
              <div className="absolute inset-0" style={{ zIndex: 2 }}>
                <TinderCard
                  key={currentCard._id}
                  ref={cardRef as React.Ref<API>}
                  onSwipe={(dir) => handleSwipe(dir as 'left' | 'right')}
                  onSwipeRequirementFulfilled={(dir) => setSwipeOverlay(dir as 'left' | 'right')}
                  onSwipeRequirementUnfulfilled={() => setSwipeOverlay(null)}
                  preventSwipe={['up', 'down']}
                  swipeRequirementType="position"
                  swipeThreshold={60}
                  flickOnSwipe
                  className="absolute inset-0"
                >
                  <SwipeableCard
                    card={currentCard}
                    categories={categories}
                    portfolioAccounts={portfolioAccounts}
                    investmentTypes={investmentTypes}
                    swipeOverlay={swipeOverlay}
                    onSwipe={handleButtonSwipe}
                    onChange={updates => updateCard(currentIndex, updates)}
                  />
                </TinderCard>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  )
}
