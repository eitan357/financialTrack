'use client'

interface Props {
  value: 'expense' | 'income'
  onChange: (v: 'expense' | 'income') => void
  size?: 'sm' | 'md'
}

export function DirectionToggle({ value, onChange, size = 'md' }: Props) {
  const py = size === 'sm' ? 'py-1' : 'py-2'
  const px = size === 'sm' ? 'px-2' : 'px-3'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const isExpense = value === 'expense'
  return (
    <button
      type="button"
      onClick={() => onChange(isExpense ? 'income' : 'expense')}
      className={`rounded-lg ${py} ${px} ${textSize} font-medium transition-colors ${
        isExpense
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
      }`}
    >
      {isExpense ? '↓ הוצאה' : '↑ הכנסה'}
    </button>
  )
}
