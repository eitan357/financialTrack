'use client'
import { useState, useEffect } from 'react'
import { getAccounts, addAccount, updateAccount, cleanupDuplicateAccounts } from '@/lib/firestore/accounts'
import { getCategories, addCategory, updateCategory, cleanupDuplicateCategories } from '@/lib/firestore/categories'
import { getRules, addRule, deleteRule } from '@/lib/firestore/categorization-rules'
import type { Account, AccountType, Category, CategorizationRule, MatchType } from '@/lib/types'

type Tab = 'accounts' | 'categories' | 'rules' | 'maintenance'

const TABS: { id: Tab; label: string }[] = [
  { id: 'accounts', label: 'חשבונות' },
  { id: 'categories', label: 'קטגוריות' },
  { id: 'rules', label: 'חוקים' },
  { id: 'maintenance', label: 'תחזוקה' },
]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit: 'אשראי',
  bank: 'בנק',
  cash: 'מזומן',
}

// ---- Account form ----
function AccountForm({ initial, onSubmit, onCancel }: {
  initial?: Account
  onSubmit: (data: Omit<Account, 'id'>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<AccountType>(initial?.type ?? 'credit')
  const [color, setColor] = useState(initial?.color ?? '#6366f1')
  const [last4, setLast4] = useState(initial?.last4digits ?? '')
  const [csvId, setCsvId] = useState(initial?.csvIdentifier ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const data: Omit<Account, 'id'> = {
      name: name.trim(), type, color,
      isActive: initial?.isActive ?? true,
      ...(last4.trim() && { last4digits: last4.trim() }),
      ...(type === 'credit' && csvId.trim() && { csvIdentifier: csvId.trim() }),
    }
    await onSubmit(data)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs text-slate-400 block mb-1">שם חשבון</label>
        <input value={name} onChange={e => setName(e.target.value)} required
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-400 block mb-1">סוג</label>
          <select value={type} onChange={e => setType(e.target.value as AccountType)}
            className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none">
            <option value="credit">אשראי</option>
            <option value="bank">בנק</option>
            <option value="cash">מזומן</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">צבע</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="h-9 w-16 rounded cursor-pointer border border-slate-700" />
        </div>
      </div>
      {type !== 'cash' && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">4 ספרות אחרונות (אופציונלי)</label>
          <input value={last4} onChange={e => setLast4(e.target.value)} maxLength={4} placeholder="1234"
            className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
        </div>
      )}
      {type === 'credit' && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">מזהה CSV (לזיהוי אוטומטי)</label>
          <input value={csvId} onChange={e => setCsvId(e.target.value)} placeholder='לדוגמה: one zero'
            className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
          <p className="text-xs text-slate-500 mt-1">מילה שמופיעה בקובץ CSV לזיהוי הכרטיס</p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : (initial ? 'עדכן' : 'הוסף')}
        </button>
      </div>
    </form>
  )
}

// ---- Accounts section ----
function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    getAccounts().then(accs => { setAccounts(accs); setLoading(false) })
  }, [])

  async function handleAdd(data: Omit<Account, 'id'>) {
    const acc = await addAccount(data)
    setAccounts(prev => [...prev, acc])
    setShowAdd(false)
  }

  async function handleUpdate(id: string, data: Omit<Account, 'id'>) {
    await updateAccount(id, data)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
    setEditId(null)
  }

  async function handleToggle(acc: Account) {
    await updateAccount(acc.id, { isActive: !acc.isActive })
    setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, isActive: !a.isActive } : a))
  }

  async function moveAccount(id: string, dir: -1 | 1) {
    const active = accounts.filter(a => a.isActive)
    const idx = active.findIndex(a => a.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= active.length) return
    const updated = [...active]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    await Promise.all(updated.map((a, i) => updateAccount(a.id, { sortOrder: i })))
    setAccounts(prev => {
      const inactive = prev.filter(a => !a.isActive)
      return [...updated.map((a, i) => ({ ...a, sortOrder: i })), ...inactive]
    })
  }

  const active = accounts.filter(a => a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">{accounts.length} חשבונות</p>
        <button onClick={() => { setShowAdd(v => !v); setEditId(null) }}
          className="text-xs text-accent">{showAdd ? 'ביטול' : '+ הוסף חשבון'}</button>
      </div>

      {showAdd && <AccountForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />}

      <div className="bg-surface rounded-2xl divide-y divide-slate-800">
        {active.map((acc, idx) => (
          editId === acc.id ? (
            <div key={acc.id} className="p-2">
              <AccountForm initial={acc}
                onSubmit={data => handleUpdate(acc.id, data)}
                onCancel={() => setEditId(null)} />
            </div>
          ) : (
            <div key={acc.id} className="flex items-center px-4 py-3 gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: acc.color }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm">{acc.name}</span>
                <span className="text-xs text-slate-500 mr-2">{ACCOUNT_TYPE_LABELS[acc.type]}</span>
                {acc.last4digits && <span className="text-xs text-slate-600">****{acc.last4digits}</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0" dir="ltr">
                  <button onClick={() => moveAccount(acc.id, -1)} disabled={idx === 0}
                    className="text-slate-500 hover:text-foreground disabled:opacity-20 text-xs leading-tight">▲</button>
                  <button onClick={() => moveAccount(acc.id, 1)} disabled={idx === active.length - 1}
                    className="text-slate-500 hover:text-foreground disabled:opacity-20 text-xs leading-tight">▼</button>
                </div>
                <button onClick={() => { setEditId(acc.id); setShowAdd(false) }}
                  className="text-xs text-slate-400 hover:text-accent">ערוך</button>
                <button onClick={() => handleToggle(acc)}
                  className="text-xs text-slate-400 hover:text-amber-400">הסתר</button>
              </div>
            </div>
          )
        ))}
        {inactive.map(acc => (
          <div key={acc.id} className="flex items-center px-4 py-3 gap-3 opacity-50">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: acc.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm line-through text-slate-500">{acc.name}</span>
              <span className="text-xs text-slate-500 mr-2">{ACCOUNT_TYPE_LABELS[acc.type]}</span>
            </div>
            <button onClick={() => handleToggle(acc)} className="text-xs text-green-400">הצג</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Category form ----
function CategoryForm({ initial, onSubmit, onCancel }: {
  initial?: Category
  onSubmit: (data: Omit<Category, 'id'>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? '#6366f1')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSubmit({ name: name.trim(), color, isActive: initial?.isActive ?? true })
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 rounded-xl p-3 flex items-end gap-2">
      <div className="flex-1">
        <label className="text-xs text-slate-400 block mb-1">שם קטגוריה</label>
        <input value={name} onChange={e => setName(e.target.value)} required autoFocus
          className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">צבע</label>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="h-9 w-12 rounded cursor-pointer border border-slate-700" />
      </div>
      <button type="button" onClick={onCancel}
        className="py-2 px-3 border border-slate-600 rounded-lg text-sm h-9 flex items-center">ביטול</button>
      <button type="submit" disabled={saving}
        className="py-2 px-3 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50 h-9 flex items-center">
        {saving ? '...' : (initial ? 'שמור' : 'הוסף')}
      </button>
    </form>
  )
}

// ---- Categories section ----
function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    getCategories().then(cats => { setCategories(cats); setLoading(false) })
  }, [])

  async function handleAdd(data: Omit<Category, 'id'>) {
    const cat = await addCategory(data)
    setCategories(prev => [...prev, cat])
    setShowAdd(false)
  }

  async function handleUpdate(id: string, data: Omit<Category, 'id'>) {
    await updateCategory(id, data)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    setEditId(null)
  }

  async function handleToggle(cat: Category) {
    await updateCategory(cat.id, { isActive: !cat.isActive })
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
  }

  async function moveCategory(id: string, dir: -1 | 1) {
    const activeList = categories.filter(c => c.isActive)
    const idx = activeList.findIndex(c => c.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= activeList.length) return
    const updated = [...activeList]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    await Promise.all(updated.map((c, i) => updateCategory(c.id, { sortOrder: i })))
    setCategories(prev => {
      const inactive = prev.filter(c => !c.isActive)
      return [...updated.map((c, i) => ({ ...c, sortOrder: i })), ...inactive]
    })
  }

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>

  const active = categories.filter(c => c.isActive)
  const inactive = categories.filter(c => !c.isActive)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">{active.length} קטגוריות פעילות</p>
        <button onClick={() => { setShowAdd(v => !v); setEditId(null) }}
          className="text-xs text-accent">{showAdd ? 'ביטול' : '+ הוסף קטגוריה'}</button>
      </div>

      {showAdd && <CategoryForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />}

      <div className="bg-surface rounded-2xl divide-y divide-slate-800">
        {active.map((cat, idx) => (
          editId === cat.id ? (
            <div key={cat.id} className="p-2">
              <CategoryForm initial={cat}
                onSubmit={data => handleUpdate(cat.id, data)}
                onCancel={() => setEditId(null)} />
            </div>
          ) : (
            <div key={cat.id} className="flex items-center px-4 py-3 gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              <span className="flex-1 text-sm">{cat.name}</span>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0" dir="ltr">
                  <button onClick={() => moveCategory(cat.id, -1)} disabled={idx === 0}
                    className="text-slate-500 hover:text-foreground disabled:opacity-20 text-xs leading-tight">▲</button>
                  <button onClick={() => moveCategory(cat.id, 1)} disabled={idx === active.length - 1}
                    className="text-slate-500 hover:text-foreground disabled:opacity-20 text-xs leading-tight">▼</button>
                </div>
                <button onClick={() => { setEditId(cat.id); setShowAdd(false) }}
                  className="text-xs text-slate-400 hover:text-accent">ערוך</button>
                <button onClick={() => handleToggle(cat)}
                  className="text-xs text-slate-400 hover:text-amber-400">הסתר</button>
              </div>
            </div>
          )
        ))}
        {active.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">אין קטגוריות פעילות</p>
        )}
      </div>

      {inactive.length > 0 && (
        <div>
          <button onClick={() => setShowInactive(v => !v)} className="text-xs text-slate-500">
            {showInactive ? '▲ הסתר מוסתרות' : `▼ הצג ${inactive.length} קטגוריות מוסתרות`}
          </button>
          {showInactive && (
            <div className="bg-surface rounded-2xl divide-y divide-slate-800 mt-2">
              {inactive.map(cat => (
                <div key={cat.id} className="flex items-center px-4 py-3 gap-3 opacity-60">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <span className="flex-1 text-sm line-through text-slate-500">{cat.name}</span>
                  <button onClick={() => handleToggle(cat)} className="text-xs text-green-400">הצג</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Rules section ----
const MATCH_LABELS: Record<MatchType, string> = {
  contains: 'מכיל',
  exact: 'שווה',
  startsWith: 'מתחיל ב',
}

function RulesSection() {
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [matchType, setMatchType] = useState<MatchType>('contains')
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    Promise.all([getRules(), getCategories()]).then(([rls, cats]) => {
      setRules(rls)
      const active = cats.filter(c => c.isActive)
      setCategories(active)
      if (active.length > 0) setCategoryId(active[0].id)
      setLoading(false)
    })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim() || !categoryId) return
    const rule = await addRule({
      keyword: keyword.trim(), matchType, categoryId,
      priority: 50, createdAt: new Date().toISOString(),
    })
    setRules(prev => [rule, ...prev])
    setKeyword('')
    setShowAdd(false)
  }

  async function handleDelete(id: string) {
    await deleteRule(id)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">{rules.length} חוקים</p>
        <button onClick={() => setShowAdd(v => !v)} className="text-xs text-accent">
          {showAdd ? 'ביטול' : '+ הוסף חוק'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">מילת מפתח</label>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} required autoFocus
              className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">סוג התאמה</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value as MatchType)}
                className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none">
                <option value="contains">מכיל</option>
                <option value="startsWith">מתחיל ב</option>
                <option value="exact">שווה</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">קטגוריה</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)}
              className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
            <button type="submit"
              className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold">הוסף</button>
          </div>
        </form>
      )}

      <div className="bg-surface rounded-2xl divide-y divide-slate-800">
        {rules.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">אין חוקים עדיין</p>
        ) : rules.map(rule => (
          <div key={rule.id} className="flex items-center px-4 py-3 gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{rule.keyword}</span>
              <span className="text-xs text-slate-500 mx-2">{MATCH_LABELS[rule.matchType]}</span>
              <span className="text-xs text-slate-400">→ {catMap[rule.categoryId]?.name ?? '—'}</span>
            </div>
            <button onClick={() => handleDelete(rule.id)}
              className="text-xs text-red-400 hover:text-red-300 flex-shrink-0">מחק</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Maintenance section ----
function CleanupCard({ title, description, onRun }: {
  title: string
  description: string
  onRun: () => Promise<{ deleted: number; txsFixed: number }>
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ deleted: number; txsFixed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true); setError(null)
    try { setResult(await onRun()) }
    catch (e) { setError(String(e)) }
    finally { setRunning(false) }
  }

  return (
    <div className="bg-surface rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-slate-400">{description}</p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {result ? (
        <p className="text-sm text-green-400">
          הושלם: נמחקו {result.deleted} כפילויות, עודכנו {result.txsFixed} רשומות
        </p>
      ) : (
        <button onClick={run} disabled={running}
          className="w-full py-2 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-semibold disabled:opacity-50">
          {running ? 'מנקה...' : 'נקה כפולות'}
        </button>
      )}
    </div>
  )
}

function MaintenanceSection() {
  return (
    <div className="space-y-4">
      <CleanupCard
        title="ניקוי חשבונות כפולים"
        description="מאחד חשבונות עם אותו שם ומעדכן עסקאות לחשבון הנכון"
        onRun={cleanupDuplicateAccounts}
      />
      <CleanupCard
        title="ניקוי קטגוריות כפולות"
        description="מאחד קטגוריות עם אותו שם ומעדכן עסקאות לקטגוריה הנכונה"
        onRun={cleanupDuplicateCategories}
      />
      <div className="bg-surface rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-1">ייבוא היסטורי</h3>
        <p className="text-xs text-slate-400 mb-3">ייבוא נתונים מקבצי הדוגמה</p>
        <a href="/admin/seed"
          className="block w-full py-2 border border-slate-700 rounded-xl text-sm font-semibold text-center text-slate-300">
          עבור לעמוד ייבוא היסטורי
        </a>
      </div>
    </div>
  )
}

// ---- Main page ----
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('accounts')

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <h1 className="text-xl font-bold mb-4">הגדרות</h1>

      <div className="flex gap-1 mb-6 bg-surface rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs rounded-lg transition-colors ${
              tab === t.id ? 'bg-accent text-white' : 'text-slate-400 hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && <AccountsSection />}
      {tab === 'categories' && <CategoriesSection />}
      {tab === 'rules' && <RulesSection />}
      {tab === 'maintenance' && <MaintenanceSection />}
    </main>
  )
}
