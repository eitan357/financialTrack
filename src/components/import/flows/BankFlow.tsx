'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Tag } from 'lucide-react'
import { parseOneZeroXlsx } from '@/lib/parsers/one-zero-xlsx-parser'
import { parseLeumiPdf } from '@/lib/parsers/leumi-pdf-parser'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Category, CategorizationRule, ImportedTransaction, RawTransaction, Transaction, TransactionSource } from '@/lib/types'

export type BankType = 'one-zero' | 'leumi' | 'generic'

interface Props {
  month: string
  accountId: string
  accountName: string
  bankType: BankType
  categories: Category[]
  rules?: CategorizationRule[]
  previousTransactions?: Transaction[]
  existingTransactions: Transaction[]
  onDone: () => void
  onBack: () => void
}

function toTransaction(t: ImportedTransaction, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  return {
    date: t.date,
    merchantName: t.merchantName,
    description: t.notes || undefined,
    amount: t.amount,
    currency: t.currency,
    accountId,
    categoryId: t.direction === 'income' ? undefined : (t.categoryId ?? undefined),
    source,
    isImmediate: t.isImmediate,
    month,
    direction: t.direction,
  }
}

const ACCEPT: Record<BankType, string> = {
  'one-zero': '.xls,.xlsx',
  'leumi': '.pdf',
  'generic': '.xls,.xlsx,.pdf',
}

const ACCEPT_LABEL: Record<BankType, string> = {
  'one-zero': 'XLS',
  'leumi': 'PDF',
  'generic': 'XLS / PDF',
}

export function BankFlow({ month, accountId, accountName, bankType, categories, rules = [], previousTransactions = [], existingTransactions, onDone, onBack }: Props) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyCategories(raw: RawTransaction[]): ImportedTransaction[] {
    return raw.map(r => {
      const res = categorize(r.merchantName, rules, previousTransactions)
      const direction = (r.direction ?? 'expense') as 'income' | 'expense'
      return {
        ...r,
        direction,
        categoryId: direction === 'income' ? null : res.categoryId,
        categorizationSource: direction === 'income' ? null : res.source,
      }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const data = new Uint8Array(buf)
      let raw: RawTransaction[]

      if (file.name.toLowerCase().endsWith('.pdf')) {
        raw = await parseLeumiPdf(data)
      } else {
        raw = parseOneZeroXlsx(data)
      }

      const mapped = applyCategories(raw)
      const { duplicates } = detectDuplicates(mapped, existingTransactions)
      setTransactions(mapped)
      setDuplicateWarning(duplicates.length)
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    } finally {
      setParsing(false)
    }
  }

  function updateField(index: number, updates: Partial<ImportedTransaction>) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const { clean, duplicates } = detectDuplicates(transactions, existingTransactions)
      const source: TransactionSource = bankType === 'leumi' ? 'pdf_import' : 'xlsx_import'
      const toSave = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? transactions : clean)
        : transactions
      await addTransactions(toSave.map(t => toTransaction(t, accountId, month, source)))
      setSaved(true)
    } catch {
      setError('שגיאה בשמירה. נסה שוב.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">נשמר!</h2>
        <p className="text-slate-400 text-sm mb-6">{transactions.length} עסקאות יובאו</p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לרשימה</button>
      </div>
    )
  }

  const uncategorized = transactions.filter(t => !t.categoryId && t.direction !== 'income').length

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-foreground">←</button>
        <h2 className="text-lg font-semibold">{accountName}</h2>
      </div>

      <div
        className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-slate-400 text-sm">העלאת קובץ {ACCEPT_LABEL[bankType]}</p>
        <input ref={fileInputRef} type="file" accept={ACCEPT[bankType]} className="hidden" onChange={handleFileChange} />
      </div>

      {parsing && <p className="text-slate-400 text-sm text-center mb-3">מנתח קובץ...</p>}
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {duplicateWarning > 0 && (
        <p className="text-amber-400 text-xs mb-2">⚠️ {duplicateWarning} עסקאות עלולות להיות כפולות</p>
      )}

      {transactions.length > 0 && (
        <>
          {uncategorized > 0 && (
            <p className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <Tag size={12} />{uncategorized} עסקאות ממתינות לקיטלוג
            </p>
          )}
          <div className="overflow-x-auto rounded-xl mb-4">
            <table className="w-full text-sm" aria-label="עסקאות בנק לייבוא">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-right py-2 px-2">הערה</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className={`border-b border-slate-700/40 ${!tx.categoryId && tx.direction !== 'income' ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{tx.date}</td>
                    <td className="py-1.5 px-2 text-xs">{tx.merchantName}</td>
                    <td className="py-1.5 px-2">
                      <input
                        value={tx.notes ?? ''}
                        onChange={e => updateField(i, { notes: e.target.value })}
                        placeholder="הערה"
                        className="w-full bg-background text-xs rounded px-1 py-0.5 min-w-16"
                        aria-label={`הערה עבור ${tx.merchantName}`}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-left tabular-nums text-xs">{tx.amount.toFixed(2)} {tx.currency}</td>
                    <td className="py-1.5 px-2">
                      <select
                        value={tx.direction}
                        onChange={e => updateField(i, { direction: e.target.value as 'income' | 'expense', categoryId: e.target.value === 'income' ? null : tx.categoryId })}
                        className="bg-background text-xs rounded px-1 py-0.5"
                        aria-label={`כיוון עבור ${tx.merchantName}`}
                      >
                        <option value="expense">הוצאה</option>
                        <option value="income">הכנסה</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      {tx.direction === 'expense' ? (
                        <select
                          value={tx.categoryId ?? ''}
                          onChange={e => updateField(i, { categoryId: e.target.value || null, categorizationSource: 'manual' })}
                          className="bg-background text-foreground text-xs rounded px-1 py-0.5 w-full"
                          aria-label={`קטגוריה עבור ${tx.merchantName}`}
                        >
                          <option value="">— ללא —</option>
                          {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-green-400">הכנסה</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
            {saving ? 'שומר...' : `שמור ${transactions.length} עסקאות`}
          </button>
        </>
      )}

      <button onClick={onBack} className="w-full py-2 text-slate-400 text-sm">← חזור</button>
    </div>
  )
}
