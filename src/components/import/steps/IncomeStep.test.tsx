import { render, screen, fireEvent } from '@testing-library/react'
import { IncomeStep } from './IncomeStep'

const defaultProps = { month: '2026-06', initialEntries: [], onComplete: jest.fn(), onBack: jest.fn() }

describe('IncomeStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows empty state message when no entries', () => {
    render(<IncomeStep {...defaultProps} />)
    expect(screen.getByText(/אין הכנסות נוספות/)).toBeInTheDocument()
  })

  it('renders Add button', () => {
    render(<IncomeStep {...defaultProps} />)
    expect(screen.getByText('הוסף הכנסה')).toBeInTheDocument()
  })

  it('adds a row when Add button clicked', () => {
    render(<IncomeStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הכנסה'))
    expect(screen.getByLabelText('שם מקור הכנסה 1')).toBeInTheDocument()
  })

  it('removes a row when delete button clicked', () => {
    render(<IncomeStep {...defaultProps} />)
    fireEvent.click(screen.getByText('הוסף הכנסה'))
    expect(screen.getByLabelText('שם מקור הכנסה 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'מחק הכנסה 1' }))
    expect(screen.queryByLabelText('שם מקור הכנסה 1')).not.toBeInTheDocument()
  })

  it('calls onComplete with entries when Next clicked', () => {
    const onComplete = jest.fn()
    render(<IncomeStep {...defaultProps} onComplete={onComplete} />)
    fireEvent.click(screen.getByText('הוסף הכנסה'))
    fireEvent.change(screen.getByLabelText('שם מקור הכנסה 1'), { target: { value: 'מילואים' } })
    fireEvent.change(screen.getByLabelText('סכום הכנסה 1'), { target: { value: '3000' } })
    fireEvent.click(screen.getByText('הבא →'))
    expect(onComplete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ sourceName: 'מילואים', amount: 3000 })
    ]))
  })

  it('calls onBack when Back clicked', () => {
    const onBack = jest.fn()
    render(<IncomeStep {...defaultProps} onBack={onBack} />)
    fireEvent.click(screen.getByText('← חזור'))
    expect(onBack).toHaveBeenCalled()
  })
})
