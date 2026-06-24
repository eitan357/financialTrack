import { render, screen } from '@testing-library/react'
import { BankFlow, suggestSkips } from './BankFlow'
import type { ImportedTransaction, InvestmentEntry, Dividend } from '@/lib/types'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}))

const baseExpenseRow: ImportedTransaction = {
  date: '2026-06-10',
  merchantName: 'העברה',
  bankCategory: '',
  amount: 5500,
  currency: 'ILS',
  isImmediate: true,
  notes: '',
  direction: 'expense',
  categoryId: null,
  categorizationSource: null,
}

const ilsDeposit: InvestmentEntry = {
  id: 'e1', date: '2026-06-10', month: '2026-06',
  investmentTypeId: 't1', amount: 5500, currency: 'ILS', sourceAccountId: 'b1',
}
const usdDeposit: InvestmentEntry = {
  id: 'e2', date: '2026-06-10', month: '2026-06',
  investmentTypeId: 't2', amount: 100, currency: 'USD', sourceAccountId: 'b1', ilsEquivalent: 3700,
}
const dividendPayout: Dividend = {
  id: 'd1', date: '2026-06-15', month: '2026-06',
  investmentTypeId: 't1', amount: 50, currency: 'USD', ilsEquivalent: 185,
  staysInPortfolio: false, destinationAccountId: 'b1',
}

describe('suggestSkips — investment transfers', () => {
  it('skips expense row matching ILS investment deposit amount', () => {
    const result = suggestSkips([baseExpenseRow], [], [], [ilsDeposit], [])
    expect(result[0].skip).toBe(true)
    expect(result[0].skipReason).toBe('investment-transfer')
  })

  it('does not skip expense row with non-matching amount', () => {
    const result = suggestSkips([{ ...baseExpenseRow, amount: 1000 }], [], [], [ilsDeposit], [])
    expect(result[0].skip).toBe(false)
  })

  it('skips expense matching ilsEquivalent of non-ILS deposit', () => {
    const result = suggestSkips([{ ...baseExpenseRow, amount: 3700 }], [], [], [usdDeposit], [])
    expect(result[0].skip).toBe(true)
    expect(result[0].skipReason).toBe('investment-transfer')
  })

  it('skips income row matching dividend payout ilsEquivalent', () => {
    const incomeRow: ImportedTransaction = { ...baseExpenseRow, amount: 185, direction: 'income' }
    const result = suggestSkips([incomeRow], [], [], [], [dividendPayout])
    expect(result[0].skip).toBe(true)
    expect(result[0].skipReason).toBe('investment-transfer')
  })
})

describe('BankFlow', () => {
  it('renders account name and upload area for one-zero', () => {
    render(
      <BankFlow
        month="2026-06"
        accountId="bank1"
        accountName="One Zero"
        bankType="one-zero"
        categories={[]}
        existingTransactions={[]}
        onDone={jest.fn()}
      />
    )
    expect(screen.getByText(/One Zero/)).toBeInTheDocument()
    expect(screen.getByText(/XLS/)).toBeInTheDocument()
  })

  it('renders Leumi PDF upload label for leumi bankType', () => {
    render(
      <BankFlow
        month="2026-06"
        accountId="bank2"
        accountName="לאומי"
        bankType="leumi"
        categories={[]}
        existingTransactions={[]}
        onDone={jest.fn()}
      />
    )
    expect(screen.getByText(/PDF/)).toBeInTheDocument()
  })
})
