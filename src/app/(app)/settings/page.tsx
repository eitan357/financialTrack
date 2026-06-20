'use client'
import { useState, useEffect } from 'react'
import { getAccounts, addAccount, deleteAccount, cleanupDuplicateAccounts } from '@/lib/firestore/accounts'
import { getCategories, addCategory, cleanupDuplicateCategories } from '@/lib/firestore/categories'
import { getRules, addRule, deleteRule } from '@/lib/firestore/categorization-rules'
import {
  updateAccountMeta, setAccountActive, reorderAccounts, updateCreditLinkage,
  updateCategoryMeta, setCategoryActive, reorderCategories,
} from '@/lib/settings-mutations'
import type { Account, AccountProvider, AccountType, Category, CategorizationRule, MatchType } from '@/lib/types'

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

const PROVIDER_LABELS: Record<AccountProvider, string> = {
  leumi: 'לאומי',
  'one-zero': 'One Zero',
  max: 'Max',
  isracard: 'ישראכרט',
}

const BANK_PROVIDERS: { value: AccountProvider; label: string }[] = [
  { value: 'leumi', label: 'לאומי' },
  { value: 'one-zero', label: 'One Zero' },
]

const CREDIT_PROVIDERS: { value: AccountProvider; label: string }[] = [
  { value: 'max', label: 'Max' },
  { value: 'isracard', label: 'ישראכרט' },
]

const PROVIDER_DOMAINS: Partial<Record<AccountProvider, string>> = {
  leumi: 'leumi.co.il',
  'one-zero': 'one-zero.io',
  max: 'max.co.il',
  isracard: 'isracard.co.il',
}

function ProviderLogo({ provider, color, className = 'w-8 h-8' }: { provider?: AccountProvider; color: string; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const domain = provider && !imgFailed ? PROVIDER_DOMAINS[provider] : null
  if (!domain) return <div className={`${className} rounded-full flex-shrink-0`} style={{ background: color }} />
  return (
    <div className={`${className} rounded-full flex-shrink-0 bg-white flex items-center justify-center overflow-hidden`}>
      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={provider}
        className="w-3/4 h-3/4 object-contain" onError={() => setImgFailed(true)} />
    </div>
  )
}

// ---- Account form ----
function AccountForm({ type, initial, bankAccounts, onSubmit, onCancel, onDelete }: {
  type: AccountType
  initial?: Account
  bankAccounts: Account[]
  onSubmit: (data: Omit<Account, 'id'>) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(!!initial)
  const [color, setColor] = useState(initial?.color ?? '#6366f1')
  const [last4, setLast4] = useState(initial?.last4digits ?? '')
  const [csvId, setCsvId] = useState(initial?.csvIdentifier ?? '')
  const [provider, setProvider] = useState<AccountProvider | ''>(initial?.provider ?? '')
  const [linkedBankId, setLinkedBankId] = useState(initial?.linkedBankAccountId ?? '')
  const [paymentDay, setPaymentDay] = useState(initial?.creditPaymentDay ? String(initial.creditPaymentDay) : '')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [linkedBankError, setLinkedBankError] = useState<string | null>(null)

  useEffect(() => {
    if (nameManuallyEdited) return
    setName(provider ? PROVIDER_LABELS[provider as AccountProvider] : '')
  }, [provider, nameManuallyEdited])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    let hasError = false
    if (!name.trim()) { setNameError('שדה חובה'); hasError = true }
    if (type === 'credit' && !linkedBankId) { setLinkedBankError('יש לבחור חשבון בנק מקושר'); hasError = true }
    if (hasError) return
    setNameError(null)
    setLinkedBankError(null)
    setSaving(true)
    const data: Omit<Account, 'id'> = {
      name: name.trim(), type, color,
      isActive: initial?.isActive ?? true,
      ...(last4.trim() && { last4digits: last4.trim() }),
      ...(type === 'credit' && csvId.trim() && { csvIdentifier: csvId.trim() }),
      ...(type !== 'cash' && provider && { provider: provider as AccountProvider }),
      ...(type === 'credit' && linkedBankId && { linkedBankAccountId: linkedBankId }),
      ...(type === 'credit' && paymentDay && { creditPaymentDay: Math.min(parseInt(paymentDay), 28) }),
    }
    await onSubmit(data)
    setSaving(false)
  }

  const providerOptions = type === 'bank' ? BANK_PROVIDERS : type === 'credit' ? CREDIT_PROVIDERS : []

  return (
    <form onSubmit={submit} className="bg-slate-800 rounded-xl p-4 space-y-3">
      {initial && (
        <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
          <ProviderLogo provider={provider || undefined} color={color} className="w-10 h-10" />
          <div>
            <p className="text-sm font-medium" dir="auto">{name || '—'}</p>
            <p className="text-xs text-slate-500">{ACCOUNT_TYPE_LABELS[type]}</p>
          </div>
        </div>
      )}
      {type !== 'cash' && (
        <div>
          <label className="text-xs text-slate-400 block mb-2">
            {type === 'bank' ? 'בנק' : 'כרטיס אשראי'}
          </label>
          <div className="flex flex-wrap gap-2">
            {providerOptions.map(p => (
              <button key={p.value} type="button"
                onClick={() => setProvider(prev => prev === p.value ? '' : p.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
                  provider === p.value
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                }`}>
                <ProviderLogo provider={p.value} color="#94a3b8" className="w-5 h-5" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-slate-400 block mb-1">שם חשבון</label>
        <input value={name}
          onChange={e => {
            setName(e.target.value)
            setNameManuallyEdited(true)
            if (nameError && e.target.value.trim()) setNameError(null)
          }}
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${nameError ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
        {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">צבע</label>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="h-9 w-16 rounded cursor-pointer border border-slate-700" />
      </div>
      {type === 'bank' && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">מספר חשבון בנק (אופציונלי)</label>
          <input value={last4} onChange={e => setLast4(e.target.value)} placeholder="12-345-678901"
            className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
        </div>
      )}
      {type === 'credit' && (
        <>
          <div>
            <label className="text-xs text-slate-400 block mb-1">4 ספרות אחרונות (אופציונלי)</label>
            <input value={last4} onChange={e => setLast4(e.target.value)} maxLength={4} placeholder="1234"
              className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">חשבון בנק מקושר <span className="text-red-400">*</span></label>
            <div className="space-y-1">
              {bankAccounts.map(b => (
                <button key={b.id} type="button"
                  onClick={() => { setLinkedBankId(b.id); if (linkedBankError) setLinkedBankError(null) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors text-right ${
                    linkedBankId === b.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}>
                  <ProviderLogo provider={b.provider} color={b.color} className="w-6 h-6" />
                  <span dir="auto">{b.name}</span>
                </button>
              ))}
            </div>
            {linkedBankError && <p className="text-xs text-red-400 mt-1">{linkedBankError}</p>}
            {bankAccounts.length === 0 && <p className="text-xs text-slate-500 mt-1">יש ליצור חשבון בנק תחילה</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">יום תשלום בחודש (1–28)</label>
            <input type="number" min={1} max={28} value={paymentDay}
              onChange={e => setPaymentDay(e.target.value)} placeholder="10"
              className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">מזהה CSV (לזיהוי אוטומטי)</label>
            <input value={csvId} onChange={e => setCsvId(e.target.value)} placeholder='לדוגמה: one zero'
              className="w-full bg-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-accent" />
            <p className="text-xs text-slate-500 mt-1">מילה שמופיעה בקובץ CSV לזיהוי הכרטיס</p>
          </div>
        </>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 border border-slate-600 rounded-lg text-sm">ביטול</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 bg-accent rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'שומר...' : (initial ? 'עדכן' : 'הוסף')}
        </button>
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete}
          className="w-full py-2 text-xs text-red-500 hover:text-red-400 border border-red-900/40 rounded-lg mt-1">
          מחק חשבון
        </button>
      )}
    </form>
  )
}

// ---- Accounts section ----
function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAddType, setShowAddType] = useState<'bank' | 'credit' | null>(null)

  useEffect(() => {
    async function load() {
      const accs = await getAccounts()
      if (!accs.some(a => a.type === 'cash')) {
        const cash = await addAccount({ name: 'מזומן', type: 'cash', color: '#22c55e', isActive: true })
        setAccounts([...accs, cash])
      } else {
        setAccounts(accs)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleAdd(data: Omit<Account, 'id'>) {
    const acc = await addAccount(data)
    setAccounts(prev => [...prev, acc])
    setShowAddType(null)
  }

  async function handleUpdate(id: string, data: Omit<Account, 'id'>) {
    const existing = accounts.find(a => a.id === id)
    await updateAccountMeta(id, {
      name: data.name,
      color: data.color,
      last4digits: data.last4digits,
      csvIdentifier: data.csvIdentifier,
      provider: data.provider,
    })
    if (data.type === 'credit' && data.linkedBankAccountId) {
      const bankChanged = data.linkedBankAccountId !== existing?.linkedBankAccountId
      const dayChanged = data.creditPaymentDay !== existing?.creditPaymentDay
      if (bankChanged || dayChanged || !existing?.linkedBankHistory?.length) {
        await updateCreditLinkage(id, data.linkedBankAccountId, data.creditPaymentDay)
      }
    }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
    setEditId(null)
  }

  async function handleToggle(acc: Account) {
    await setAccountActive(acc.id, !acc.isActive)
    setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, isActive: !a.isActive } : a))
  }

  async function handleDelete(acc: Account) {
    if (!window.confirm(`למחוק את "${acc.name}"? פעולה זו אינה הפיכה.`)) return
    await deleteAccount(acc.id)
    setAccounts(prev => prev.filter(a => a.id !== acc.id))
  }

  async function moveAccount(id: string, dir: -1 | 1) {
    const acc = accounts.find(a => a.id === id)!
    const sameType = accounts
      .filter(a => a.isActive && a.type === acc.type)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const idx = sameType.findIndex(a => a.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sameType.length) return
    const updated = [...sameType]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    await reorderAccounts(updated.map((a, i) => ({ id: a.id, sortOrder: i })))
    setAccounts(prev => prev.map(a => {
      const pos = updated.findIndex(u => u.id === a.id)
      return pos >= 0 ? { ...a, sortOrder: pos } : a
    }))
  }

  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const activeBanks = bankAccounts.filter(a => a.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const activeCredit = accounts.filter(a => a.type === 'credit' && a.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const activeCash = accounts.filter(a => a.type === 'cash' && a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>

  function renderRow(acc: Account, idx: number, total: number, showMove: boolean) {
    if (editId === acc.id) return (
      <div key={acc.id} className="bg-surface rounded-xl p-2">
        <AccountForm type={acc.type} initial={acc} bankAccounts={bankAccounts}
          onSubmit={data => handleUpdate(acc.id, data)}
          onCancel={() => setEditId(null)}
          onDelete={acc.type !== 'cash' ? () => handleDelete(acc) : undefined} />
      </div>
    )
    return (
      <div key={acc.id} className="bg-surface rounded-xl flex items-center px-4 py-3 gap-3">
        <ProviderLogo provider={acc.provider} color={acc.color} />
        <div className="flex-1 min-w-0">
          <span className="text-sm" dir="auto">{acc.name}</span>
          {acc.last4digits && (
            acc.type === 'bank'
              ? <span className="text-xs text-slate-500 mr-2">{acc.last4digits}</span>
              : <span className="text-xs text-slate-500 mr-2">****{acc.last4digits}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showMove && (
            <div className="flex flex-col gap-0" dir="ltr">
              <button onClick={() => moveAccount(acc.id, -1)} disabled={idx === 0}
                className="text-slate-500 hover:text-foreground disabled:opacity-20 text-xs leading-tight">▲</button>
              <button onClick={() => moveAccount(acc.id, 1)} disabled={idx === total - 1}
                className="text-slate-500 hover:text-foreground disabled:opacity-20 text-xs leading-tight">▼</button>
            </div>
          )}
          <button onClick={() => { setEditId(acc.id); setShowAddType(null) }}
            className="text-xs text-slate-400 hover:text-accent">ערוך</button>
          <button onClick={() => handleToggle(acc)}
            className="text-xs text-slate-400 hover:text-amber-400">הסתר</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => { setShowAddType(v => v === 'bank' ? null : 'bank'); setEditId(null) }}
          className={`flex-1 py-2 text-xs rounded-xl border transition-colors ${showAddType === 'bank' ? 'border-accent text-accent' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
          {showAddType === 'bank' ? 'ביטול' : '+ הוסף חשבון בנק'}
        </button>
        <button
          onClick={() => { setShowAddType(v => v === 'credit' ? null : 'credit'); setEditId(null) }}
          className={`flex-1 py-2 text-xs rounded-xl border transition-colors ${showAddType === 'credit' ? 'border-accent text-accent' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
          {showAddType === 'credit' ? 'ביטול' : '+ הוסף כרטיס אשראי'}
        </button>
      </div>

      {showAddType && (
        <AccountForm type={showAddType} bankAccounts={bankAccounts}
          onSubmit={handleAdd} onCancel={() => setShowAddType(null)} />
      )}

      {activeBanks.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">חשבונות בנק</p>
          <div className="space-y-2">
            {activeBanks.map((acc, idx) => renderRow(acc, idx, activeBanks.length, true))}
          </div>
        </div>
      )}

      {activeCredit.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">כרטיסי אשראי</p>
          <div className="space-y-2">
            {activeCredit.map((acc, idx) => renderRow(acc, idx, activeCredit.length, true))}
          </div>
        </div>
      )}

      {activeCash.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">מזומן</p>
          <div className="space-y-2">
            {activeCash.map(acc => renderRow(acc, 0, 1, false))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">מוסתרים</p>
          <div className="space-y-2">
            {inactive.map(acc => (
              <div key={acc.id} className="bg-surface rounded-xl flex items-center px-4 py-3 gap-3 opacity-50">
                <ProviderLogo provider={acc.provider} color={acc.color} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm line-through text-slate-500" dir="auto">{acc.name}</span>
                  <span className="text-xs text-slate-500 mr-2">{ACCOUNT_TYPE_LABELS[acc.type]}</span>
                </div>
                <button onClick={() => handleToggle(acc)} className="text-xs text-green-400">הצג</button>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [nameError, setNameError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameError('שדה חובה'); return }
    setNameError(null)
    setSaving(true)
    await onSubmit({ name: name.trim(), color, isActive: initial?.isActive ?? true })
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 rounded-xl p-3 flex items-end gap-2">
      <div className="flex-1">
        <label className="text-xs text-slate-400 block mb-1">שם קטגוריה</label>
        <input value={name}
          onChange={e => { setName(e.target.value); if (nameError && e.target.value.trim()) setNameError(null) }}
          autoFocus
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${nameError ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
        {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
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
    await updateCategoryMeta(id, { name: data.name, color: data.color })
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    setEditId(null)
  }

  async function handleToggle(cat: Category) {
    await setCategoryActive(cat.id, !cat.isActive)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
  }

  async function moveCategory(id: string, dir: -1 | 1) {
    const activeList = categories.filter(c => c.isActive)
    const idx = activeList.findIndex(c => c.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= activeList.length) return
    const updated = [...activeList]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    await reorderCategories(updated.map((c, i) => ({ id: c.id, sortOrder: i })))
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
  const [keywordError, setKeywordError] = useState<string | null>(null)

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
    if (!keyword.trim()) { setKeywordError('שדה חובה'); return }
    if (!categoryId) return
    setKeywordError(null)
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
            <input value={keyword}
              onChange={e => { setKeyword(e.target.value); if (keywordError && e.target.value.trim()) setKeywordError(null) }}
              autoFocus
              className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${keywordError ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
            {keywordError && <p className="text-xs text-red-400 mt-1">{keywordError}</p>}
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
