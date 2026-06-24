import { render, screen, fireEvent } from '@testing-library/react'
import { AddDividendForm } from './AddDividendForm'
import type { InvestmentType, Account } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' },
]

const bankAccounts: Account[] = [
  { id: 'bank1', name: 'לאומי', type: 'bank', color: '#000', isActive: true },
]

describe('AddDividendForm', () => {
  it('renders all required fields', () => {
    render(<AddDividendForm types={types} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
    expect(screen.getByLabelText('תאריך')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn()
    render(<AddDividendForm types={types} onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit with correct data including ilsEquivalent', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '45.5' } })
    fireEvent.change(screen.getByLabelText('שווי ב-₪'), { target: { value: '165' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      investmentTypeId: 't1',
      amount: 45.5,
      currency: 'USD',
      ilsEquivalent: 165,
      date: '2026-06-10',
      month: '2026-06',
    }))
  })

  it('calls onSubmit without ilsEquivalent when ILS field is empty', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '45.5' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    const call = onSubmit.mock.calls[0][0]
    expect(call.ilsEquivalent).toBeUndefined()
  })

  it('does not call onSubmit when no type or amount', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows "נשאר בתיק" and "הועבר לבנק" toggle buttons', () => {
    render(<AddDividendForm types={types} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'נשאר בתיק' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הועבר לבנק' })).toBeInTheDocument()
  })

  it('does not show bank selector by default (staysInPortfolio=true)', () => {
    render(<AddDividendForm types={types} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.queryByLabelText('חשבון יעד')).not.toBeInTheDocument()
  })

  it('shows bank destination selector when "הועבר לבנק" is clicked', () => {
    render(<AddDividendForm types={types} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'הועבר לבנק' }))
    expect(screen.getByLabelText('חשבון יעד')).toBeInTheDocument()
  })

  it('submits with staysInPortfolio=true by default', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ staysInPortfolio: true }))
  })

  it('submits with destinationAccountId when bank transfer selected', () => {
    const onSubmit = jest.fn()
    render(<AddDividendForm types={types} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הועבר לבנק' }))
    fireEvent.change(screen.getByLabelText('חשבון יעד'), { target: { value: 'bank1' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      staysInPortfolio: false,
      destinationAccountId: 'bank1',
    }))
  })
})
