import { render, screen, fireEvent } from '@testing-library/react'
import { AddInvestmentTypeForm } from './AddInvestmentTypeForm'

describe('AddInvestmentTypeForm', () => {
  it('renders name and currency inputs', () => {
    render(<AddInvestmentTypeForm onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('שם')).toBeInTheDocument()
    expect(screen.getByLabelText('מטבע')).toBeInTheDocument()
  })

  it('defaults currency to USD', () => {
    render(<AddInvestmentTypeForm onSubmit={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByLabelText('מטבע')).toHaveValue('USD')
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = jest.fn()
    render(<AddInvestmentTypeForm onSubmit={jest.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit with name and currency when submitted', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentTypeForm onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('שם'), { target: { value: 'MSTY' } })
    fireEvent.change(screen.getByLabelText('מטבע'), { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'MSTY', currency: 'USD' })
  })

  it('does not call onSubmit when name is empty', () => {
    const onSubmit = jest.fn()
    render(<AddInvestmentTypeForm onSubmit={onSubmit} onCancel={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
