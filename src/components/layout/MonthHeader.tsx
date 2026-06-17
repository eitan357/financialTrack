'use client'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useState } from 'react'
import { MonthPicker } from '@/components/MonthPicker'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

export function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

export function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  month: string
  onMonthChange: (m: string) => void
  className?: string
}

export function MonthHeader({ month, onMonthChange, className = 'mb-6' }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className={className}>
      <div className="relative flex items-center justify-center">
        <Link
          href="/settings"
          aria-label="הגדרות"
          className="absolute left-0 p-1.5 text-slate-500 hover:text-foreground transition-colors"
        >
          <Settings size={16} />
        </Link>
        <div className="flex items-center gap-0.5" dir="ltr">
          <button
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="חודש קודם"
            className="text-slate-400 text-2xl w-6 flex items-center justify-center leading-none"
          >‹</button>
          <button
            onClick={() => setPickerOpen(p => !p)}
            aria-label="בחר חודש"
            className="text-lg font-bold hover:text-accent transition-colors px-1"
          >
            {formatMonth(month)}
          </button>
          <button
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="חודש הבא"
            className="text-slate-400 text-2xl w-6 flex items-center justify-center leading-none"
          >›</button>
        </div>
      </div>
      {pickerOpen && (
        <MonthPicker
          value={month}
          onChange={m => { onMonthChange(m); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
