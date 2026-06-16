import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

interface Props {
  summary: MonthlyExpenseSummary
}

export function MonthSummaryRow({ summary }: Props) {
  const [y, mo] = summary.month.split('-')
  const monthLabel = `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
  const top3 = summary.byCategory.slice(0, 3)

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className="w-24 flex-shrink-0">
        <span className="text-sm font-medium">{monthLabel}</span>
      </div>
      <div className="w-24 flex-shrink-0 text-left">
        <span className="text-sm tabular-nums font-mono">₪{summary.totalExpenses.toLocaleString('he-IL')}</span>
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        {top3.map(cat => (
          <span
            key={cat.categoryId}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: cat.color + '33', color: cat.color }}
          >
            {cat.name}
          </span>
        ))}
      </div>
    </div>
  )
}
