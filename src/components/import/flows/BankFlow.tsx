'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, Tag, ChevronRight } from 'lucide-react'
import { parseOneZeroXlsx } from '@/lib/parsers/one-zero-xlsx-parser'
import { parseLeumiPdf } from '@/lib/parsers/leumi-pdf-parser'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import { ImportError } from '@/lib/parsers/import-errors'
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
  creditImmediateAmounts?: Set<number>
  onDone: () => void
}

function toTransaction(t: ImportedTransaction, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  return {
    date: t.date,
    merchantName: t.merchantName,
    amount: t.amount,
    currency: t.currency,
    accountId,
    source,
    isImmediate: t.isImmediate,
    month,
    direction: t.direction,
    ...(t.notes && { description: t.notes }),
    ...(t.direction !== 'income' && t.categoryId ? { categoryId: t.categoryId } : {}),
  }
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

export function BankFlow({ month, accountId, accountName, bankType, categories, rules = [], previousTransactions = [], existingTransactions, salaryEntries = [], creditAccounts = [], creditImmediateAmounts, onDone }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<BankImportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeRows = rows.filter(r => !r.skip)
  const skippedCount = rows.filter(r => r.skip).length

  function existingMatch(tx: ImportedTransaction) {
    return existingTransactions.find(e =>
      e.date === tx.date && Math.abs(e.amount) === tx.amount && e.merchantName === tx.merchantName
    )
  }
  const duplicateCount = activeRows.filter(r => existingMatch(r)).length

  function applyCategories(raw: RawTransaction[]): ImportedTransaction[] {
    return raw.map(r => {
      const res = categorize(r.merchantName, rules, previousTransactions)
      const direction: 'income' | 'expense' = r.direction ?? 'expense'
      const autoImmediate = direction === 'expense' && !!creditImmediateAmounts?.has(r.amount)
      return {
        ...r,
        direction,
        isImmediate: r.isImmediate || autoImmediate,
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

      const ext = file.name.toLowerCase()
      if (ext.endsWith('.pdf') || bankType === 'leumi') {
        raw = await parseLeumiPdf(data)
      } else if (ext.endsWith('.csv')) {
        const text = await file.text()
        raw = mapRows(parseCSV(text))
      } else {
        raw = parseOneZeroXlsx(data)
      }

      if (raw.length === 0) {
        if (bankType === 'leumi') {
          setError('לא נמצאו עסקאות בקובץ ה-PDF. ודא שהורדת דפדף עסקאות של לאומי.')
        } else if (bankType === 'one-zero') {
          setError('לא נמצאו עסקאות בקובץ. ודא שהורדת את קובץ העסקאות מאפליקציית One Zero.')
        } else {
          setError('לא נמצאו עסקאות בקובץ. ודא שהורדת את הקובץ ישירות מאתר הבנק.')
        }
        return
      }

      const mapped = applyCategories(raw)
      setRows(suggestSkips(mapped, salaryEntries, creditAccounts))
    } catch (err) {
      setError(err instanceof ImportError ? err.message : 'שגיאה בקריאת הקובץ. ייתכן שהוא פגום או לא הורד כראוי.')
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
        <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-foreground transition-colors">
          <ChevronRight size={22} />
        </button>
        <h2 className="text-lg font-semibold">{accountName}</h2>
      </div>

      <div
        className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-slate-400 text-sm">
          {bankType === 'leumi' ? 'העלאת קובץ PDF' : bankType === 'one-zero' ? 'העלאת קובץ XLS' : 'העלאת קובץ XLS, XLSX, PDF או CSV'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={bankType === 'leumi' ? '.pdf' : bankType === 'one-zero' ? '.xls,.xlsx' : '.xls,.xlsx,.pdf,.csv'}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {parsing && <p className="text-slate-400 text-sm text-center mb-3">מנתח קובץ...</p>}
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {duplicateCount > 0 && (
        <p className="text-amber-400 text-xs mb-2">⚠️ {duplicateCount} עסקאות מסומנות כבר קיימות בחשבון — בדוק השורות המסומנות</p>
      )}

      {rows.length > 0 && (
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
                  <th className="py-2 px-2 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={activeRows.length === rows.length && rows.length > 0}
                      onChange={e => setRows(prev => prev.map(r => ({ ...r, skip: !e.target.checked })))}
                      className="accent-accent"
                      aria-label="בחר/בטל הכל"
                      title="בחר/בטל הכל"
                    />
                  </th>
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-right py-2 px-2">הערה</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">מיידי</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const match = row.skip ? undefined : existingMatch(row)
                  return (
                  <tr key={`${row.date}-${row.merchantName}-${i}`}
                    className={`border-b border-slate-700/40 ${row.skip ? 'opacity-30' : match ? 'bg-amber-900/10' : ''}`}>
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
                    <td className="py-1.5 px-2 text-xs">
                      <div>{row.merchantName}</div>
                      {match && <div className="text-amber-400 text-xs mt-0.5">⚠️ כבר קיים ({match.date})</div>}
                    </td>
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
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.isImmediate}
                        onChange={e => updateRow(i, { isImmediate: e.target.checked })}
                        disabled={row.skip}
                        className="accent-amber-400 disabled:opacity-40"
                        aria-label={`חיוב מיידי עבור ${row.merchantName}`}
                        title="חיוב מיידי"
                      />
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
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={handleSave} disabled={saving || activeRows.length === 0}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3">
            {saving ? 'שומר...' : `שמור ${activeRows.length} עסקאות`}
          </button>
        </>
      )}

    </div>
  )
}
