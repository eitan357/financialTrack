'use client'
import { useState, useEffect } from 'react'
import { getCategories } from '@/lib/firestore/categories'
import { getRules, addRule } from '@/lib/firestore/categorization-rules'
import type { Category } from '@/lib/types'

// Derived from the IFS formula in the Excel file.
// groupLabel is used to pre-match a Firestore category by name.
const FORMULA_RULES: Array<{
  keyword: string
  matchType: 'contains' | 'startsWith' | 'exact'
  groupLabel: string
}> = [
  { keyword: 'צמרת', matchType: 'contains', groupLabel: 'אוכל' },
  { keyword: 'שופרסל', matchType: 'contains', groupLabel: 'אוכל' },
  { keyword: 'רמי לוי', matchType: 'contains', groupLabel: 'אוכל' },
  { keyword: 'החישוק', matchType: 'contains', groupLabel: 'אוכל' },
  { keyword: 'גילת טלקום', matchType: 'contains', groupLabel: 'חשבונות' },
  { keyword: 'פיזיקל', matchType: 'contains', groupLabel: 'קורסים וחוגים' },
  { keyword: 'עיריית גבעתיים', matchType: 'contains', groupLabel: 'חשבונות' },
  { keyword: 'מ.תחבורה', matchType: 'contains', groupLabel: 'תחבורה' },
  { keyword: 'בית מרקחת', matchType: 'contains', groupLabel: 'רפואה' },
]

// Best-effort name match: exact → includes
function autoMatch(label: string, categories: Category[]): string {
  const exact = categories.find(c => c.name === label)
  if (exact) return exact.id
  const partial = categories.find(c => c.name.includes(label) || label.includes(c.name))
  return partial?.id ?? ''
}

// Group rules by groupLabel for the mapping UI
const GROUPS = Array.from(new Set(FORMULA_RULES.map(r => r.groupLabel)))

export default function SeedRulesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // groupLabel → categoryId
  const [existingKeywords, setExistingKeywords] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [created, setCreated] = useState(0)
  const [skipped, setSkipped] = useState(0)

  useEffect(() => {
    async function load() {
      const [cats, rules] = await Promise.all([getCategories(), getRules()])
      const active = cats.filter(c => c.isActive)
      setCategories(active)
      setExistingKeywords(new Set(rules.map(r => r.keyword.toLowerCase())))
      const initial: Record<string, string> = {}
      for (const label of GROUPS) {
        initial[label] = autoMatch(label, active)
      }
      setMapping(initial)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSeed() {
    setSaving(true)
    let createdCount = 0
    let skippedCount = 0
    for (const rule of FORMULA_RULES) {
      const categoryId = mapping[rule.groupLabel]
      if (!categoryId) { skippedCount++; continue }
      if (existingKeywords.has(rule.keyword.toLowerCase())) { skippedCount++; continue }
      await addRule({
        keyword: rule.keyword,
        matchType: rule.matchType,
        categoryId,
        priority: 50,
        createdAt: new Date().toISOString(),
      })
      createdCount++
    }
    setCreated(createdCount)
    setSkipped(skippedCount)
    setSaving(false)
    setDone(true)
  }

  if (loading) return <main className="p-6 max-w-lg mx-auto"><p className="text-slate-400">טוען...</p></main>

  if (done) return (
    <main className="p-6 max-w-lg mx-auto text-center">
      <p className="text-green-400 text-lg font-bold mb-2">נוצרו {created} חוקים</p>
      {skipped > 0 && <p className="text-slate-400 text-sm">{skipped} דולגו (קטגוריה חסרה או כבר קיימים)</p>}
      <a href="/settings" className="mt-6 inline-block py-2 px-6 bg-accent rounded-xl text-sm font-semibold">
        עבור להגדרות לבדיקה
      </a>
    </main>
  )

  const unmapped = GROUPS.filter(g => !mapping[g])

  return (
    <main className="p-6 max-w-lg mx-auto" dir="rtl">
      <h1 className="text-xl font-bold mb-1">סידינג חוקי קיטלוג</h1>
      <p className="text-slate-400 text-sm mb-6">
        {FORMULA_RULES.length} חוקים מהנוסחה · בדוק את המיפוי ולחץ "צור חוקים"
      </p>

      <div className="space-y-4 mb-6">
        {GROUPS.map(label => {
          const rulesInGroup = FORMULA_RULES.filter(r => r.groupLabel === label)
          const alreadyExist = rulesInGroup.filter(r => existingKeywords.has(r.keyword.toLowerCase()))
          return (
            <div key={label} className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1">קטגוריה</p>
                  <select
                    value={mapping[label] ?? ''}
                    onChange={e => setMapping(prev => ({ ...prev, [label]: e.target.value }))}
                    className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent"
                  >
                    <option value="">— לא נבחר —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {rulesInGroup.map(r => (
                  <span key={r.keyword}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      existingKeywords.has(r.keyword.toLowerCase())
                        ? 'bg-slate-700 text-slate-500 line-through'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                    {r.keyword}
                    {existingKeywords.has(r.keyword.toLowerCase()) && ' (קיים)'}
                  </span>
                ))}
              </div>
              {alreadyExist.length > 0 && alreadyExist.length === rulesInGroup.length && (
                <p className="text-xs text-amber-400 mt-2">כל החוקים בקבוצה זו כבר קיימים</p>
              )}
            </div>
          )
        })}
      </div>

      {unmapped.length > 0 && (
        <p className="text-amber-400 text-xs mb-4">
          ⚠️ {unmapped.length} קבוצות ללא קטגוריה — החוקים שלהן יידלגו
        </p>
      )}

      <button
        onClick={handleSeed}
        disabled={saving}
        className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'יוצר חוקים...' : `צור חוקים (${FORMULA_RULES.length - FORMULA_RULES.filter(r => existingKeywords.has(r.keyword.toLowerCase())).length} חדשים)`}
      </button>
    </main>
  )
}
