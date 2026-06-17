'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { seedDefaultAccounts, getAccounts } from '@/lib/firestore/accounts'
import { seedDefaultCategories, getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { getSalaryEntry } from '@/lib/firestore/salary'
import { CreditImportStep } from './steps/CreditImportStep'
import { SalaryStep } from './steps/SalaryStep'
import { IncomeStep } from './steps/IncomeStep'
import { CashStep } from './steps/CashStep'
import { SummaryStep } from './steps/SummaryStep'
import type { WizardData, CreditAccountData } from './steps/SummaryStep'
import type { Account, Category, CategorizationRule, ImportedTransaction, SalaryEntry, IncomeEntry, Transaction } from '@/lib/types'

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface CashExpense {
  description: string
  amount: number
  date: string
  categoryId: string | null
}

const EMPTY_DATA: WizardData = { creditAccounts: [], salary: null, salaryAccountId: null, incomeEntries: [], cashExpenses: [] }

export function ImportWizard() {
  const [month, setMonth] = usePersistedMonth()
  const [step, setStep] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)
  const [data, setData] = useState<WizardData>(EMPTY_DATA)

  useEffect(() => {
    setLoading(true)
    async function init() {
      try {
        await Promise.all([seedDefaultAccounts(), seedDefaultCategories()])
        const [accs, cats, rls, txs, prevSal] = await Promise.all([
          getAccounts(),
          getCategories(),
          getRules(),
          getTransactions(month),
          getSalaryEntry(prevMonthStr(month)),
        ])
        setAccounts(accs)
        setCategories(cats)
        setRules(rls)
        setPreviousTransactions(txs)
        if (prevSal) {
          const { id: _id, ...rest } = prevSal
          setPreviousSalary(rest)
        }
      } catch (e) {
        console.error('Failed to initialize import wizard', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [month])

  function changeMonth(m: string) {
    setMonth(m)
    setStep(1)
    setData(EMPTY_DATA)
  }

  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.isActive)
  const bankAccounts = accounts.filter(a => a.type === 'bank' && a.isActive)
  const cash = accounts.find(a => a.name === 'מזומן')

  const SALARY_STEP  = creditAccounts.length + 1
  const INCOME_STEP  = creditAccounts.length + 2
  const CASH_STEP    = creditAccounts.length + 3
  const SUMMARY_STEP = creditAccounts.length + 4
  const TOTAL_STEPS  = creditAccounts.length + 4

  if (loading) {
    return <main className="p-4 flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></main>
  }

  return (
    <main className="p-4 max-w-lg mx-auto">
      <MonthHeader month={month} onMonthChange={changeMonth} />

      {step < SUMMARY_STEP && <p className="text-center text-sm text-slate-400 mb-4">שלב {step} מתוך {TOTAL_STEPS - 1}</p>}

      {creditAccounts.map((account, idx) =>
        step === idx + 1 ? (
          <CreditImportStep
            key={account.id}
            stepNumber={idx + 1}
            accountName={account.name}
            accountId={account.id}
            categories={categories}
            rules={rules}
            previousTransactions={previousTransactions}
            initialTransactions={data.creditAccounts[idx]?.transactions ?? []}
            onComplete={txs => {
              const next: CreditAccountData[] = [...data.creditAccounts]
              next[idx] = { accountId: account.id, accountName: account.name, transactions: txs }
              setData(d => ({ ...d, creditAccounts: next }))
              setStep(idx + 2)
            }}
            onSkip={() => setStep(idx + 2)}
            onBack={idx > 0 ? () => setStep(idx) : undefined}
          />
        ) : null
      )}

      {step === SALARY_STEP && (
        <SalaryStep month={month} initialSalary={data.salary ?? previousSalary} bankAccounts={bankAccounts}
          onComplete={(sal, accId) => { setData(d => ({ ...d, salary: sal, salaryAccountId: accId })); setStep(INCOME_STEP) }}
          onSkip={() => setStep(INCOME_STEP)} onBack={() => setStep(creditAccounts.length)} />
      )}
      {step === INCOME_STEP && (
        <IncomeStep month={month} initialEntries={data.incomeEntries}
          onComplete={entries => { setData(d => ({ ...d, incomeEntries: entries })); setStep(CASH_STEP) }}
          onBack={() => setStep(SALARY_STEP)} />
      )}
      {step === CASH_STEP && (
        <CashStep month={month} categories={categories} initialExpenses={data.cashExpenses}
          onComplete={expenses => { setData(d => ({ ...d, cashExpenses: expenses })); setStep(SUMMARY_STEP) }}
          onBack={() => setStep(INCOME_STEP)} />
      )}
      {step === SUMMARY_STEP && (
        <SummaryStep month={month} data={data} cashAccountId={cash?.id ?? ''}
          onDone={() => { setStep(1); setData(EMPTY_DATA) }} />
      )}
    </main>
  )
}
