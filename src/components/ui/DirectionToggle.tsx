'use client'

interface Props {
  value: 'expense' | 'income'
  onChange: (v: 'expense' | 'income') => void
  size?: 'sm' | 'md'
}

export function DirectionToggle({ value, onChange, size = 'md' }: Props) {
  const py = size === 'sm' ? 'py-1.5' : 'py-2'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-700">
      <button
        type="button"
        onClick={() => onChange('expense')}
        className={`flex-1 ${py} ${textSize} font-medium transition-colors ${
          value === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-slate-400'
        }`}
      >הוצאה</button>
      <button
        type="button"
        onClick={() => onChange('income')}
        className={`flex-1 ${py} ${textSize} font-medium transition-colors ${
          value === 'income' ? 'bg-green-500/20 text-green-400' : 'text-slate-400'
        }`}
      >הכנסה</button>
    </div>
  )
}
