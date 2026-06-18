import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreditFlow } from './CreditFlow'
import type { Category, CategorizationRule, Transaction } from '@/lib/types'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

const categories: Category[] = [
  { id: 'cat1', name: 'מזון', color: '#f00', isActive: true },
]
const rules: CategorizationRule[] = []
const previousTxs: Transaction[] = []

describe('CreditFlow', () => {
  it('renders upload area and skip button', () => {
    render(
      <CreditFlow
        month="2026-06"
        accountId="acc1"
        accountName="כרטיס ויזה"
        categories={categories}
        rules={rules}
        previousTransactions={previousTxs}
        existingTransactions={[]}
        onDone={jest.fn()}
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/כרטיס ויזה/)).toBeInTheDocument()
    expect(screen.getByText('דלג')).toBeInTheDocument()
  })
})
