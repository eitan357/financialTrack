interface Props {
  label: string
  amount: number
  color?: string
  prefix?: string
}

export function SummaryCard({ label, amount, color, prefix = '₪' }: Props) {
  const isNegative = amount < 0
  const colorClass = color ?? (isNegative ? 'text-red-400' : 'text-foreground')
  return (
    <div className="bg-surface rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span data-testid="amount" className={`text-xl font-bold tabular-nums ${colorClass}`}>
        {prefix}{Math.abs(amount).toLocaleString('he-IL')}
      </span>
    </div>
  )
}
