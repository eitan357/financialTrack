import { render, screen } from '@testing-library/react'
import { SummaryCard } from './SummaryCard'

describe('SummaryCard', () => {
  it('renders the label', () => {
    render(<SummaryCard label="הכנסות" amount={10000} />)
    expect(screen.getByText('הכנסות')).toBeInTheDocument()
  })

  it('formats amount with locale separators', () => {
    render(<SummaryCard label="הכנסות" amount={10000} />)
    expect(screen.getByTestId('amount')).toHaveTextContent('10,000')
  })

  it('shows ₪ prefix by default', () => {
    render(<SummaryCard label="הכנסות" amount={500} />)
    expect(screen.getByTestId('amount').textContent).toContain('₪')
  })

  it('shows negative amount in red when amount is negative', () => {
    render(<SummaryCard label="חיסכון" amount={-500} />)
    expect(screen.getByTestId('amount').className).toContain('text-red-400')
  })

  it('accepts custom color class', () => {
    render(<SummaryCard label="הכנסות" amount={1000} color="text-green-400" />)
    expect(screen.getByTestId('amount').className).toContain('text-green-400')
  })
})
