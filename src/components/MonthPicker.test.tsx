import { render, screen, fireEvent } from '@testing-library/react'
import { MonthPicker } from './MonthPicker'

const baseProps = {
  value: '2026-03',
  onChange: jest.fn(),
  onClose: jest.fn(),
}

describe('MonthPicker', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all 12 Hebrew month names', () => {
    render(<MonthPicker {...baseProps} />)
    const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    months.forEach(m => expect(screen.getByText(m)).toBeInTheDocument())
  })

  it('shows the year from the value prop', () => {
    render(<MonthPicker {...baseProps} />)
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('calls onChange with correct YYYY-MM when a month is clicked', () => {
    const onChange = jest.fn()
    render(<MonthPicker {...baseProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('מאי'))
    expect(onChange).toHaveBeenCalledWith('2026-05')
  })

  it('navigates to the previous year when clicking שנה קודמת', () => {
    render(<MonthPicker {...baseProps} />)
    fireEvent.click(screen.getByLabelText('שנה קודמת'))
    expect(screen.getByText('2025')).toBeInTheDocument()
  })

  it('navigates to the next year when clicking שנה הבאה', () => {
    render(<MonthPicker {...baseProps} />)
    fireEvent.click(screen.getByLabelText('שנה הבאה'))
    expect(screen.getByText('2027')).toBeInTheDocument()
  })

  it('calls onChange with the new year after year navigation', () => {
    const onChange = jest.fn()
    render(<MonthPicker {...baseProps} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('שנה קודמת'))
    fireEvent.click(screen.getByText('ינואר'))
    expect(onChange).toHaveBeenCalledWith('2025-01')
  })

  it('calls onClose when clicking the backdrop', () => {
    const onClose = jest.fn()
    render(<MonthPicker {...baseProps} onClose={onClose} />)
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
