import { render, screen, fireEvent } from '@testing-library/react'
import { CurrencyPicker } from './CurrencyPicker'

describe('CurrencyPicker', () => {
  it('displays the selected currency symbol and code', () => {
    render(<CurrencyPicker value="USD" onChange={() => {}} />)
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('opens a searchable list on click', () => {
    render(<CurrencyPicker value="ILS" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByPlaceholderText('חפש מטבע...')).toBeInTheDocument()
  })

  it('filters currencies by search term', () => {
    render(<CurrencyPicker value="ILS" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש מטבע...'), { target: { value: 'euro' } })
    expect(screen.getByText('Euro')).toBeInTheDocument()
  })

  it('calls onChange when a currency is selected', () => {
    const onChange = jest.fn()
    render(<CurrencyPicker value="ILS" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש מטבע...'), { target: { value: 'EUR' } })
    fireEvent.click(screen.getByText('Euro'))
    expect(onChange).toHaveBeenCalledWith('EUR')
  })

  it('shows "לא נמצא מטבע" when no results', () => {
    render(<CurrencyPicker value="ILS" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש מטבע...'), { target: { value: 'xyzxyz' } })
    expect(screen.getByText('לא נמצא מטבע')).toBeInTheDocument()
  })
})
