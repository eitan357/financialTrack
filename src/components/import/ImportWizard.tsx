'use client'
import { useState, useEffect } from 'react'
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
import type { Account, Category, CategorizationRule, ImportedTransaction, SalaryEntry, IncomeEntry, Transaction } from '@/lib/types'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface CashExpense {
  description: string
  amount: number
  date: string
  categoryId: string | null
}

interface WizardData {
  step1Transactions: ImportedTransaction[]
  step2Transactions: ImportedTransaction[]
  salary: Omit<SalaryEntry, 'id'> | null
  incomeEntries: Omit<IncomeEntry, 'id'>[]
  cashExpenses: CashExpense[]
}

export function ImportWizard() {
  const [month, setMonth] = useState(currentMonth)
  const [step, setStep] = useState<WizardStep>(1)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)
  const [data, setData] = useState<WizardData>({
    step1Transactions: [], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [],
  })

  useEffect(() => {
    setLoading(true)
    async function init() {
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
      setLoading(false)
    }
    init()
  }, [month])

  function changeMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setStep(1)
    setData({ step1Transactions: [], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [] })
  }

  const hatzlaada = accounts.find(a => a.name === 'אשראי בהצדעה')
  const oneZero   = accounts.find(a => a.name === 'אשראי One Zero')
  const cash      = accounts.find(a => a.name === 'מזומן')

  if (loading) {
    return <main className="p-4 flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></main>
  }

  return (
    <main className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => changeMonth(-1)} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <h1 className="text-lg font-bold">{formatMonth(month)}</h1>
        <button onClick={() => changeMonth(1)} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>

      {step < 6 && <p className="text-center text-sm text-slate-400 mb-4">שלב {step} מתוך 5</p>}

      {step === 1 && (
        <CreditImportStep stepNumber={1} accountName="אשראי בהצדעה" accountId={hatzlaada?.id ?? ''}
          categories={categories} rules={rules} previousTransactions={previousTransactions}
          initialTransactions={data.step1Transactions}
          onComplete={txs => { setData(d => ({ ...d, step1Transactions: txs })); setStep(2) }}
          onSkip={() => setStep(2)} />
      )}
      {step === 2 && (
        <CreditImportStep stepNumber={2} accountName="אשראי One Zero" accountId={oneZero?.id ?? ''}
          categories={categories} rules={rules} previousTransactions={previousTransactions}
          initialTransactions={data.step2Transactions}
          onComplete={txs => { setData(d => ({ ...d, step2Transactions: txs })); setStep(3) }}
          onSkip={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <SalaryStep month={month} initialSalary={data.salary ?? previousSalary}
          onComplete={sal => { setData(d => ({ ...d, salary: sal })); setStep(4) }}
          onSkip={() => setStep(4)} onBack={() => setStep(2)} />
      )}
      {step === 4 && (
        <IncomeStep month={month} initialEntries={data.incomeEntries}
          onComplete={entries => { setData(d => ({ ...d, incomeEntries: entries })); setStep(5) }}
          onBack={() => setStep(3)} />
      )}
      {step === 5 && (
        <CashStep month={month} categories={categories} initialExpenses={data.cashExpenses}
          onComplete={expenses => { setData(d => ({ ...d, cashExpenses: expenses })); setStep(6) }}
          onBack={() => setStep(4)} />
      )}
      {step === 6 && (
        <SummaryStep month={month} data={data}
          hatzlaadaAccountId={hatzlaada?.id ?? ''} oneZeroAccountId={oneZero?.id ?? ''} cashAccountId={cash?.id ?? ''}
          onDone={() => { setStep(1); setData({ step1Transactions: [], step2Transactions: [], salary: null, incomeEntries: [], cashExpenses: [] }) }} />
      )}
    </main>
  )
}
