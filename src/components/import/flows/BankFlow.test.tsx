import { render, screen } from '@testing-library/react'
import { BankFlow } from './BankFlow'

jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

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
        onBack={jest.fn()}
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
        onBack={jest.fn()}
      />
    )
    expect(screen.getByText(/PDF/)).toBeInTheDocument()
  })
})
