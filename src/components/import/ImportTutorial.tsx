'use client'
import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'

const TUTORIAL_KEY = 'import-swipe-tutorial-v1'

export function shouldShowTutorial(): boolean {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(TUTORIAL_KEY)
}

interface Props {
  onDismiss: () => void
}

function SlideRight() {
  return (
    <div className="relative h-32 w-52 mx-auto overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center animate-[tutorial-right_2.2s_ease-in-out_infinite]">
        <div className="w-44 h-28 bg-surface border border-slate-600 rounded-xl relative flex flex-col items-center justify-center gap-1 shadow-lg">
          <span className="text-sm font-medium text-foreground">מקדונלד&apos;ס</span>
          <span className="text-xs text-slate-400">45.00 ₪</span>
          <div className="absolute inset-0 bg-green-500/30 rounded-xl flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={20} className="text-white" strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideLeft() {
  return (
    <div className="relative h-32 w-52 mx-auto overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center animate-[tutorial-left_2.2s_ease-in-out_infinite]">
        <div className="w-44 h-28 bg-surface border border-slate-600 rounded-xl relative flex flex-col items-center justify-center gap-1 shadow-lg">
          <span className="text-sm font-medium text-foreground">מכולת שכונה</span>
          <span className="text-xs text-slate-400">120.00 ₪</span>
          <div className="absolute inset-0 bg-red-500/30 rounded-xl flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
              <Trash2 size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideEdit() {
  return (
    <div className="h-32 w-52 mx-auto">
      <div className="w-full h-full bg-surface border border-slate-600 rounded-xl p-3 space-y-1.5 shadow-lg">
        <div className="flex justify-between">
          <span className="text-xs font-medium text-foreground">קפה גרג</span>
          <span className="text-xs text-slate-400">18.00 ₪</span>
        </div>
        <div className="ring-1 ring-amber-400 rounded-md px-2 py-1 text-xs text-amber-400">
          ⚠️ לא מוגדרת
        </div>
        <div className="flex gap-1">
          <div className="flex-1 bg-slate-700 rounded-md px-2 py-1 text-xs text-slate-300 text-center">
            הוצאה
          </div>
        </div>
        <div className="border border-slate-600 rounded-full px-2 py-0.5 text-xs text-slate-400 text-center">
          חיוב מיידי
        </div>
      </div>
    </div>
  )
}

const SLIDES = [
  {
    title: 'החלק ימינה לאישור העסקה',
    demo: <SlideRight />,
  },
  {
    title: 'החלק שמאלה לדילוג על העסקה',
    demo: <SlideLeft />,
  },
  {
    title: 'ערוך פרטים ישירות על הכרטיסיה לפני האישור',
    demo: <SlideEdit />,
  },
]

export function ImportTutorial({ onDismiss }: Props) {
  const [slide, setSlide] = useState(0)

  function dismiss() {
    localStorage.setItem(TUTORIAL_KEY, '1')
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" dir="rtl">
      <div className="w-full max-w-sm bg-surface rounded-2xl p-6">
        {SLIDES[slide].demo}
        <p className="text-center text-base font-semibold mt-4 mb-6">
          {SLIDES[slide].title}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === slide ? 'bg-accent' : 'bg-slate-600'}`}
              />
            ))}
          </div>
          {slide < SLIDES.length - 1 ? (
            <button
              onClick={() => setSlide(s => s + 1)}
              className="px-4 py-2 bg-accent rounded-lg text-sm font-semibold"
            >
              הבא
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="px-4 py-2 bg-accent rounded-lg text-sm font-semibold"
            >
              הבנתי!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
