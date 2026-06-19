'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, Tag, ChevronRight } from 'lucide-react'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { getSheetNames, parseSheet } from '@/lib/parsers/xlsx-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { parseLeumiPdf } from '@/lib/parsers/leumi-pdf-parser'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import type { Category, CategorizationRule, ImportedTransaction, Transaction, TransactionSource } from '@/lib/types'

interface Props {
  month: string
  accountId: string
  accountName: string
  categories: Category[]
  rules: CategorizationRule[]
  previousTransactions: Transaction[]
  existingTransactions: Transaction[]
  onDone: () => void
}

function toTransaction(t: ImportedTransaction, accountId: string, month: string): Omit<Transaction, 'id'> {
  return {
    date: t.date,
    merchantName: t.merchantName,
    description: t.notes || undefined,
    amount: t.amount,
    currency: t.currency,
    accountId,
    categoryId: t.direction === 'income' ? undefined : (t.categoryId ?? undefined),
    source: 'xlsx_import' as TransactionSource,
    isImmediate: t.isImmediate,
    month,
    direction: t.direction,
  }
}

export function CreditFlow({ month, accountId, accountName, categories, rules, previousTransactions, existingTransactions, onDone }: Props) {
  const router = useRouter()
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([])
  const [xlsxData, setXlsxData] = useState<Uint8Array | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyCategories(raw: ReturnType<typeof mapRows>): ImportedTransaction[] {
    return raw.map(r => {
      const result = categorize(r.merchantName, rules, previousTransactions)
      const direction = (r.direction ?? (r.amount < 0 ? 'income' : 'expense')) as 'income' | 'expense'
      return {
        ...r,
        amount: Math.abs(r.amount),
        direction,
        categoryId: direction === 'income' ? null : result.categoryId,
        categorizationSource: direction === 'income' ? null : result.source,
      }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const ext = file.name.toLowerCase()
      if (ext.endsWith('.csv')) {
        const text = await file.text()
        const mapped = applyCategories(mapRows(parseCSV(text)))
        const { duplicates } = detectDuplicates(mapped, existingTransactions)
        setTransactions(mapped)
        setDuplicateWarning(duplicates.length)
        setXlsxData(null); setAvailableSheets([])
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        const buf = await file.arrayBuffer()
        const data = new Uint8Array(buf)
        const sheets = getSheetNames(data)
        setXlsxData(data); setAvailableSheets(sheets)
        setSelectedSheets(sheets.length > 0 ? [sheets[0]] : [])
        setTransactions([])
      } else if (ext.endsWith('.pdf')) {
        const buf = await file.arrayBuffer()
        const mapped = applyCategories(await parseLeumiPdf(new Uint8Array(buf)))
        if (mapped.length === 0) {
          setError('לא נמצאו עסקאות בקובץ ה-PDF. ייתכן שהפורמט אינו נתמך.')
          return
        }
        const { duplicates } = detectDuplicates(mapped, existingTransactions)
        setTransactions(mapped)
        setDuplicateWarning(duplicates.length)
        setXlsxData(null); setAvailableSheets([])
      } else {
        setError('פורמט לא נתמך. השתמש בקובץ CSV, XLSX או PDF.')
      }
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    }
  }

  function loadSheets() {
    if (!xlsxData || selectedSheets.length === 0) return
    try {
      const rows = selectedSheets.flatMap(s => parseSheet(xlsxData, s))
      const mapped = applyCategories(mapRows(rows))
      if (mapped.length === 0) {
        setError('לא נמצאו עסקאות בגליונות שנבחרו. ייתכן שפורמט הקובץ שונה מהצפוי.')
        return
      }
      const { duplicates } = detectDuplicates(mapped, existingTransactions)
      setTransactions(mapped)
      setDuplicateWarning(duplicates.length)
      setError(null)
    } catch {
      setError('שגיאה בניתוח הגליונות. נסה שוב.')
    }
  }

  function updateField(index: number, updates: Partial<ImportedTransaction>) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const { clean, duplicates } = detectDuplicates(transactions, existingTransactions)
      const toSave = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? transactions : clean)
        : transactions
      await addTransactions(toSave.map(t => toTransaction(t, accountId, month)))
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
        <p className="text-slate-400 text-sm">העלאת קובץ CSV, XLS, XLSX או PDF</p>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={handleFileChange} />
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {duplicateWarning > 0 && (
        <p className="text-amber-400 text-xs mb-2">⚠️ {duplicateWarning} עסקאות עלולות להיות כפולות</p>
      )}

      {availableSheets.length > 0 && (
        <div className="bg-surface rounded-xl p-4 mb-4">
          <p className="text-sm font-medium mb-2">בחר גליונות לייבוא:</p>
          {availableSheets.map(sheet => (
            <label key={sheet} className="flex items-center gap-2 mb-1 cursor-pointer text-sm">
              <input type="checkbox" checked={selectedSheets.includes(sheet)}
                onChange={e => setSelectedSheets(p => e.target.checked ? [...p, sheet] : p.filter(s => s !== sheet))} />
              {sheet}
            </label>
          ))}
          <button onClick={loadSheets} className="mt-2 w-full py-2 bg-accent rounded-lg text-sm font-medium">טען גליונות</button>
        </div>
      )}

      {transactions.length > 0 && (
        <>
          {uncategorized > 0 && (
            <p className="text-blue-400 text-xs mb-2 flex items-center gap-1">
              <Tag size={12} />{uncategorized} עסקאות ממתינות לקיטלוג
            </p>
          )}
          <div className="overflow-x-auto rounded-xl mb-4">
            <table className="w-full text-sm" aria-label="עסקאות לייבוא">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">בית עסק</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className="border-b border-slate-700/40">
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{tx.date}</td>
                    <td className="py-1.5 px-2 text-xs">{tx.merchantName}</td>
                    <td className="py-1.5 px-2">
                      <input
                        value={tx.notes ?? ''}
                        onChange={e => updateField(i, { notes: e.target.value })}
                        placeholder="תיאור"
                        className="w-full bg-background text-xs rounded px-1 py-0.5 min-w-16"
                        aria-label={`תיאור עבור ${tx.merchantName}`}
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3"
          >
            {saving ? 'שומר...' : `שמור ${transactions.length} עסקאות`}
          </button>
        </>
      )}

    </div>
  )
}
