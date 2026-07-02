'use client'
import { Suspense, useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getAccounts } from '@/lib/firestore/accounts'
import { getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntries } from '@/lib/firestore/salary'
import { getInvestmentEntries, getInvestmentTypes } from '@/lib/firestore/investments'
import { getDividends } from '@/lib/firestore/dividends'
import { getInvestmentConversions } from '@/lib/firestore/conversions'
import { BankFlow, type BankType } from '@/components/import/flows/BankFlow'
import type { Account, Category, CategorizationRule, Transaction, SalaryEntry, InvestmentEntry, Dividend, InvestmentConversion, InvestmentType } from '@/lib/types'

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function bankTypeFromAccount(account: Account): BankType {
  switch (account.provider) {
    case 'one-zero': return 'one-zero'
    case 'leumi': return 'leumi'
    default: return 'generic'
  }
}

function BankPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = params.accountId as string
  const month = searchParams.get('month') ?? currentMonth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [existingTransactions, setExistingTransactions] = useState<Transaction[]>([])
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([])
  const [creditAccounts, setCreditAccounts] = useState<Account[]>([])
  const [creditImmediateAmounts, setCreditImmediateAmounts] = useState<Set<number>>(new Set())
  const [investmentDeposits, setInvestmentDeposits] = useState<InvestmentEntry[]>([])
  const [dividendPayouts, setDividendPayouts] = useState<Dividend[]>([])
  const [conversionPayouts, setConversionPayouts] = useState<InvestmentConversion[]>([])
  const [portfolioAccounts, setPortfolioAccounts] = useState<Account[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [accs, cats, rls, txs, salaries, invEntries, monthDivs, monthConvs, invTypes] = await Promise.all([
          getAccounts(),
          getCategories(),
          getRules(),
          getTransactions(month),
          getSalaryEntries(month),
          getInvestmentEntries(month),
          getDividends(month),
          getInvestmentConversions(month),
          getInvestmentTypes(),
        ])
        const acc = accs.find(a => a.id === accountId)
        if (!acc) { router.replace('/import'); return }
        setAccount(acc)
        setCategories(cats)
        setRules(rls)
        setPreviousTransactions(txs)
        setExistingTransactions(txs.filter(t => t.accountId === accountId))
        setSalaryEntries(salaries)
        const creditAccs = accs.filter(a => a.type === 'credit')
        setCreditAccounts(creditAccs)
        const creditIds = new Set(creditAccs.map(a => a.id))
        setCreditImmediateAmounts(
          new Set(txs.filter(t => t.isImmediate && creditIds.has(t.accountId)).map(t => t.amount))
        )
        setInvestmentDeposits(invEntries.filter(e => e.sourceAccountId === accountId))
        setDividendPayouts(monthDivs.filter(d => !d.staysInPortfolio && d.destinationAccountId === accountId))
        setConversionPayouts(monthConvs.filter(c => c.destinationAccountId === accountId))
        setPortfolioAccounts(accs.filter(a => a.type === 'investment' && a.isActive !== false))
        setInvestmentTypes(invTypes)
      } catch {
        setError('שגיאה בטעינת הנתונים.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accountId, month, router])

  if (loading) return <main className="p-4 max-w-lg mx-auto"><div className="flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></div></main>
  if (error) return <main className="p-4 max-w-lg mx-auto"><p className="text-red-400 text-sm">{error}</p></main>
  if (!account) return null

  return (
    <main className="p-4 max-w-lg mx-auto">
      <BankFlow
        month={month}
        accountId={accountId}
        accountName={account.name}
        bankType={bankTypeFromAccount(account)}
        categories={categories}
        rules={rules}
        previousTransactions={previousTransactions}
        existingTransactions={existingTransactions}
        salaryEntries={salaryEntries}
        creditAccounts={creditAccounts}
        creditImmediateAmounts={creditImmediateAmounts}
        investmentDeposits={investmentDeposits}
        dividendPayouts={dividendPayouts}
        conversionPayouts={conversionPayouts}
        portfolioAccounts={portfolioAccounts}
        investmentTypes={investmentTypes}
        onDone={() => router.push(`/import?month=${month}`)}
      />
    </main>
  )
}

export default function BankPage() {
  return (
    <Suspense>
      <BankPageInner />
    </Suspense>
  )
}
