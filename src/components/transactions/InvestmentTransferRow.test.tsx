import { render, screen } from '@testing-library/react'
import { InvestmentDepositRow, DividendPayoutRow } from './InvestmentTransferRow'
import type { InvestmentEntry, Dividend } from '@/lib/types'

const ilsEntry: InvestmentEntry = {
  id: 'e1', date: '2026-06-15', month: '2026-06',
  investmentTypeId: 't1', amount: 1000, currency: 'ILS', sourceAccountId: 'b1',
}
const usdEntry: InvestmentEntry = {
  id: 'e2', date: '2026-06-15', month: '2026-06',
  investmentTypeId: 't2', amount: 100, currency: 'USD', sourceAccountId: 'b1', ilsEquivalent: 3700,
}
const dividend: Dividend = {
  id: 'd1', date: '2026-06-20', month: '2026-06',
  investmentTypeId: 't1', amount: 50, currency: 'USD', ilsEquivalent: 185,
  staysInPortfolio: false, destinationAccountId: 'b1',
}

describe('InvestmentDepositRow', () => {
  it('renders type name and date', () => {
    render(<InvestmentDepositRow entry={ilsEntry} typeName="הראל" bankName="בנק לאומי" />)
    expect(screen.getByText(/הראל/)).toBeInTheDocument()
    expect(screen.getByText('15/06')).toBeInTheDocument()
  })

  it('shows ILS amount for ILS investments', () => {
    render(<InvestmentDepositRow entry={ilsEntry} typeName="הראל" bankName={undefined} />)
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
  })

  it('shows ilsEquivalent for non-ILS investments', () => {
    render(<InvestmentDepositRow entry={usdEntry} typeName="MSTY" bankName="בנק לאומי" />)
    expect(screen.getByText(/3,700/)).toBeInTheDocument()
  })
})

describe('DividendPayoutRow', () => {
  it('renders type name, date, and ILS amount', () => {
    render(<DividendPayoutRow dividend={dividend} typeName="MSTY" />)
    expect(screen.getByText(/MSTY/)).toBeInTheDocument()
    expect(screen.getByText('20/06')).toBeInTheDocument()
    expect(screen.getByText(/185/)).toBeInTheDocument()
  })
})
