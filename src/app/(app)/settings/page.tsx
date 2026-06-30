'use client'
import { useState, useEffect } from 'react'
import { Wallet, GripVertical } from 'lucide-react'
import { getAccounts, addAccount, deleteAccount, cleanupDuplicateAccounts } from '@/lib/firestore/accounts'
import { getCategories, addCategory, cleanupDuplicateCategories } from '@/lib/firestore/categories'
import { getRules, addRule, deleteRule } from '@/lib/firestore/categorization-rules'
import {
  updateAccountMeta, setAccountActive, reorderAccounts, updateCreditLinkage,
  updateCategoryMeta, setCategoryActive, reorderCategories,
  updateInvestmentTypeMeta, setInvestmentTypeActive, reorderInvestmentTypes,
} from '@/lib/settings-mutations'
import type { Account, AccountProvider, AccountType, Category, CategorizationRule, MatchType } from '@/lib/types'
import { SelectField } from '@/components/ui/SelectField'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { getInvestmentTypes, addInvestmentType, deleteInvestmentType } from '@/lib/firestore/investments'
import { AddInvestmentTypeForm } from '@/components/investments/AddInvestmentTypeForm'
import type { InvestmentType } from '@/lib/types'
import { getCurrency } from '@/lib/currencies'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )
}

function SortableRow({ id, children }: {
  id: string
  children: (handleProps: React.HTMLAttributes<HTMLSpanElement>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-50 relative z-10' : ''}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

type Tab = 'accounts' | 'categories' | 'investments' | 'maintenance'

const TABS: { id: Tab; label: string }[] = [
  { id: 'accounts', label: 'חשבונות' },
  { id: 'categories', label: 'קטגוריות' },
  { id: 'investments', label: 'השקעות' },
  { id: 'maintenance', label: 'תחזוקה' },
]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit: 'אשראי',
  bank: 'בנק',
  cash: 'מזומן',
  investment: 'תיק השקעות',
}

const PROVIDER_LABELS: Record<AccountProvider, string> = {
  leumi: 'לאומי',
  'one-zero': 'One Zero',
  max: 'Max',
  isracard: 'ישראכרט',
  psagot: 'פסגות',
}

const BANK_PROVIDERS: { value: AccountProvider; label: string }[] = [
  { value: 'leumi', label: 'לאומי' },
  { value: 'one-zero', label: 'One Zero' },
]

const CREDIT_PROVIDERS: { value: AccountProvider; label: string }[] = [
  { value: 'max', label: 'Max' },
  { value: 'isracard', label: 'ישראכרט' },
]

const INVESTMENT_PROVIDERS: { value: AccountProvider; label: string }[] = [
  { value: 'psagot', label: 'פסגות' },
  { value: 'one-zero', label: 'One Zero' },
]

const PROVIDER_LOGO: Partial<Record<AccountProvider, string>> = {
  leumi: '/logos/leumi.png',
  'one-zero': '/logos/one-zero.jpeg',
  max: '/logos/max.jpg',
  isracard: '/logos/isracard.webp',
  psagot: '/logos/psagot.jfif',
}

const COLOR_PALETTE = [
  '#818cf8', // indigo-400
  '#a78bfa', // violet-400
  '#c084fc', // purple-400
  '#f472b6', // pink-400
  '#f87171', // red-400
  '#fb923c', // orange-400
  '#fbbf24', // amber-400
  '#4ade80', // green-400
  '#34d399', // emerald-400
  '#22d3ee', // cyan-400
  '#60a5fa', // blue-400
  '#94a3b8', // slate-400
]

function ProviderLogo({ provider, color, type, className = 'w-8 h-8' }: { provider?: AccountProvider; color: string; type?: string; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const src = provider && !imgFailed ? PROVIDER_LOGO[provider] : null
  if (type === 'cash') {
    return (
      <div className={`${className} rounded-full flex-shrink-0 flex items-center justify-center`} style={{ background: color }}>
        <Wallet size={parseInt(className.match(/w-(\d+)/)?.[1] ?? '8') * 3} className="text-white" strokeWidth={1.5} />
      </div>
    )
  }
  if (!src) return <div className={`${className} rounded-full flex-shrink-0`} style={{ background: color }} />
  return (
    <div className={`${className} rounded-full flex-shrink-0 bg-white flex items-center justify-center overflow-hidden`}>
      <img src={src} alt={provider}
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
  const [color, setColor] = useState(initial?.color ?? '#818cf8')
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
          <ProviderLogo provider={provider || undefined} color={color} type={type} className="w-10 h-10" />
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
          onBlur={() => {
            if (!name.trim()) {
              const defaultName = type === 'cash' ? 'מזומן' : (provider ? PROVIDER_LABELS[provider as AccountProvider] : '')
              setName(defaultName)
              setNameManuallyEdited(false)
            }
          }}
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${nameError ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
        {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">צבע</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full flex-shrink-0 transition-transform ${
                color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
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

// ---- Portfolio form ----
function PortfolioForm({ initial, onSubmit, onCancel, onDelete }: {
  initial?: Account
  onSubmit: (data: Omit<Account, 'id'>) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(!!initial)
  const [color, setColor] = useState(initial?.color ?? '#818cf8')
  const [provider, setProvider] = useState<AccountProvider | ''>(initial?.provider ?? '')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (nameManuallyEdited) return
    setName(provider ? PROVIDER_LABELS[provider as AccountProvider] : '')
  }, [provider, nameManuallyEdited])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameError('שדה חובה'); return }
    setNameError(null)
    setSaving(true)
    await onSubmit({
      name: name.trim(),
      type: 'investment',
      color,
      isActive: initial?.isActive ?? true,
      ...(provider && { provider: provider as AccountProvider }),
    })
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 rounded-xl p-4 space-y-3">
      {initial && (
        <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
          <ProviderLogo provider={provider || undefined} color={color} className="w-10 h-10" />
          <div>
            <p className="text-sm font-medium" dir="auto">{name || '—'}</p>
            <p className="text-xs text-slate-500">תיק השקעות</p>
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-slate-400 block mb-2">חברת השקעות (אופציונלי)</label>
        <div className="flex flex-wrap gap-2">
          {INVESTMENT_PROVIDERS.map(p => (
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
      <div>
        <label className="text-xs text-slate-400 block mb-1">שם תיק</label>
        <input value={name}
          onChange={e => {
            setName(e.target.value)
            setNameManuallyEdited(true)
            if (nameError && e.target.value.trim()) setNameError(null)
          }}
          onBlur={() => {
            if (!name.trim()) {
              setName(provider ? PROVIDER_LABELS[provider as AccountProvider] : '')
              setNameManuallyEdited(false)
            }
          }}
          className={`w-full bg-background rounded-lg px-3 py-2 text-sm outline-none ${nameError ? 'ring-1 ring-red-500' : 'focus:ring-1 ring-accent'}`} />
        {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">צבע</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full flex-shrink-0 transition-transform ${
                color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
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
          מחק תיק
        </button>
      )}
    </form>
  )
}

// ---- Accounts section ----
function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAddType, setShowAddType] = useState<'bank' | 'credit' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const accs = await getAccounts()
        const nonInvestment = accs.filter(a => a.type !== 'investment')
        if (!nonInvestment.some(a => a.type === 'cash')) {
          const cash = await addAccount({ name: 'מזומן', type: 'cash', color: '#22c55e', isActive: true })
          setAccounts([...nonInvestment, cash])
        } else {
          setAccounts(nonInvestment)
        }
      } catch (e) {
        setLoadError('שגיאה בטעינת חשבונות')
        console.error(e)
      } finally {
        setLoading(false)
      }
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
    setExpandedId(null)
  }

  async function handleToggle(acc: Account) {
    await setAccountActive(acc.id, !acc.isActive)
    setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, isActive: !a.isActive } : a))
    setExpandedId(null)
  }

  function handleDelete(acc: Account) {
    setDeleteConfirm(acc)
    setExpandedId(null)
    setEditId(null)
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deleteAccount(deleteConfirm.id)
      setAccounts(prev => prev.filter(a => a.id !== deleteConfirm.id))
    } finally {
      setDeleteConfirm(null)
      setDeleting(false)
    }
  }

  const sensors = useDndSensors()

  function makeAccountDragEndHandler(type: 'bank' | 'credit') {
    return async function handleDragEnd(event: DragEndEvent) {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const sorted = accounts
        .filter(a => a.type === type && a.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      const oldIndex = sorted.findIndex(a => a.id === String(active.id))
      const newIndex = sorted.findIndex(a => a.id === String(over.id))
      const reordered = arrayMove(sorted, oldIndex, newIndex)
      setAccounts(prev => prev.map(a => {
        const pos = reordered.findIndex(r => r.id === a.id)
        return pos >= 0 ? { ...a, sortOrder: pos } : a
      }))
      await reorderAccounts(reordered.map((a, i) => ({ id: a.id, sortOrder: i })))
    }
  }

  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const activeBanks = bankAccounts.filter(a => a.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const activeCredit = accounts.filter(a => a.type === 'credit' && a.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const activeCash = accounts.filter(a => a.type === 'cash' && a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
  if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>

  function renderRow(acc: Account, handleProps?: React.HTMLAttributes<HTMLSpanElement>) {
    const isExpanded = expandedId === acc.id
    const isEditing = editId === acc.id

    if (isEditing) return (
      <div key={acc.id} className="bg-surface rounded-xl p-2">
        <AccountForm type={acc.type} initial={acc} bankAccounts={bankAccounts}
          onSubmit={data => handleUpdate(acc.id, data)}
          onCancel={() => { setEditId(null); setExpandedId(acc.id) }}
          onDelete={acc.type !== 'cash' ? async () => handleDelete(acc) : undefined} />
      </div>
    )

    return (
      <div key={acc.id} className="bg-surface rounded-xl overflow-hidden">
        <div className="flex items-center">
          {handleProps && (
            <span
              {...handleProps}
              className="pl-4 pr-1 py-3 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 flex-shrink-0 touch-none select-none"
            >
              <GripVertical size={16} />
            </span>
          )}
          <button type="button" className="flex-1 flex items-center px-4 py-3 gap-3 text-right"
            onClick={() => { setExpandedId(v => v === acc.id ? null : acc.id); setEditId(null); setShowAddType(null) }}>
            <ProviderLogo provider={acc.provider} color={acc.color} type={acc.type} />
            <div className="flex-1 min-w-0">
              <span className="text-sm" dir="auto">{acc.name}</span>
              {acc.last4digits && (
                acc.type === 'bank'
                  ? <span className="text-xs text-slate-500 mr-2">{acc.last4digits}</span>
                  : <span className="text-xs text-slate-500 mr-2">****{acc.last4digits}</span>
              )}
            </div>
            <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
          </button>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-700/50 px-4 pt-3 pb-3 space-y-3">
            <div className="space-y-1.5">
              {acc.provider && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">{acc.type === 'bank' ? 'בנק' : 'כרטיס'}</span>
                  <span className="text-slate-300">{PROVIDER_LABELS[acc.provider]}</span>
                </div>
              )}
              {acc.last4digits && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">{acc.type === 'bank' ? 'מספר חשבון' : '4 ספרות אחרונות'}</span>
                  <span className="text-slate-300 font-mono">{acc.type === 'bank' ? acc.last4digits : `****${acc.last4digits}`}</span>
                </div>
              )}
              {acc.type === 'credit' && acc.linkedBankAccountId && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">בנק מקושר</span>
                  <span className="text-slate-300">{bankAccounts.find(b => b.id === acc.linkedBankAccountId)?.name ?? '—'}</span>
                </div>
              )}
              {acc.creditPaymentDay && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">יום תשלום</span>
                  <span className="text-slate-300">{acc.creditPaymentDay}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setEditId(acc.id); setShowAddType(null) }}
                className="flex-1 py-1.5 border border-slate-600 rounded-lg text-xs text-slate-300 hover:text-accent hover:border-accent/50 transition-colors">
                ערוך
              </button>
              <button onClick={() => handleToggle(acc)}
                className="flex-1 py-1.5 border border-slate-600 rounded-lg text-xs text-slate-300 hover:text-amber-400 hover:border-amber-400/50 transition-colors">
                הסתר
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => { setShowAddType(v => v === 'bank' ? null : 'bank'); setEditId(null); setExpandedId(null) }}
          className={`flex-1 py-2 text-xs rounded-xl border transition-colors ${showAddType === 'bank' ? 'border-accent text-accent' : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
          {showAddType === 'bank' ? 'ביטול' : '+ הוסף חשבון בנק'}
        </button>
        <button
          onClick={() => { setShowAddType(v => v === 'credit' ? null : 'credit'); setEditId(null); setExpandedId(null) }}
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeAccountDragEndHandler('bank')}>
              <SortableContext items={activeBanks.map(a => a.id)} strategy={verticalListSortingStrategy}>
                {activeBanks.map(acc => (
                  <SortableRow key={acc.id} id={acc.id}>
                    {(handleProps) => renderRow(acc, handleProps)}
                  </SortableRow>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {activeCredit.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">כרטיסי אשראי</p>
          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeAccountDragEndHandler('credit')}>
              <SortableContext items={activeCredit.map(a => a.id)} strategy={verticalListSortingStrategy}>
                {activeCredit.map(acc => (
                  <SortableRow key={acc.id} id={acc.id}>
                    {(handleProps) => renderRow(acc, handleProps)}
                  </SortableRow>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {activeCash.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">מזומן</p>
          <div className="space-y-2">
            {activeCash.map(acc => renderRow(acc))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">מוסתרים</p>
          <div className="space-y-2">
            {inactive.map(acc => {
              const isExpanded = expandedId === acc.id
              return (
                <div key={acc.id} className="bg-surface rounded-xl overflow-hidden opacity-60">
                  <button type="button" className="w-full flex items-center px-4 py-3 gap-3 text-right"
                    onClick={() => setExpandedId(v => v === acc.id ? null : acc.id)}>
                    <ProviderLogo provider={acc.provider} color={acc.color} type={acc.type} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm line-through text-slate-500" dir="auto">{acc.name}</span>
                      <span className="text-xs text-slate-500 mr-2">{ACCOUNT_TYPE_LABELS[acc.type]}</span>
                    </div>
                    <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 px-4 py-3">
                      <button onClick={() => handleToggle(acc)}
                        className="w-full py-1.5 border border-slate-600 rounded-lg text-xs text-green-400 hover:border-green-400/50 transition-colors">
                        הצג חשבון
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          title="מחיקת חשבון"
          itemName={deleteConfirm.name}
          warningBody={<>מחיקת החשבון היא פעולה <strong>בלתי הפיכה</strong>. החשבון יימחק לצמיתות.</>}
          hideWarning="הסתרת חשבון מסתירה אותו מהממשק אך שומרת את כל ההיסטוריה. ניתן לשחזר את החשבון בכל עת מרשימת החשבונות הנסתרים."
          hideLabel="הסתר חשבון (מומלץ)"
          onHide={async () => { await handleToggle(deleteConfirm); setDeleteConfirm(null) }}
          onDelete={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          deleting={deleting}
        />
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
  const [showRules, setShowRules] = useState(false)
  const [showCategories, setShowCategories] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    getCategories()
      .then(cats => { setCategories(cats); setLoading(false) })
      .catch(e => { setLoadError('שגיאה בטעינת קטגוריות'); console.error(e); setLoading(false) })
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

  const sensors = useDndSensors()

  async function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeList = categories.filter(c => c.isActive)
    const oldIndex = activeList.findIndex(c => c.id === String(active.id))
    const newIndex = activeList.findIndex(c => c.id === String(over.id))
    const reordered = arrayMove(activeList, oldIndex, newIndex)
    setCategories(prev => {
      const inactive = prev.filter(c => !c.isActive)
      return [...reordered.map((c, i) => ({ ...c, sortOrder: i })), ...inactive]
    })
    await reorderCategories(reordered.map((c, i) => ({ id: c.id, sortOrder: i })))
  }

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
  if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>

  const active = categories.filter(c => c.isActive)
  const inactive = categories.filter(c => !c.isActive)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowCategories(v => !v)}
          className="text-xs text-slate-500 flex items-center gap-1"
        >
          <span>{showCategories ? '▲' : '▼'}</span>
          <span>{active.length} קטגוריות פעילות</span>
        </button>
        <button onClick={() => { setShowAdd(v => !v); setEditId(null) }}
          className="text-xs text-accent">{showAdd ? 'ביטול' : '+ הוסף קטגוריה'}</button>
      </div>

      {showAdd && <CategoryForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />}

      {showCategories && (
        <div className="bg-surface rounded-2xl divide-y divide-slate-800">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
            <SortableContext items={active.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {active.map(cat => (
                editId === cat.id ? (
                  <div key={cat.id} className="p-2">
                    <CategoryForm initial={cat}
                      onSubmit={data => handleUpdate(cat.id, data)}
                      onCancel={() => setEditId(null)} />
                  </div>
                ) : (
                  <SortableRow key={cat.id} id={cat.id}>
                    {(handleProps) => (
                      <div className="flex items-center px-4 py-3 gap-3">
                        <span
                          {...handleProps}
                          className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 flex-shrink-0 touch-none select-none"
                        >
                          <GripVertical size={16} />
                        </span>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="flex-1 text-sm">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditId(cat.id); setShowAdd(false) }}
                            className="text-xs text-slate-400 hover:text-accent">ערוך</button>
                          <button onClick={() => handleToggle(cat)}
                            className="text-xs text-slate-400 hover:text-amber-400">הסתר</button>
                        </div>
                      </div>
                    )}
                  </SortableRow>
                )
              ))}
            </SortableContext>
          </DndContext>
          {active.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">אין קטגוריות פעילות</p>
          )}
        </div>
      )}

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

      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <button
          onClick={() => setShowRules(v => !v)}
          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-foreground py-1"
        >
          <span>חוקי קיטלוג אוטומטי</span>
          <span>{showRules ? '▲' : '▼'}</span>
        </button>
        {showRules && (
          <div className="mt-3">
            <RulesSection />
          </div>
        )}
      </div>
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
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getRules(), getCategories()])
      .then(([rls, cats]) => {
        setRules(rls)
        const active = cats.filter(c => c.isActive)
        setCategories(active)
        if (active.length > 0) setCategoryId(active[0].id)
        setLoading(false)
      })
      .catch(e => { setLoadError('שגיאה בטעינת חוקים'); console.error(e); setLoading(false) })
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
  if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>

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
              <SelectField
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map(c => ({ value: c.id, label: c.name, color: c.color }))}
                placeholder="בחר קטגוריה..."
              />
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
      <div className="bg-surface rounded-2xl p-4 space-y-2">
        <h3 className="font-semibold text-sm mb-1">כלי אדמין</h3>
        <a href="/admin/seed"
          className="block w-full py-2 border border-slate-700 rounded-xl text-sm font-semibold text-center text-slate-300">
          ייבוא היסטורי
        </a>
        <a href="/admin/seed-rules"
          className="block w-full py-2 border border-slate-700 rounded-xl text-sm font-semibold text-center text-slate-300">
          צור חוקי קיטלוג
        </a>
      </div>
    </div>
  )
}

// ---- Investments section (portfolio management) ----
function InvestmentsSection() {
  const [portfolios, setPortfolios] = useState<Account[]>([])
  const [types, setTypes] = useState<InvestmentType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showAddPortfolio, setShowAddPortfolio] = useState(false)
  const [expandedPortfolioId, setExpandedPortfolioId] = useState<string | null>(null)
  const [editPortfolioId, setEditPortfolioId] = useState<string | null>(null)

  const [showAddTypeForPortfolio, setShowAddTypeForPortfolio] = useState<string | null>(null)
  const [editTypeId, setEditTypeId] = useState<string | null>(null)
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<
    | { kind: 'portfolio'; item: Account }
    | { kind: 'type'; item: InvestmentType }
    | null
  >(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [accs, allTypes] = await Promise.all([getAccounts(), getInvestmentTypes()])
        setPortfolios(accs.filter(a => a.type === 'investment'))
        setTypes(allTypes)
      } catch (e) {
        setLoadError('שגיאה בטעינת נתוני השקעות')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAddPortfolio(data: Omit<Account, 'id'>) {
    const acc = await addAccount(data)
    setPortfolios(prev => [...prev, acc])
    setShowAddPortfolio(false)
  }

  async function handleUpdatePortfolio(id: string, data: Omit<Account, 'id'>) {
    await updateAccountMeta(id, { name: data.name, color: data.color, provider: data.provider })
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    setEditPortfolioId(null)
    setExpandedPortfolioId(null)
  }

  async function handleHidePortfolio(portfolio: Account) {
    await setAccountActive(portfolio.id, !(portfolio.isActive ?? true))
    setPortfolios(prev => prev.map(p => p.id === portfolio.id ? { ...p, isActive: !(p.isActive ?? true) } : p))
    setExpandedPortfolioId(null)
    setDeleteConfirm(null)
  }

  async function handleAddType(portfolioId: string, typeData: { name: string; currency: string; notes?: string }) {
    const newType = await addInvestmentType({ ...typeData, portfolioAccountId: portfolioId })
    setTypes(prev => [...prev, newType])
    setShowAddTypeForPortfolio(null)
  }

  async function handleUpdateType(id: string, data: { name: string; currency: string; notes?: string }) {
    await updateInvestmentTypeMeta(id, data)
    setTypes(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    setEditTypeId(null)
  }

  async function handleHideType(type: InvestmentType) {
    const newActive = !(type.isActive ?? true)
    await setInvestmentTypeActive(type.id, newActive)
    setTypes(prev => prev.map(t => t.id === type.id ? { ...t, isActive: newActive } : t))
    setDeleteConfirm(null)
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      if (deleteConfirm.kind === 'portfolio') {
        await deleteAccount(deleteConfirm.item.id)
        setPortfolios(prev => prev.filter(p => p.id !== deleteConfirm.item.id))
      } else {
        await deleteInvestmentType(deleteConfirm.item.id)
        setTypes(prev => prev.filter(t => t.id !== deleteConfirm.item.id))
      }
    } finally {
      setDeleteConfirm(null)
      setDeleting(false)
    }
  }

  const sensors = useDndSensors()

  async function handlePortfolioDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const sorted = portfolios
      .filter(p => p.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const oldIndex = sorted.findIndex(p => p.id === String(active.id))
    const newIndex = sorted.findIndex(p => p.id === String(over.id))
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    setPortfolios(prev => prev.map(p => {
      const pos = reordered.findIndex(r => r.id === p.id)
      return pos >= 0 ? { ...p, sortOrder: pos } : p
    }))
    await reorderAccounts(reordered.map((p, i) => ({ id: p.id, sortOrder: i })))
  }

  async function handleTypeDragEnd(event: DragEndEvent, portfolioId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const sorted = types
      .filter(t => t.portfolioAccountId === portfolioId && t.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const oldIndex = sorted.findIndex(t => t.id === String(active.id))
    const newIndex = sorted.findIndex(t => t.id === String(over.id))
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    setTypes(prev => prev.map(t => {
      const pos = reordered.findIndex(r => r.id === t.id)
      return pos >= 0 ? { ...t, sortOrder: pos } : t
    }))
    await reorderInvestmentTypes(reordered.map((t, i) => ({ id: t.id, sortOrder: i })))
  }

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">טוען...</p>
  if (loadError) return <p className="text-red-400 text-sm text-center py-6">{loadError}</p>

  const activePortfolios = portfolios
    .filter(p => p.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const inactivePortfolios = portfolios.filter(p => p.isActive === false)

  return (
    <div className="space-y-4">
      {/* Add portfolio button */}
      <div className="flex justify-start">
        <button
          onClick={() => {
            setShowAddPortfolio(v => !v)
            setExpandedPortfolioId(null)
            setEditPortfolioId(null)
          }}
          className={`py-2 px-4 text-xs rounded-xl border transition-colors ${
            showAddPortfolio
              ? 'border-accent text-accent'
              : 'border-slate-600 text-slate-400 hover:border-slate-500'
          }`}>
          {showAddPortfolio ? 'ביטול' : '+ הוסף תיק השקעות'}
        </button>
      </div>

      {showAddPortfolio && (
        <PortfolioForm onSubmit={handleAddPortfolio} onCancel={() => setShowAddPortfolio(false)} />
      )}

      {activePortfolios.length === 0 && !showAddPortfolio && (
        <p className="text-slate-500 text-sm text-center py-6">אין תיקי השקעות. לחץ על ״+ הוסף תיק השקעות״ להתחלה.</p>
      )}

      {/* Active portfolios */}
      {activePortfolios.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">תיקי השקעות</p>
          <div className="space-y-2">
            <DndContext id="portfolios-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePortfolioDragEnd}>
              <SortableContext items={activePortfolios.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {activePortfolios.map(portfolio => {
              const isExpanded = expandedPortfolioId === portfolio.id
              const isEditing = editPortfolioId === portfolio.id
              const portfolioTypes = types.filter(t => t.portfolioAccountId === portfolio.id)
              const activeTypes = portfolioTypes
                .filter(t => t.isActive !== false)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              const inactiveTypes = portfolioTypes.filter(t => t.isActive === false)
              const isAddingType = showAddTypeForPortfolio === portfolio.id

              return (
                <SortableRow key={portfolio.id} id={portfolio.id}>
                  {(portfolioHandleProps) => (
                    <div className="bg-surface rounded-2xl overflow-hidden">
                      {isEditing ? (
                        <div className="p-2">
                          <PortfolioForm
                            initial={portfolio}
                            onSubmit={data => handleUpdatePortfolio(portfolio.id, data)}
                            onCancel={() => { setEditPortfolioId(null); setExpandedPortfolioId(portfolio.id) }}
                            onDelete={() => setDeleteConfirm({ kind: 'portfolio', item: portfolio })}
                          />
                        </div>
                      ) : (
                        <>
                          {/* Portfolio header row */}
                          <div className="flex items-center">
                            <span
                              {...portfolioHandleProps}
                              className="pl-4 pr-1 py-3 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 flex-shrink-0 touch-none select-none"
                            >
                              <GripVertical size={16} />
                            </span>
                            <button
                              type="button"
                              className="flex-1 flex items-center px-3 py-3 gap-3 text-right"
                              onClick={() => {
                                setExpandedPortfolioId(v => v === portfolio.id ? null : portfolio.id)
                                setEditPortfolioId(null)
                                setShowAddPortfolio(false)
                              }}>
                              <ProviderLogo provider={portfolio.provider} color={portfolio.color} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium" dir="auto">{portfolio.name}</span>
                              </div>
                              <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-slate-700/50 px-4 pt-3 pb-3 space-y-3">
                              {portfolio.provider && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">חברת השקעות</span>
                                  <span className="text-slate-300">{PROVIDER_LABELS[portfolio.provider]}</span>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setEditPortfolioId(portfolio.id); setShowAddTypeForPortfolio(null) }}
                                  className="flex-1 py-1.5 border border-slate-600 rounded-lg text-xs text-slate-300 hover:text-accent hover:border-accent/50 transition-colors">
                                  ערוך
                                </button>
                                <button
                                  onClick={() => handleHidePortfolio(portfolio)}
                                  className="flex-1 py-1.5 border border-slate-600 rounded-lg text-xs text-slate-300 hover:text-amber-400 hover:border-amber-400/50 transition-colors">
                                  הסתר
                                </button>
                                <button
                                  onClick={() => { setShowAddTypeForPortfolio(v => v === portfolio.id ? null : portfolio.id); setEditTypeId(null) }}
                                  className={`px-3 py-1.5 border rounded-lg text-xs transition-colors ${
                                    isAddingType
                                      ? 'border-accent text-accent'
                                      : 'border-slate-600 text-accent hover:border-accent/50'
                                  }`}>
                                  {isAddingType ? 'ביטול' : '+ הוסף'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Investment types list */}
                          <div className="divide-y divide-slate-800 border-t border-slate-800">
                            <p className="text-xs text-slate-500 px-4 pt-2 pb-1">השקעות</p>
                            <DndContext
                              id={`types-dnd-${portfolio.id}`}
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(e) => handleTypeDragEnd(e, portfolio.id)}
                            >
                              <SortableContext items={activeTypes.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                {activeTypes.map(t => {
                                  const isEditingType = editTypeId === t.id
                                  if (isEditingType) return (
                                    <div key={t.id} className="px-3 py-3">
                                      <AddInvestmentTypeForm
                                        initial={t}
                                        onSubmit={data => handleUpdateType(t.id, data)}
                                        onCancel={() => setEditTypeId(null)}
                                        onDelete={() => setDeleteConfirm({ kind: 'type', item: t })}
                                      />
                                    </div>
                                  )
                                  const curr = getCurrency(t.currency)
                                  const currLabel = curr ? `${curr.symbol} ${curr.code}` : t.currency
                                  const isTypeExpanded = expandedTypeId === t.id
                                  return (
                                    <SortableRow key={t.id} id={t.id}>
                                      {(typeHandleProps) => (
                                        <div>
                                          <div className="flex items-center">
                                            <span
                                              {...typeHandleProps}
                                              className="pl-6 pr-1 py-2.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 flex-shrink-0 touch-none select-none"
                                            >
                                              <GripVertical size={14} />
                                            </span>
                                            <button
                                              type="button"
                                              className="flex-1 flex items-center justify-between pr-4 py-2.5 text-right"
                                              onClick={() => setExpandedTypeId(v => v === t.id ? null : t.id)}>
                                              <div className="min-w-0">
                                                <span className="text-sm">{t.name}</span>
                                                {t.notes && <span className="text-xs text-slate-500 block">{t.notes}</span>}
                                              </div>
                                              <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs text-slate-400">{currLabel}</span>
                                                <span className="text-slate-500 text-xs">{isTypeExpanded ? '⌃' : '⌄'}</span>
                                              </div>
                                            </button>
                                          </div>
                                          {isTypeExpanded && (
                                            <div className="px-4 pb-2.5 flex gap-2">
                                              <button
                                                onClick={() => { setEditTypeId(t.id); setExpandedTypeId(null); setShowAddTypeForPortfolio(null) }}
                                                className="flex-1 py-1.5 border border-slate-600 rounded-lg text-xs text-slate-300 hover:text-accent hover:border-accent/50 transition-colors">
                                                ערוך
                                              </button>
                                              <button
                                                onClick={() => handleHideType(t)}
                                                className="flex-1 py-1.5 border border-slate-600 rounded-lg text-xs text-slate-300 hover:text-amber-400 hover:border-amber-400/50 transition-colors">
                                                הסתר
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </SortableRow>
                                  )
                                })}
                              </SortableContext>
                            </DndContext>

                            {activeTypes.length === 0 && !isAddingType && (
                              <p className="text-slate-500 text-xs text-center py-3 px-4">אין השקעות בתיק זה</p>
                            )}

                            {/* Hidden types inside this portfolio */}
                            {inactiveTypes.map(t => {
                              const curr = getCurrency(t.currency)
                              const currLabel = curr ? `${curr.symbol} ${curr.code}` : t.currency
                              return (
                              <div key={t.id} className="flex items-center justify-between px-6 py-2.5 gap-3 opacity-50">
                                <span className="text-sm line-through text-slate-500">{t.name}</span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-slate-500">{currLabel}</span>
                                  <button
                                    onClick={() => handleHideType(t)}
                                    className="text-xs text-green-400">הצג</button>
                                </div>
                              </div>
                              )
                            })}

                            {/* Add investment type form */}
                            {isAddingType && (
                              <div className="px-3 py-3">
                                <AddInvestmentTypeForm
                                  onSubmit={data => handleAddType(portfolio.id, data)}
                                  onCancel={() => setShowAddTypeForPortfolio(null)}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </SortableRow>
              )
            })}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {/* Hidden portfolios */}
      {inactivePortfolios.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 px-1">תיקים מוסתרים</p>
          <div className="space-y-2">
            {inactivePortfolios.map(portfolio => {
              const isExpanded = expandedPortfolioId === portfolio.id
              return (
                <div key={portfolio.id} className="bg-surface rounded-xl overflow-hidden opacity-60">
                  <button
                    type="button"
                    className="w-full flex items-center px-4 py-3 gap-3 text-right"
                    onClick={() => setExpandedPortfolioId(v => v === portfolio.id ? null : portfolio.id)}>
                    <ProviderLogo provider={portfolio.provider} color={portfolio.color} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm line-through text-slate-500" dir="auto">{portfolio.name}</span>
                    </div>
                    <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 px-4 py-3">
                      <button
                        onClick={() => handleHidePortfolio(portfolio)}
                        className="w-full py-1.5 border border-slate-600 rounded-lg text-xs text-green-400 hover:border-green-400/50 transition-colors">
                        הצג תיק
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          title={deleteConfirm.kind === 'portfolio' ? 'מחיקת תיק השקעות' : 'מחיקת השקעה'}
          itemName={deleteConfirm.item.name}
          warningBody={
            deleteConfirm.kind === 'portfolio'
              ? 'מחיקת התיק היא פעולה בלתי הפיכה. כל ההשקעות בתיק זה לא יימחקו אך יאבדו את הקישור לתיק.'
              : 'מחיקת ההשקעה היא פעולה בלתי הפיכה. רשומות היסטוריות שמקושרות להשקעה זו לא יימחקו אך שם ההשקעה לא יוצג בהן.'
          }
          hideWarning={
            deleteConfirm.kind === 'portfolio'
              ? 'הסתרת התיק מסתירה אותו מהממשק אך שומרת את כל הנתונים. ניתן לשחזר בכל עת.'
              : 'הסתרת ההשקעה מסתירה אותה מטפסי הוספה אך שומרת את כל הרשומות ההיסטוריות.'
          }
          hideLabel={deleteConfirm.kind === 'portfolio' ? 'הסתר תיק (מומלץ)' : 'הסתר השקעה (מומלץ)'}
          onHide={
            deleteConfirm.kind === 'portfolio'
              ? () => handleHidePortfolio(deleteConfirm.item as Account)
              : () => handleHideType(deleteConfirm.item as InvestmentType)
          }
          onDelete={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          deleting={deleting}
        />
      )}
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
      {tab === 'investments' && <InvestmentsSection />}
      {tab === 'maintenance' && <MaintenanceSection />}
    </main>
  )
}
