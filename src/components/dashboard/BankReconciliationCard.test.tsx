import { render, screen } from '@testing-library/react'
import { BankReconciliationCard } from './BankReconciliationCard'
import type { BankReconciliation } from '@/lib/types'

const matchRec: BankReconciliation = { id: 'r1', month: '2026-06', accountId: 'a3', actualBalance: 12500, expectedBalance: 12500, date: '2026-06-03' }
const gapRec: BankReconciliation = { id: 'r2', month: '2026-06', accountId: 'a3', actualBalance: 12000, expectedBalance: 12500, date: '2026-06-03' }

describe('BankReconciliationCard', () => {
  it('shows no-reconciliation message when null', () => {
    render(<BankReconciliationCard reconciliation={null} />)
    expect(screen.getByText(/לא בוצע אימות/)).toBeInTheDocument()
  })

  it('shows checkmark and "תואם" when balance matches', () => {
    render(<BankReconciliationCard reconciliation={matchRec} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText('תואם')).toBeInTheDocument()
  })

  it('shows X and gap amount when balance does not match', () => {
    render(<BankReconciliationCard reconciliation={gapRec} />)
    expect(screen.getByText('✗')).toBeInTheDocument()
    expect(screen.getByText(/פער: ₪500/)).toBeInTheDocument()
  })

  it('shows actual and expected balances', () => {
    render(<BankReconciliationCard reconciliation={gapRec} />)
    expect(screen.getByText(/12,000/)).toBeInTheDocument()
    expect(screen.getByText(/12,500/)).toBeInTheDocument()
  })
})
