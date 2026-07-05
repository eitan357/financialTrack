'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, ChevronRight } from 'lucide-react'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { getSheetNames, parseSheet } from '@/lib/parsers/xlsx-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { parseIsracardPdf } from '@/lib/parsers/isracard-pdf-parser'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import { ImportError } from '@/lib/parsers/import-errors'
import { SwipeImportDeck } from '../SwipeImportDeck'
import type { SwipeRow } from '../deckUtils'
import type { AccountProvider, Account, Category, CategorizationRule, ImportedTransaction, Transaction, TransactionSource, InvestmentType } from '@/lib/types'

const PROVIDER_ALIASES: Record<string, string[]> = {
  psagot: ['פסגות'],
  hapoalim: ['פועלים', 'bank hapoalim'],
  leumi: ['לאומי', 'bank leumi'],
  discount: ['דיסקונט'],
  mizrahi: ['מזרחי', 'mizrahi tefahot'],
  'one-zero': ['one zero', 'one-zero'],
}

function autoDetectPortfolio(merchantName: string, portfolios: Account[]): string | undefined {
  const name = merchantName.toLowerCase()
  for (const p of portfolios) {
    if (p.name && name.includes(p.name.toLowerCase())) return p.id
    if (p.provider) {
      const aliases = PROVIDER_ALIASES[p.provider] ?? []
      if (aliases.some(a => name.includes(a.toLowerCase()))) return p.id
    }
  }
  return undefined
}

interface CreditRow extends ImportedTransaction {
  skip: boolean
  portfolioAccountId?: string
  investmentTypeId?: string
  investmentDirection?: 'investment' | 'divestment'
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
  investmentTypes?: InvestmentType[]
  onDone: () => void
}

function toTransaction(t: CreditRow, accountId: string, month: string): Omit<Transaction, 'id'> {
  const isInvestment = !!t.portfolioAccountId
  const dir = isInvestment ? (t.investmentDirection ?? 'investment') : t.direction
  return {
    date: t.date,
    merchantName: t.merchantName,
    amount: t.amount,
    currency: t.currency,
    accountId,
    source: 'xlsx_import' as TransactionSource,
    isImmediate: t.isImmediate,
    month,
    direction: dir,
    ...(t.notes && { description: t.notes }),
    ...(isInvestment ? {
      portfolioAccountId: t.portfolioAccountId,
      ...(t.investmentTypeId ? { investmentTypeId: t.investmentTypeId } : {}),
    } : {}),
    ...(!isInvestment && t.direction !== 'income' && t.categoryId ? { categoryId: t.categoryId } : {}),
  }
}

export function CreditFlow({ month, accountId, accountName, provider, categories, rules, previousTransactions, existingTransactions, portfolioAccounts = [], investmentTypes = [], onDone }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<CreditRow[]>([])
  const [xlsxData, setXlsxData] = useState<Uint8Array | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
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

  function setTransactions(txs: ImportedTransaction[]) {
    setRows(txs.map(t => {
      const detected = autoDetectPortfolio(t.merchantName, portfolioAccounts)
      if (!detected) return { ...t, skip: false }
      return { ...t, skip: false, portfolioAccountId: detected, investmentDirection: 'investment' as const, categoryId: null }
    }))
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

  async function handleDeckSave(approved: SwipeRow[]) {
    setSaving(true); setError(null)
    try {
      const toImport = approved as CreditRow[]
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
    const importedCount = rows.filter(r => !r.skip).length
    const skippedCount = rows.length - importedCount
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">נשמר!</h2>
        <p className="text-slate-400 text-sm mb-6">
          {importedCount} עסקאות יובאו{skippedCount > 0 ? `, ${skippedCount} סוננו` : ''}
        </p>
        <button onClick={onDone} className="w-full py-3 bg-accent rounded-xl font-semibold">חזור לרשימה</button>
      </div>
    )
  }

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
        <SwipeImportDeck
          rows={rows}
          categories={categories}
          portfolioAccounts={portfolioAccounts}
          investmentTypes={investmentTypes}
          accountName={accountName}
          month={month}
          saving={saving}
          onSave={handleDeckSave}
          onDone={onDone}
        />
      )}

    </div>
  )
}
