import { render, screen } from '@testing-library/react'
import { MonthSummaryRow } from './MonthSummaryRow'
import type { MonthlyExpenseSummary } from '@/lib/reports/compute'

const summary: MonthlyExpenseSummary = {
  month: '2026-06',
  totalExpenses: 3500,
  byCategory: [
    { categoryId: 'c1', name: 'אוכל', color: '#ef4444', total: 2000 },
    { categoryId: 'c2', name: 'תחבורה', color: '#3b82f6', total: 1000 },
    { categoryId: 'c3', name: 'בידור', color: '#a855f7', total: 500 },
    { categoryId: 'c4', name: 'בריאות', color: '#22c55e', total: 100 },
  ],
}

describe('MonthSummaryRow', () => {
  it('renders the Hebrew month name', () => {
    render(<MonthSummaryRow summary={summary} />)
    expect(screen.getByText(/יוני/)).toBeInTheDocument()
  })

  it('renders total expenses formatted', () => {
    render(<MonthSummaryRow summary={summary} />)
    expect(screen.getByText(/3,500/)).toBeInTheDocument()
  })

  it('renders top 3 categories only', () => {
    render(<MonthSummaryRow summary={summary} />)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText('תחבורה')).toBeInTheDocument()
    expect(screen.getByText('בידור')).toBeInTheDocument()
    expect(screen.queryByText('בריאות')).not.toBeInTheDocument()
  })

  it('renders empty categories gracefully', () => {
    const empty = { ...summary, byCategory: [] }
    render(<MonthSummaryRow summary={empty} />)
    expect(screen.getByText(/יוני/)).toBeInTheDocument()
  })
})
