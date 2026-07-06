'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, Star } from 'lucide-react'
import { useDrag } from '@use-gesture/react'
import { useSpring, animated } from '@react-spring/web'
import { SwipeableCard } from './SwipeableCard'
import { ImportHUD } from './ImportHUD'
import { ImportTutorial, shouldShowTutorial } from './ImportTutorial'
import { sortDeckCards } from './deckUtils'
import type { DeckCard, SwipeRow, UndoEntry, CardStatus } from './deckUtils'
import type { Category, Account, InvestmentType } from '@/lib/types'

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
  const isAnimating = useRef(false)

  useEffect(() => { cardsRef.current = cards }, [cards])
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { streakCountRef.current = streakCount }, [streakCount])

  useEffect(() => {
    if (shouldShowTutorial()) setShowTutorial(true)
  }, [])

  // React-spring for card drag animation
  const [{ x, rotate }, springApi] = useSpring(() => ({ x: 0, rotate: 0 }))

  // Reset spring position when card changes (after swipe completes)
  const currentCard = cards[currentIndex]
  useEffect(() => {
    springApi.set({ x: 0, rotate: 0 })
  }, [currentCard?._id, springApi])

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

  const handleButtonSwipe = useCallback((dir: 'left' | 'right') => {
    if (isAnimating.current) return
    isAnimating.current = true
    setSwipeOverlay(null)

    const targetX = dir === 'right' ? window.innerWidth + 200 : -(window.innerWidth + 200)
    springApi.start({
      x: targetX,
      rotate: dir === 'right' ? 20 : -20,
      config: { duration: 220 },
    })
    setTimeout(() => {
      handleSwipe(dir)
      isAnimating.current = false
    }, 220)
  }, [springApi, handleSwipe])

  const bind = useDrag(
    ({ movement: [mx, my], velocity: [vx], last, memo }) => {
      if (isAnimating.current) return memo

      // Determine swipe axis on first significant movement
      if (memo == null) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) {
          if (last) { setSwipeOverlay(null); springApi.start({ x: 0, rotate: 0 }) }
          return null
        }
        return Math.abs(my) > Math.abs(mx) ? 'v' : 'h'
      }

      // Vertical gesture — let browser handle scroll, don't move card
      if (memo === 'v') {
        if (last) setSwipeOverlay(null)
        return 'v'
      }

      // Horizontal swipe
      const THRESHOLD = 60
      const shouldSwipe = last && (Math.abs(mx) > THRESHOLD || (Math.abs(vx) > 0.4 && Math.abs(mx) > 20))

      if (shouldSwipe) {
        handleButtonSwipe(mx > 0 ? 'right' : 'left')
      } else if (last) {
        setSwipeOverlay(null)
        springApi.start({ x: 0, rotate: 0 })
      } else {
        setSwipeOverlay(Math.abs(mx) > THRESHOLD ? (mx > 0 ? 'right' : 'left') : null)
        springApi.start({ x: mx, rotate: mx / 15, immediate: true })
      }

      return 'h'
    },
    { filterTaps: true }
  )

  function handleUndo() {
    if (undoStack.length === 0) return
    const [entry, ...rest] = undoStack
    setCards(cs => cs.map((c, i) => i === entry.index ? entry.previous : c))
    setCurrentIndex(entry.index)
    setUndoStack(rest)
    setStreakCount(0)
    setSwipeOverlay(null)
    springApi.set({ x: 0, rotate: 0 })
  }

  function updateCard(index: number, updates: Partial<SwipeRow>) {
    setCards(cs => cs.map((c, i) => i === index ? { ...c, ...updates } : c))
    setStreakCount(0)
  }

  function handleSave() {
    const toSave = cards.filter(c => c.status !== 'skipped' && !c.skip)
    onSave(toSave)
  }

  const approvedCards = cards.filter(c => c.status === 'approved')
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
        saving={saving}
        onSave={handleSave}
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
          <div className="relative w-full mb-4 overflow-hidden" style={{ height: '460px' }}>
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

            {/* Peek card (behind active card) */}
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

            {/* Active card — draggable */}
            {currentCard && (
              <animated.div
                {...bind()}
                style={{
                  x,
                  rotate,
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  cursor: 'grab',
                  willChange: 'transform',
                  touchAction: 'pan-y',
                }}
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
              </animated.div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
