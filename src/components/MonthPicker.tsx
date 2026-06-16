'use client'
import { useState } from 'react'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

interface Props {
  value: string       // YYYY-MM
  onChange: (month: string) => void
  onClose: () => void
}

export function MonthPicker({ value, onChange, onClose }: Props) {
  const [year, setYear] = useState(() => parseInt(value.split('-')[0], 10))
  const selectedMonth = value

  function selectMonth(monthIndex: number) {
    const m = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    onChange(m)
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl w-72"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setYear(y => y - 1)}
            aria-label="שנה קודמת"
            className="text-slate-400 hover:text-foreground text-xl w-8 text-center"
          >‹</button>
          <span className="font-semibold tabular-nums">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            aria-label="שנה הבאה"
            className="text-slate-400 hover:text-foreground text-xl w-8 text-center"
          >›</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {HE_MONTHS.map((name, i) => {
            const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`
            const isSelected = monthStr === selectedMonth
            return (
              <button
                key={name}
                onClick={() => selectMonth(i)}
                className={`py-2 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? 'bg-accent text-white font-semibold'
                    : 'hover:bg-slate-800 text-foreground'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
