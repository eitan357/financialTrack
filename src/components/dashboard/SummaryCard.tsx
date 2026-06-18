interface Props {
  label: string
  amount: number
  color?: string
  prefix?: string
  onClick?: () => void
}

export function SummaryCard({ label, amount, color, prefix = '₪', onClick }: Props) {
  const isNegative = amount < 0
  const colorClass = color ?? (isNegative ? 'text-red-400' : 'text-foreground')
  return (
    <div
      className={`bg-surface rounded-2xl p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">{label}</span>
        {onClick && <span className="text-xs text-slate-600">›</span>}
      </div>
      <span data-testid="amount" className={`text-xl font-bold tabular-nums ${colorClass}`}>
        {prefix}{Math.abs(amount).toLocaleString('he-IL')}
      </span>
    </div>
  )
}
