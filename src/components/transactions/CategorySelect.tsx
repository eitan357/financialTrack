import type { Category } from '@/lib/types'

interface Props {
  value?: string
  categories: Category[]
  onChange: (categoryId: string | undefined) => void
  className?: string
}

export function CategorySelect({ value, categories, onChange, className = '' }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
      className={`bg-slate-800 border border-slate-700 rounded-lg text-xs px-2 py-1 text-foreground ${className}`}
    >
      <option value="">ללא קטגוריה</option>
      {categories.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
