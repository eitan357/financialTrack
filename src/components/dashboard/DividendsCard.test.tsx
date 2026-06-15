import { render, screen } from '@testing-library/react'
import { DividendsCard } from './DividendsCard'
import type { Dividend, InvestmentType } from '@/lib/types'

const types: InvestmentType[] = [{ id: 't1', name: 'MSTY', currency: 'USD' }]
const divs: Dividend[] = [
  { id: 'd1', month: '2026-06', investmentTypeId: 't1', amount: 150, currency: 'USD', ilsEquivalent: 555, date: '2026-06-15' },
]

describe('DividendsCard', () => {
  it('shows empty state when no dividends', () => {
    render(<DividendsCard dividends={[]} investmentTypes={types} />)
    expect(screen.getByText(/אין דיבידנדים/)).toBeInTheDocument()
  })

  it('shows dividend amount with currency', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByText(/150/)).toBeInTheDocument()
    expect(screen.getByText(/USD/)).toBeInTheDocument()
  })

  it('shows ILS equivalent when present', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByText(/\(₪555\)/)).toBeInTheDocument()
  })

  it('shows total ILS amount in header', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByTestId('dividends-total')).toHaveTextContent('555')
  })

  it('shows investment type name', () => {
    render(<DividendsCard dividends={divs} investmentTypes={types} />)
    expect(screen.getByText('MSTY')).toBeInTheDocument()
  })
})
