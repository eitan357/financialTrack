import { render, screen, fireEvent } from '@testing-library/react'
import { AddInvestmentEntryForm } from './AddInvestmentEntryForm'
import type { InvestmentType } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS' },
  { id: 't2', name: 'MSTY', currency: 'USD' },
]

describe('AddInvestmentEntryForm', () => {
  it('renders type select with all investment types', () => {
    render(<AddInvestmentEntryForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('הראל')).toBeInTheDocument()
    expect(screen.getByText('MSTY')).toBeInTheDocument()
  })

  it('renders amount input and date input', () => {
    render(<AddInvestmentEntryForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
    expect(screen.getByLabelText('תאריך')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn()
    render(<AddInvestmentEntryForm types={types} onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit with correct data when form submitted', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentEntryForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      investmentTypeId: 't1',
      amount: 500,
      currency: 'ILS',
      date: '2026-06-10',
      month: '2026-06',
    }))
  })

  it('does not call onSubmit when no type is selected', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentEntryForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
