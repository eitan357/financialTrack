'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Tag } from 'lucide-react'
import { parseOneZeroXlsx } from '@/lib/parsers/one-zero-xlsx-parser'
import { parseLeumiPdf } from '@/lib/parsers/leumi-pdf-parser'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Account, Category, CategorizationRule, ImportedTransaction, RawTransaction, SalaryEntry, Transaction, TransactionSource } from '@/lib/types'

export type BankType = 'one-zero' | 'leumi' | 'generic'

interface BankImportRow extends ImportedTransaction {
  skip: boolean
  skipReason?: 'salary' | 'credit-payment'
}

interface Props {
  month: string
  accountId: string
  accountName: string
  bankType: BankType
  categories: Category[]
  rules?: CategorizationRule[]
  previousTransactions?: Transaction[]
  existingTransactions: Transaction[]
  salaryEntries?: SalaryEntry[]
  creditAccounts?: Account[]
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

function suggestSkips(txs: ImportedTransaction[], salaryEntries: SalaryEntry[], creditAccounts: Account[]): BankImportRow[] {
  const salaryAmounts = new Set(salaryEntries.map(e => e.netAmount))
  const creditTerms = creditAccounts.flatMap(a => [
    a.name.toLowerCase(),
    ...(a.csvIdentifier ? [a.csvIdentifier.toLowerCase()] : []),
  ])

  return txs.map(t => {
    if (t.direction === 'income' && salaryAmounts.size > 0 && salaryAmounts.has(t.amount)) {
      return { ...t, skip: true, skipReason: 'salary' as const }
    }
    if (t.direction === 'expense' && creditTerms.length > 0) {
      const lowerMerchant = t.merchantName.toLowerCase()
      if (creditTerms.some(term => term && lowerMerchant.includes(term))) {
        return { ...t, skip: true, skipReason: 'credit-payment' as const }
      }
    }
    return { ...t, skip: false }
  })
}

export function BankFlow({ month, accountId, accountName, bankType, categories, rules = [], previousTransactions = [], existingTransactions, salaryEntries = [], creditAccounts = [], onDone, onBack }: Props) {
  const [rows, setRows] = useState<BankImportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeRows = rows.filter(r => !r.skip)
  const skippedCount = rows.filter(r => r.skip).length
  const { duplicates: liveDuplicates } = detectDuplicates(activeRows, existingTransactions)
  const duplicateWarning = liveDuplicates.length

  function applyCategories(raw: RawTransaction[]): ImportedTransaction[] {
    return raw.map(r => {
      const res = categorize(r.merchantName, rules, previousTransactions)
      const direction: 'income' | 'expense' = r.direction ?? 'expense'
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

      if (bankType === 'leumi' || file.name.toLowerCase().endsWith('.pdf')) {
        raw = await parseLeumiPdf(data)
      } else {
        raw = parseOneZeroXlsx(data)
      }

      const mapped = applyCategories(raw)
      setRows(suggestSkips(mapped, salaryEntries, creditAccounts))
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateRow(index: number, updates: Partial<BankImportRow>) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const toImport = rows.filter(r => !r.skip)
      const { clean, duplicates } = detectDuplicates(toImport, existingTransactions)
      const source: TransactionSource = bankType === 'leumi' ? 'pdf_import' : 'xlsx_import'
      const toSave = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? toImport : clean)
        : toImport
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
        <p className="text-slate-400 text-sm mb-6">
          {activeRows.length} עסקאות יובאו{skippedCount > 0 ? `, ${skippedCount} סוננו` : ''}
        </p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לרשימה</button>
      </div>
    )
  }

  const uncategorized = activeRows.filter(t => !t.categoryId && t.direction !== 'income').length

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

      {rows.length > 0 && (
        <>
          {skippedCount > 0 && (
            <p className="text-slate-500 text-xs mb-2">
              {skippedCount} עסקאות סוננו אוטומטית (משכורת / אשראי) — בטל סימון V בטבלה להכללה
            </p>
          )}
          {uncategorized > 0 && (
            <p className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <Tag size={12} />{uncategorized} עסקאות ממתינות לקיטלוג
            </p>
          )}
          <div className="overflow-x-auto rounded-xl mb-4">
            <table className="w-full text-sm" aria-label="עסקאות בנק לייבוא">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="py-2 px-2 w-8 text-center">✓</th>
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-right py-2 px-2">הערה</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.date}-${row.merchantName}-${i}`}
                    className={`border-b border-slate-700/40 ${row.skip ? 'opacity-30' : (!row.categoryId && row.direction !== 'income' ? 'ring-1 ring-inset ring-blue-400' : '')}`}>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={!row.skip}
                        onChange={e => updateRow(i, { skip: !e.target.checked })}
                        className="accent-accent"
                        aria-label={`כלול ${row.merchantName}`}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{row.date}</td>
                    <td className="py-1.5 px-2 text-xs">{row.merchantName}</td>
                    <td className="py-1.5 px-2">
                      <input
                        value={row.notes ?? ''}
                        onChange={e => updateRow(i, { notes: e.target.value })}
                        placeholder="הערה"
                        disabled={row.skip}
                        className="w-full bg-background text-xs rounded px-1 py-0.5 min-w-16 disabled:opacity-40"
                        aria-label={`הערה עבור ${row.merchantName}`}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-left tabular-nums text-xs">{row.amount.toFixed(2)} {row.currency}</td>
                    <td className="py-1.5 px-2">
                      <select
                        value={row.direction}
                        onChange={e => updateRow(i, { direction: e.target.value as 'income' | 'expense', categoryId: e.target.value === 'income' ? null : row.categoryId })}
                        disabled={row.skip}
                        className="bg-background text-xs rounded px-1 py-0.5 disabled:opacity-40"
                        aria-label={`כיוון עבור ${row.merchantName}`}
                      >
                        <option value="expense">הוצאה</option>
                        <option value="income">הכנסה</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      {row.skip ? (
                        <span className="text-xs text-slate-600">מסונן</span>
                      ) : row.direction === 'expense' ? (
                        <select
                          value={row.categoryId ?? ''}
                          onChange={e => updateRow(i, { categoryId: e.target.value || null, categorizationSource: 'manual' })}
                          className="bg-background text-foreground text-xs rounded px-1 py-0.5 w-full"
                          aria-label={`קטגוריה עבור ${row.merchantName}`}
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
          <button onClick={handleSave} disabled={saving || activeRows.length === 0}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
            {saving ? 'שומר...' : `שמור ${activeRows.length} עסקאות`}
          </button>
        </>
      )}

      <button onClick={onBack} className="w-full py-2 text-slate-400 text-sm">← חזור</button>
    </div>
  )
}
