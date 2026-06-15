'use client'
import { useState, useRef } from 'react'
import { Upload, Tag } from 'lucide-react'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { getSheetNames, parseSheet } from '@/lib/parsers/xlsx-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { categorize } from '@/lib/categorization/engine'
import type { Category, CategorizationRule, ImportedTransaction, Transaction } from '@/lib/types'

interface Props {
  stepNumber: number
  accountName: string
  accountId: string
  categories: Category[]
  rules: CategorizationRule[]
  previousTransactions: Transaction[]
  initialTransactions: ImportedTransaction[]
  onComplete: (transactions: ImportedTransaction[]) => void
  onSkip: () => void
  onBack?: () => void
}

export function CreditImportStep({ stepNumber, accountName, categories, rules, previousTransactions, initialTransactions, onComplete, onSkip, onBack }: Props) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>(initialTransactions)
  const [xlsxData, setXlsxData] = useState<Uint8Array | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyCategories(raw: ReturnType<typeof mapRows>): ImportedTransaction[] {
    return raw.map(r => {
      const result = categorize(r.merchantName, rules, previousTransactions)
      return { ...r, categoryId: result.categoryId, categorizationSource: result.source }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        setTransactions(applyCategories(mapRows(parseCSV(text))))
        setXlsxData(null); setAvailableSheets([])
      } else if (file.name.endsWith('.xlsx')) {
        const buf = await file.arrayBuffer()
        const data = new Uint8Array(buf)
        const sheets = getSheetNames(data)
        setXlsxData(data); setAvailableSheets(sheets)
        setSelectedSheets(sheets.length > 0 ? [sheets[0]] : [])
        setTransactions([])
      } else {
        setError('פורמט לא נתמך. השתמש בקובץ CSV או XLSX.')
      }
    } catch {
      setError('שגיאה בקריאת הקובץ. נסה שוב.')
    }
  }

  function loadSheets() {
    if (!xlsxData || selectedSheets.length === 0) return
    const rows = selectedSheets.flatMap(s => parseSheet(xlsxData, s))
    setTransactions(applyCategories(mapRows(rows)))
  }

  function updateCategory(index: number, categoryId: string | null) {
    setTransactions(prev => prev.map((t, i) =>
      i === index ? { ...t, categoryId, categorizationSource: 'manual' } : t
    ))
  }

  const uncategorized = transactions.filter(t => !t.categoryId).length

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">שלב {stepNumber} — {accountName}</h2>

      <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors mb-4"
        onClick={() => fileInputRef.current?.click()}>
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-slate-400 text-sm">העלאת קובץ CSV או XLSX</p>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}

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
            <table className="w-full text-sm" role="table" aria-label="תצוגה מקדימה של עסקאות">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-xs">
                  <th className="text-right py-2 px-2">תאריך</th>
                  <th className="text-right py-2 px-2">בית עסק</th>
                  <th className="text-left py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className={`border-b border-slate-700/40 ${!tx.categoryId ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
                    <td className="py-1.5 px-2 text-slate-400 text-xs">{tx.date}</td>
                    <td className="py-1.5 px-2">
                      <span>{tx.merchantName}</span>
                      {tx.isImmediate && <span className="mr-1 text-xs bg-amber-900/50 text-amber-300 px-1 rounded">מיידי</span>}
                    </td>
                    <td className="py-1.5 px-2 text-left tabular-nums text-xs">{tx.amount.toFixed(2)} {tx.currency}</td>
                    <td className="py-1.5 px-2">
                      <select value={tx.categoryId ?? ''} onChange={e => updateCategory(i, e.target.value || null)}
                        className="bg-background text-foreground text-xs rounded px-1 py-0.5 w-full"
                        aria-label={`קטגוריה עבור ${tx.merchantName}`}>
                        <option value="">— ללא —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex gap-3 mt-4">
        {onBack && <button onClick={onBack} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm">← חזור</button>}
        <button onClick={onSkip} className="flex-1 py-3 border border-slate-600 rounded-xl text-sm text-slate-400">דלג</button>
        {transactions.length > 0 && (
          <button onClick={() => onComplete(transactions)} className="flex-1 py-3 bg-accent rounded-xl text-sm font-semibold">הבא →</button>
        )}
      </div>
    </div>
  )
}
