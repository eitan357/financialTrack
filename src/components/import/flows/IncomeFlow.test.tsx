import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IncomeFlow } from './IncomeFlow'
import type { Account, Transaction } from '@/lib/types'
import { addTransactions, deleteTransaction } from '@/lib/firestore/transactions'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const bankAccounts: Account[] = [
  { id: 'bank1', name: 'לאומי', type: 'bank', color: '#00f', isActive: true },
]

const existingIncomeTx: Transaction = {
  id: 'tx1', date: '2026-06-10', merchantName: 'בונוס שנתי',
  amount: 3000, currency: 'ILS', accountId: 'bank1',
  source: 'manual', isImmediate: true, month: '2026-06', direction: 'income',
}

describe('IncomeFlow', () => {
  it('shows existing income entry', () => {
    render(
      <IncomeFlow
        month="2026-06"
        existingTransactions={[existingIncomeTx]}
        bankAccounts={bankAccounts}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText('בונוס שנתי')).toBeInTheDocument()
    expect(screen.getByText(/3,000/)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(
      <IncomeFlow
        month="2026-06"
        existingTransactions={[]}
        bankAccounts={bankAccounts}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/אין הכנסות/i)).toBeInTheDocument()
  })
})
