import { SelectField } from '@/components/ui/SelectField'
import type { Category } from '@/lib/types'

interface Props {
  value?: string
  categories: Category[]
  onChange: (categoryId: string | undefined) => void
  className?: string
}

export function CategorySelect({ value, categories, onChange, className = '' }: Props) {
  return (
    <SelectField
      value={value ?? ''}
      onChange={v => onChange(v || undefined)}
      options={categories.map(c => ({ value: c.id, label: c.name, color: c.color }))}
      nullable
      nullLabel="ללא קטגוריה"
      placeholder="ללא קטגוריה"
      className={className}
    />
  )
}
