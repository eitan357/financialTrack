'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, Tag, ChevronRight } from 'lucide-react'
import { SelectField } from '@/components/ui/SelectField'
import { DirectionToggle } from '@/components/ui/DirectionToggle'
import { CurrencyPicker } from '@/components/ui/CurrencyPicker'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { getSheetNames, parseSheet } from '@/lib/parsers/xlsx-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { parseIsracardPdf } from '@/lib/parsers/isracard-pdf-parser'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import { ImportError } from '@/lib/parsers/import-errors'
import type { AccountProvider, Account, Category, CategorizationRule, ImportedTransaction, Transaction, TransactionSource } from '@/lib/types'

interface CreditRow extends ImportedTransaction {
  skip: boolean
  portfolioAccountId?: string
}

interface Props {
  month: string
  accountId: string
  accountName: string
  provider?: AccountProvider
  categories: Category[]
  rules: CategorizationRule[]
  previousTransactions: Transaction[]
  existingTransactions: Transaction[]
  portfolioAccounts?: Account[]
  onDone: () => void
}

function toTransaction(t: CreditRow, accountId: string, month: string): Omit<Transaction, 'id'> {
  const isInvestment = !!t.portfolioAccountId
  return {
    date: t.date,
    merchantName: t.merchantName,
    amount: t.amount,
    currency: t.currency,
    accountId,
    source: 'xlsx_import' as TransactionSource,
    isImmediate: t.isImmediate,
    month,
    direction: isInvestment ? 'investment' : t.direction,
    ...(t.notes && { description: t.notes }),
    ...(isInvestment ? { portfolioAccountId: t.portfolioAccountId } : {}),
    ...(!isInvestment && t.direction !== 'income' && t.categoryId ? { categoryId: t.categoryId } : {}),
  }
}

export function CreditFlow({ month, accountId, accountName, provider, categories, rules, previousTransactions, existingTransactions, portfolioAccounts = [], onDone }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<CreditRow[]>([])
  const [xlsxData, setXlsxData] = useState<Uint8Array | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeRows = rows.filter(r => !r.skip)
  const skippedCount = rows.length - activeRows.length

  function existingMatch(tx: ImportedTransaction) {
    return existingTransactions.find(e =>
      e.date === tx.date && Math.abs(e.amount) === tx.amount && e.merchantName === tx.merchantName
    )
  }
  const duplicateCount = activeRows.filter(r => existingMatch(r)).length

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

  function setTransactions(txs: ImportedTransaction[]) {
    setRows(txs.map(t => ({ ...t, skip: false })))
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
        if (mapped.length === 0) {
          setError('לא נמצאו עסקאות בקובץ ה-CSV. ודא שהורדת את הקובץ ישירות מאתר חברת האשראי.')
          return
        }
        setTransactions(mapped)
        setXlsxData(null); setAvailableSheets([])
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        const buf = await file.arrayBuffer()
        const data = new Uint8Array(buf)
        const sheets = getSheetNames(data)
        setXlsxData(data); setAvailableSheets(sheets)
        setSelectedSheets(sheets.length > 0 ? [sheets[0]] : [])
        setRows([])
      } else if (ext.endsWith('.pdf')) {
        const buf = await file.arrayBuffer()
        const mapped = applyCategories(await parseIsracardPdf(new Uint8Array(buf)))
        if (mapped.length === 0) {
          setError('לא נמצאו עסקאות בקובץ ה-PDF. ודא שהורדת דפדף עסקאות של ישראכרט.')
          return
        }
        setTransactions(mapped)
        setXlsxData(null); setAvailableSheets([])
      } else {
        setError(`סוג קובץ זה אינו נתמך. השתמש ב-${provider === 'isracard' ? 'XLSX או PDF' : provider === 'max' ? 'XLSX או CSV' : 'CSV, XLSX או PDF'}.`)
      }
    } catch (err) {
      setError(err instanceof ImportError ? err.message : 'שגיאה בקריאת הקובץ. ייתכן שהוא פגום או לא הורד כראוי.')
    }
  }

  function loadSheets() {
    if (!xlsxData || selectedSheets.length === 0) return
    try {
      const rows = selectedSheets.flatMap(s => parseSheet(xlsxData, s))
      const mapped = applyCategories(mapRows(rows))
      if (mapped.length === 0) {
        setError('לא נמצאו עסקאות בגיליונות שנבחרו. ודא שבחרת את הגיליון הנכון ושהקובץ הורד מאתר חברת האשראי.')
        return
      }
      setTransactions(mapped)
      setError(null)
    } catch (err) {
      setError(err instanceof ImportError ? err.message : 'שגיאה בניתוח הקובץ. ייתכן שהוא פגום.')
    }
  }

  function updateRow(index: number, updates: Partial<CreditRow>) {
    setRows(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const toImport = rows.filter(r => !r.skip)
      const { clean, duplicates } = detectDuplicates(toImport, existingTransactions)
      const toSave = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? toImport : clean)
        : toImport
      await addTransactions(toSave.map(t => toTransaction(t as CreditRow, accountId, month)))
      setSaved(true)
    } catch (err) {
      console.error('addTransactions failed:', err)
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
          {provider === 'isracard' ? 'העלאת קובץ XLSX או PDF'
            : provider === 'max' ? 'העלאת קובץ XLSX או CSV'
            : 'העלאת קובץ CSV, XLSX או PDF'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={provider === 'isracard' ? '.xlsx,.xls,.pdf' : provider === 'max' ? '.xlsx,.xls,.csv' : '.csv,.xlsx,.xls,.pdf'}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {duplicateCount > 0 && (
        <p className="text-amber-400 text-xs mb-2">⚠️ {duplicateCount} עסקאות מסומנות כבר קיימות בחשבון — בדוק השורות המסומנות</p>
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

      {rows.length > 0 && (
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
                  <th className="py-2 px-2 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={activeRows.length === rows.length}
                      onChange={e => setRows(prev => prev.map(r => ({ ...r, skip: !e.target.checked })))}
                      className="accent-accent"
                      aria-label="בחר/בטל הכל"
                      title="בחר/בטל הכל"
                    />
                  </th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">תאריך</th>
                  <th className="text-right py-2 px-2">בית עסק</th>
                  <th className="text-right py-2 px-2">תיאור</th>
                  <th className="text-right py-2 px-2">סכום</th>
                  <th className="text-right py-2 px-2">כיוון</th>
                  <th className="text-right py-2 px-2">תיק</th>
                  <th className="text-right py-2 px-2">מיידי</th>
                  <th className="text-right py-2 px-2">קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx, i) => {
                  const match = tx.skip ? undefined : existingMatch(tx)
                  return (
                  <tr key={i} className={`border-b border-slate-700/40 ${tx.skip ? 'opacity-30' : match ? 'bg-amber-900/10' : ''}`}>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={!tx.skip}
                        onChange={e => updateRow(i, { skip: !e.target.checked })}
                        className="accent-accent"
                        aria-label={`כלול ${tx.merchantName}`}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-slate-400 text-xs whitespace-nowrap">{tx.date}</td>
                    <td className="py-1.5 px-2 text-xs">
                      <div>{tx.merchantName}</div>
                      {match && <div className="text-amber-400 text-xs mt-0.5">⚠️ כבר קיים</div>}
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        value={tx.notes ?? ''}
                        onChange={e => updateRow(i, { notes: e.target.value })}
                        placeholder="תיאור"
                        disabled={tx.skip}
                        className="w-full bg-background text-xs rounded px-1 py-0.5 min-w-16 disabled:opacity-40"
                        aria-label={`תיאור עבור ${tx.merchantName}`}
                      />
                    </td>
                    <td className="py-1.5 px-2 tabular-nums text-xs">
                      <div className="flex items-center gap-1">
                        <span>{tx.amount.toFixed(2)}</span>
                        {!tx.skip && (
                          <CurrencyPicker
                            value={tx.currency}
                            onChange={v => updateRow(i, { currency: v })}
                          />
                        )}
                        {tx.skip && <span className="text-slate-500">{tx.currency}</span>}
                      </div>
                    </td>
                    <td className={`py-1.5 px-2 ${tx.skip && !tx.portfolioAccountId ? 'opacity-40 pointer-events-none' : ''}`}>
                      {tx.portfolioAccountId ? (
                        <span className="text-xs text-purple-400">השקעה</span>
                      ) : (
                        <DirectionToggle
                          value={tx.direction}
                          onChange={v => updateRow(i, { direction: v, categoryId: v === 'income' ? null : tx.categoryId })}
                          size="sm"
                        />
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={tx.portfolioAccountId ?? ''}
                        onChange={e => {
                          const pid = e.target.value || undefined
                          updateRow(i, {
                            portfolioAccountId: pid,
                            skip: pid ? false : tx.skip,
                            categoryId: pid ? null : tx.categoryId,
                          })
                        }}
                        disabled={tx.skip && !tx.portfolioAccountId}
                        className="bg-background text-xs rounded px-1 py-0.5 text-purple-400 disabled:opacity-30"
                        aria-label={`תיק השקעות עבור ${tx.merchantName}`}
                      >
                        <option value="">—</option>
                        {portfolioAccounts.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={tx.isImmediate}
                        onChange={e => updateRow(i, { isImmediate: e.target.checked })}
                        disabled={tx.skip}
                        className="accent-amber-400 disabled:opacity-40"
                        aria-label={`חיוב מיידי עבור ${tx.merchantName}`}
                        title="חיוב מיידי"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      {tx.skip && !tx.portfolioAccountId ? (
                        <span className="text-xs text-slate-600">מסונן</span>
                      ) : tx.portfolioAccountId ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : tx.direction === 'expense' ? (
                        <SelectField
                          value={tx.categoryId ?? ''}
                          onChange={v => updateRow(i, { categoryId: v || null, categorizationSource: 'manual' })}
                          options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name, color: c.color }))}
                          nullable
                          nullLabel="— ללא —"
                          placeholder="— ללא —"
                          size="sm"
                          disabled={tx.skip}
                        />
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
          <button
            onClick={handleSave}
            disabled={saving || activeRows.length === 0}
            className="w-full py-3 bg-accent rounded-xl text-sm font-semibold disabled:opacity-50 mb-3"
          >
            {saving ? 'שומר...' : `שמור ${activeRows.length} עסקאות`}
          </button>
        </>
      )}

    </div>
  )
}
