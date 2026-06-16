'use client'
import { useState } from 'react'
import type { CategorizationRule, Category } from '@/lib/types'
import { CategorySelect } from './CategorySelect'

interface NewRule {
  keyword: string
  matchType: 'contains'
  categoryId: string
  priority: number
  createdAt: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  rules: CategorizationRule[]
  categories: Category[]
  onAdd: (rule: NewRule) => void
  onDelete: (ruleId: string) => void
}

export function RulesModal({ isOpen, onClose, rules, categories, onAdd, onDelete }: Props) {
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()

  if (!isOpen) return null

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim() || !categoryId) return
    onAdd({ keyword: keyword.trim(), matchType: 'contains', categoryId, priority: 10, createdAt: new Date().toISOString() })
    setKeyword('')
    setCategoryId(undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-slate-900 w-full max-h-[80vh] rounded-t-2xl overflow-y-auto">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900">
          <h2 className="font-semibold">חוקי קטגוריזציה</h2>
          <button onClick={onClose} aria-label="סגור" className="text-slate-400 text-lg px-2">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-32">
              <label className="text-xs text-slate-400 block mb-1">מילת מפתח</label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="למשל: שופרסל"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">קטגוריה</label>
              <select
                value={categoryId ?? ''}
                onChange={e => setCategoryId(e.target.value || undefined)}
                className="bg-slate-800 border border-slate-700 rounded-lg text-xs px-2 py-1 text-foreground"
              >
                <option value="">ללא קטגוריה</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{`​${c.name}`}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              aria-label="הוסף"
              disabled={!keyword.trim() || !categoryId}
              className="bg-accent text-white px-3 py-2 rounded-lg text-sm disabled:opacity-40"
            >הוסף</button>
          </form>
          <div className="space-y-2">
            {rules.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">אין חוקים עדיין</p>
            ) : rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2">
                <span className="text-sm">{rule.keyword}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{categoryMap[rule.categoryId]?.name ?? rule.categoryId}</span>
                  <button
                    onClick={() => onDelete(rule.id)}
                    aria-label="מחק חוק"
                    className="text-slate-600 hover:text-red-400 text-sm"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
