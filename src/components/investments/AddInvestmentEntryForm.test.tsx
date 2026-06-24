import { render, screen, fireEvent } from '@testing-library/react'
import { AddInvestmentEntryForm } from './AddInvestmentEntryForm'
import type { InvestmentType, Account } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS', portfolioAccountId: 'p1' },
  { id: 't2', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' },
]

const portfolios: Account[] = [
  { id: 'p1', name: 'תיק ראשי', type: 'investment', color: '#6366f1', isActive: true },
]

const typesWithPortfolio = [
  { id: 't1', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' },
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

  it('groups types by portfolio using optgroup when portfolios provided', () => {
    render(<AddInvestmentEntryForm types={typesWithPortfolio} portfolios={portfolios} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('group', { name: 'תיק ראשי' })).toBeInTheDocument()
  })

  it('shows message when no types available', () => {
    render(<AddInvestmentEntryForm types={[]} portfolios={[]} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText('יש להוסיף השקעות בהגדרות')).toBeInTheDocument()
  })

  it('hides submit button when no types available', () => {
    render(<AddInvestmentEntryForm types={[]} portfolios={[]} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'הוסף' })).not.toBeInTheDocument()
  })

  const bankAccounts: Account[] = [
    { id: 'b1', name: 'בנק לאומי', type: 'bank', color: '#6366f1', isActive: true },
    { id: 'b2', name: 'One Zero', type: 'bank', color: '#10b981', isActive: true },
  ]

  it('shows source bank selector when bankAccounts provided', () => {
    render(<AddInvestmentEntryForm types={types} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('חשבון מקור')).toBeInTheDocument()
  })

  it('shows validation error when source bank not selected and bankAccounts provided', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentEntryForm types={types} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('יש לבחור חשבון מקור')).toBeInTheDocument()
  })

  it('includes sourceAccountId in submission when bank selected', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentEntryForm types={types} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'b1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ sourceAccountId: 'b1' }))
  })

  it('shows ILS equivalent field when non-ILS type selected', () => {
    const usdTypes: InvestmentType[] = [{ id: 'u1', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' }]
    render(<AddInvestmentEntryForm types={usdTypes} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'u1' } })
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
  })

  it('does not show ILS equivalent field when ILS type selected', () => {
    render(<AddInvestmentEntryForm types={types} bankAccounts={bankAccounts} onSubmit={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 't1' } })
    expect(screen.queryByLabelText('שווי ב-₪')).not.toBeInTheDocument()
  })

  it('includes ilsEquivalent in submission when non-ILS type and value entered', () => {
    const onSubmit = jest.fn()
    const usdTypes: InvestmentType[] = [{ id: 'u1', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' }]
    render(<AddInvestmentEntryForm types={usdTypes} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'u1' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'b1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('שווי ב-₪'), { target: { value: '3700' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ilsEquivalent: 3700 }))
  })

  it('omits ilsEquivalent from submission when ILS equivalent field is left empty', () => {
    const onSubmit = jest.fn()
    const usdTypes: InvestmentType[] = [{ id: 'u1', name: 'MSTY', currency: 'USD', portfolioAccountId: 'p1' }]
    render(<AddInvestmentEntryForm types={usdTypes} bankAccounts={bankAccounts} onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'u1' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'b1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('תאריך'), { target: { value: '2026-06-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    const call = onSubmit.mock.calls[0][0]
    expect(call.ilsEquivalent).toBeUndefined()
  })
})
