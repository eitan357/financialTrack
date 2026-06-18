import type { CategorySummary } from '@/lib/dashboard/compute'

interface Props {
  categories: CategorySummary[]
  onClick?: () => void
}

export function CategoryProgress({ categories, onClick }: Props) {
  if (categories.length === 0) return null
  return (
    <div
      className={`bg-surface rounded-2xl p-4 space-y-3 ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-400">הוצאות לפי קטגוריה</h2>
        {onClick && <span className="text-xs text-slate-600">›</span>}
      </div>
      {categories.map(cat => {
        const pct = cat.target ? Math.min(100, (cat.actual / cat.target) * 100) : null
        const isOver = cat.target !== null && cat.actual > cat.target
        return (
          <div key={cat.id}>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </span>
              <span className={isOver ? 'text-red-400' : 'text-slate-300'}>
                ₪{cat.actual.toLocaleString('he-IL')}
                {cat.target !== null && (
                  <span className="text-slate-500"> / ₪{cat.target.toLocaleString('he-IL')}</span>
                )}
              </span>
            </div>
            {pct !== null && (
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  data-testid="progress-bar"
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
