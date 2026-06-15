import { render, screen, fireEvent } from '@testing-library/react'
import { CashStep } from './CashStep'

const cats = [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true }]
const defaultProps = { month: '2026-06', categories: cats, initialExpenses: [], onComplete: jest.fn(), onBack: jest.fn() }

describe('CashStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders empty state', () => {
    render(<CashStep {...defaultProps} />)
    expect(screen.getByText(/אין הוצאות מזומן/)).toBeInTheDocument()
  })

  it('adds an expense row when Add button clicked', () => {
    render(<CashStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הוצאה'))
    expect(screen.getByLabelText('תיאור הוצאה 1')).toBeInTheDocument()
  })

  it('removes an expense when delete clicked', () => {
    render(<CashStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הוצאה'))
    fireEvent.click(screen.getByRole('button', { name: 'מחק הוצאה 1' }))
    expect(screen.queryByLabelText('תיאור הוצאה 1')).not.toBeInTheDocument()
  })

  it('calls onComplete with expenses when Next clicked', () => {
    const onComplete = jest.fn()
    render(<CashStep {...defaultProps} onComplete={onComplete} />)
    fireEvent.click(screen.getByText('הוסף הוצאה'))
    fireEvent.change(screen.getByLabelText('תיאור הוצאה 1'), { target: { value: 'ירקות' } })
    fireEvent.change(screen.getByLabelText('סכום הוצאה 1'), { target: { value: '50' } })
    fireEvent.click(screen.getByText('סיכום →'))
    expect(onComplete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ description: 'ירקות', amount: 50 })
    ]))
  })
})
