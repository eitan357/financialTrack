import type { Transaction, Category } from '@/lib/types'
import { CategorySelect } from './CategorySelect'

interface Props {
  transaction: Transaction
  categories: Category[]
  onCategoryChange: (transactionId: string, categoryId: string | undefined) => void
  onDelete: (transactionId: string) => void
}

export function TransactionRow({ transaction, categories, onCategoryChange, onDelete }: Props) {
  const [, mm, dd] = transaction.date.split('-')
  const hasCategory = !!transaction.categoryId
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 w-10 flex-shrink-0 tabular-nums">{dd}/{mm}</span>
      <span className={`flex-1 text-sm truncate ${!hasCategory ? 'text-amber-400' : 'text-foreground'}`}>
        {transaction.merchantName}
      </span>
      <span className="text-sm tabular-nums flex-shrink-0">₪{transaction.amount.toLocaleString('he-IL')}</span>
      <CategorySelect
        value={transaction.categoryId}
        categories={categories}
        onChange={categoryId => onCategoryChange(transaction.id, categoryId)}
        className="w-28 flex-shrink-0"
      />
      <button
        onClick={() => onDelete(transaction.id)}
        aria-label="מחק עסקה"
        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 text-sm px-1"
      >✕</button>
    </div>
  )
}
