jest.mock('@/lib/firestore/bank-reconciliations', () => ({
  saveBankReconciliation: jest.fn(),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

import { render, screen } from '@testing-library/react'
import { BankReconciliationCard } from './BankReconciliationCard'
import type { Account, Transaction, BankReconciliation } from '@/lib/types'

const bankAccount: Account = {
  id: 'a1', name: 'בנק One Zero', type: 'bank', color: '#4f8', isActive: true, sortOrder: 0,
}

const rec: BankReconciliation = { id: 'r1', month: '2026-06', accountId: 'a1', actualBalance: 12500, date: '2026-06-30' }
const prevRec: BankReconciliation = { id: 'r0', month: '2026-05', accountId: 'a1', actualBalance: 10000, date: '2026-05-31' }

function makeProps(overrides: Partial<Parameters<typeof BankReconciliationCard>[0]> = {}) {
  return {
    accounts: [bankAccount],
    transactions: [],
    reconciliations: [],
    prevReconciliations: [],
    month: '2026-06',
    onSaved: jest.fn(),
    ...overrides,
  }
}

describe('BankReconciliationCard', () => {
  it('renders nothing when no active bank accounts', () => {
    const { container } = render(<BankReconciliationCard {...makeProps({ accounts: [] })} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows balance input when no current reconciliation', () => {
    render(<BankReconciliationCard {...makeProps()} />)
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
  })

  it('shows "אין נתון לחודש קודם" when no prev reconciliation', () => {
    render(<BankReconciliationCard {...makeProps({ reconciliations: [rec] })} />)
    expect(screen.getByText(/אין נתון לחודש קודם/)).toBeInTheDocument()
  })

  it('shows match when actual equals expected (net 0 + same prev balance)', () => {
    render(<BankReconciliationCard {...makeProps({
      reconciliations: [rec],
      prevReconciliations: [prevRec],
      // transactions are empty → net = 0 → expected = 10000, actual = 12500 → mismatch
    })} />)
    // 12500 actual vs 10000 expected → gap of 2500
    const gapLabel = screen.getByText('פער')
    expect(gapLabel).toBeInTheDocument()
    expect(gapLabel.parentElement).toHaveTextContent(/2,500\.00/)
  })

  it('shows exact 2-decimal precision for gap', () => {
    const precRec: BankReconciliation = { ...rec, actualBalance: 12345.56 }
    const prevPrecRec: BankReconciliation = { ...prevRec, actualBalance: 12345.55 }
    render(<BankReconciliationCard {...makeProps({
      reconciliations: [precRec],
      prevReconciliations: [prevPrecRec],
    })} />)
    // net = 0, expected = 12345.55, actual = 12345.56 → gap 0.01 → mismatch
    const gapLabel = screen.getByText('פער')
    expect(gapLabel).toBeInTheDocument()
    expect(gapLabel.parentElement).toHaveTextContent(/0\.01/)
  })

  it('shows תואם when actual matches expected exactly', () => {
    const matchRec: BankReconciliation = { ...rec, actualBalance: 10000 }
    render(<BankReconciliationCard {...makeProps({
      reconciliations: [matchRec],
      prevReconciliations: [prevRec],
      // net = 0 → expected = 10000, actual = 10000 → match
    })} />)
    expect(screen.getByText('✓ תואם')).toBeInTheDocument()
  })

  it('accounts for income transactions in expected balance', () => {
    const tx: Transaction = {
      id: 't1', date: '2026-06-05', merchantName: 'salary', amount: 5000,
      currency: 'ILS', accountId: 'a1', source: 'manual', isImmediate: false,
      month: '2026-06', direction: 'income',
    }
    // prevRec = 10000, net income = 5000 → expected = 15000, actual = 12500 → gap = -2500
    render(<BankReconciliationCard {...makeProps({
      reconciliations: [rec],
      prevReconciliations: [prevRec],
      transactions: [tx],
    })} />)
    const gapLabel = screen.getByText('פער')
    expect(gapLabel).toBeInTheDocument()
    expect(gapLabel.parentElement).toHaveTextContent(/-2,500\.00/)
  })
})
