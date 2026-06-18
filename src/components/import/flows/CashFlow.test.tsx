import { render, screen } from '@testing-library/react'
import { CashFlow } from './CashFlow'
import type { Category, Transaction } from '@/lib/types'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const categories: Category[] = [
  { id: 'cat1', name: 'מזון', color: '#f00', isActive: true },
]

const existingCashTx: Transaction = {
  id: 'tx1', date: '2026-06-05', merchantName: 'שוק הכרמל',
  amount: 120, currency: 'ILS', accountId: 'cash1',
  source: 'manual', isImmediate: true, month: '2026-06',
}

describe('CashFlow', () => {
  it('shows existing cash transaction', () => {
    render(
      <CashFlow
        month="2026-06"
        cashAccountId="cash1"
        categories={categories}
        existingTransactions={[existingCashTx]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText('שוק הכרמל')).toBeInTheDocument()
    expect(screen.getByText(/120/)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(
      <CashFlow
        month="2026-06"
        cashAccountId="cash1"
        categories={categories}
        existingTransactions={[]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/אין הוצאות מזומן/i)).toBeInTheDocument()
  })
})
