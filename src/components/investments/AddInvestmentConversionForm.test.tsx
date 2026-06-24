import { render, screen, fireEvent } from '@testing-library/react'
import { AddInvestmentConversionForm } from './AddInvestmentConversionForm'
import type { InvestmentType, Account } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS', portfolioAccountId: 'p1' },
  { id: 't2', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' },
]

const bankAccounts: Account[] = [
  { id: 'b1', name: 'One Zero', type: 'bank', color: '#10b981', isActive: true },
]

describe('AddInvestmentConversionForm', () => {
  it('renders type select with all investment types', () => {
    render(<AddInvestmentConversionForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('הראל')).toBeInTheDocument()
    expect(screen.getByText('MSTY')).toBeInTheDocument()
  })

  it('renders ILS received input and date input', () => {
    render(<AddInvestmentConversionForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('התקבל ב-₪')).toBeInTheDocument()
    expect(screen.getByLabelText('תאריך')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn()
    render(<AddInvestmentConversionForm types={types} onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not call onSubmit when no type selected', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not call onSubmit when ilsReceived is zero', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with correct data', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      investmentTypeId: 't1',
      ilsReceived: 5000,
      date: '2026-06-15',
      month: '2026-06',
    }))
  })

  it('shows foreign amount field with currency label when non-ILS type selected', () => {
    render(<AddInvestmentConversionForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't2' } })
    expect(screen.getByLabelText('הופחת (USD)')).toBeInTheDocument()
  })

  it('does not show foreign amount field when ILS type selected', () => {
    render(<AddInvestmentConversionForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    expect(screen.queryByLabelText(/הופחת/)).not.toBeInTheDocument()
  })

  it('includes foreignAmountReduced in submission when entered', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't2' } })
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('הופחת (USD)'), { target: { value: '130' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ foreignAmountReduced: 130 }))
  })

  it('omits foreignAmountReduced when field left empty', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't2' } })
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    const call = onSubmit.mock.calls[0][0]
    expect(call.foreignAmountReduced).toBeUndefined()
  })

  it('shows destination bank selector when bankAccounts provided', () => {
    render(<AddInvestmentConversionForm types={types} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('חשבון שקיבל')).toBeInTheDocument()
  })

  it('includes destinationAccountId in submission when bank selected', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'b1' } })
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ destinationAccountId: 'b1' }))
  })

  it('omits destinationAccountId when no bank selected', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentConversionForm types={types} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('התקבל ב-₪'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    const call = onSubmit.mock.calls[0][0]
    expect(call.destinationAccountId).toBeUndefined()
  })
})
