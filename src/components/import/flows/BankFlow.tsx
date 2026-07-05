'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, ChevronRight } from 'lucide-react'
import { parseOneZeroXlsx } from '@/lib/parsers/one-zero-xlsx-parser'
import { parseLeumiPdf } from '@/lib/parsers/leumi-pdf-parser'
import { parseCSV } from '@/lib/parsers/csv-parser'
import { mapRows } from '@/lib/parsers/transaction-mapper'
import { categorize } from '@/lib/categorization/engine'
import { detectDuplicates } from '@/lib/import/duplicate-detector'
import { addTransactions } from '@/lib/firestore/transactions'
import { ImportError } from '@/lib/parsers/import-errors'
import { SwipeImportDeck } from '../SwipeImportDeck'
import type { SwipeRow } from '../deckUtils'
import type { Account, Category, CategorizationRule, ImportedTransaction, RawTransaction, SalaryEntry, Transaction, TransactionSource, InvestmentEntry, Dividend, InvestmentConversion, InvestmentType } from '@/lib/types'

export type BankType = 'one-zero' | 'leumi' | 'generic'

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

interface BankImportRow extends ImportedTransaction {
  skip: boolean
  skipReason?: 'salary' | 'credit-payment' | 'investment-transfer'
  portfolioAccountId?: string
  investmentTypeId?: string
  investmentDirection?: 'investment' | 'divestment'
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
  investmentDeposits?: InvestmentEntry[]
  dividendPayouts?: Dividend[]
  conversionPayouts?: InvestmentConversion[]
  portfolioAccounts?: Account[]
  investmentTypes?: InvestmentType[]
  onDone: () => void
}

function toTransaction(t: BankImportRow, accountId: string, month: string, source: TransactionSource): Omit<Transaction, 'id'> {
  const isInvestment = !!t.portfolioAccountId
  const dir = isInvestment ? (t.investmentDirection ?? 'investment') : t.direction
  return {
    date: t.date,
    merchantName: t.merchantName,
    amount: t.amount,
    currency: t.currency,
    accountId,
    source,
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


export function suggestSkips(
  txs: ImportedTransaction[],
  salaryEntries: SalaryEntry[],
  creditAccounts: Account[],
  investmentDeposits: InvestmentEntry[] = [],
  dividendPayouts: Dividend[] = [],
  conversionPayouts: InvestmentConversion[] = []
): BankImportRow[] {
  const salaryAmounts = new Set(salaryEntries.map(e => e.netAmount))
  const creditTerms = creditAccounts.flatMap(a => [
    a.name.toLowerCase(),
    ...(a.csvIdentifier ? [a.csvIdentifier.toLowerCase()] : []),
  ])

  const depositIlsAmounts = new Set<number>(
    investmentDeposits
      .map(e => e.ilsEquivalent ?? (e.currency === 'ILS' ? e.amount : null))
      .filter((v): v is number => v !== null)
  )

  const dividendIlsAmounts = new Set<number>(
    dividendPayouts
      .map(d => d.ilsEquivalent ?? (d.currency === 'ILS' ? d.amount : null))
      .filter((v): v is number => v !== null)
  )

  const conversionIlsAmounts = new Set<number>(
    conversionPayouts.map(c => c.ilsReceived)
  )

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
    if (t.direction === 'expense' && depositIlsAmounts.size > 0 && depositIlsAmounts.has(t.amount)) {
      return { ...t, skip: true, skipReason: 'investment-transfer' as const }
    }
    if (t.direction === 'income' && dividendIlsAmounts.size > 0 && dividendIlsAmounts.has(t.amount)) {
      return { ...t, skip: true, skipReason: 'investment-transfer' as const }
    }
    if (t.direction === 'income' && conversionIlsAmounts.size > 0 && conversionIlsAmounts.has(t.amount)) {
      return { ...t, skip: true, skipReason: 'investment-transfer' as const }
    }
    return { ...t, skip: false }
  })
}

export function BankFlow({ month, accountId, accountName, bankType, categories, rules = [], previousTransactions = [], existingTransactions, salaryEntries = [], creditAccounts = [], creditImmediateAmounts, investmentDeposits = [], dividendPayouts = [], conversionPayouts = [], portfolioAccounts = [], investmentTypes = [], onDone }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<BankImportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const withSkips = suggestSkips(mapped, salaryEntries, creditAccounts, investmentDeposits, dividendPayouts, conversionPayouts)
      // Auto-detect investment portfolio from merchant name
      const withAutoDetect = withSkips.map(row => {
        if (row.portfolioAccountId) return row // already set (e.g. suggested skip)
        const detected = autoDetectPortfolio(row.merchantName, portfolioAccounts)
        if (!detected) return row
        return { ...row, portfolioAccountId: detected, investmentDirection: 'investment' as const, skip: false, categoryId: null }
      })
      setRows(withAutoDetect)
    } catch (err) {
      setError(err instanceof ImportError ? err.message : 'שגיאה בקריאת הקובץ. ייתכן שהוא פגום או לא הורד כראוי.')
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeckSave(approved: SwipeRow[]) {
    setSaving(true); setError(null)
    try {
      const toImport = approved as BankImportRow[]
      const { clean, duplicates } = detectDuplicates(toImport, existingTransactions)
      const source: TransactionSource = bankType === 'leumi' ? 'pdf_import' : 'xlsx_import'
      const toSave: BankImportRow[] = duplicates.length > 0
        ? (window.confirm(`נמצאו ${duplicates.length} עסקאות כפולות. לשמור בכל זאת?`) ? toImport : clean as BankImportRow[])
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
    const importedCount = rows.filter(r => !r.skip).length
    const skippedCount = rows.filter(r => r.skip).length
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
