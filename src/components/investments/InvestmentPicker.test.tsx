// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { InvestmentPicker } from './InvestmentPicker'
import type { Account, InvestmentType } from '@/lib/types'

const portfolios: Account[] = [
  { id: 'p1', name: 'פסגות', type: 'investment', color: '#7c3aed', isActive: true },
  { id: 'p2', name: 'IBI', type: 'investment', color: '#2563eb', isActive: true },
]
const types: InvestmentType[] = [
  { id: 't1', name: 'קרן כספית', currency: 'ILS', portfolioAccountId: 'p1' },
  { id: 't2', name: 'אג"ח', currency: 'ILS', portfolioAccountId: 'p1' },
  { id: 't3', name: 'מניות', currency: 'ILS', portfolioAccountId: 'p2' },
]

test('shows placeholder when no value', () => {
  render(<InvestmentPicker portfolios={portfolios} types={types} value={null} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: /בחר/ })).toBeInTheDocument()
})

test('opens dropdown and shows portfolios and types', () => {
  render(<InvestmentPicker portfolios={portfolios} types={types} value={null} onChange={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /בחר/ }))
  expect(screen.getByText('פסגות')).toBeInTheDocument()
  expect(screen.getByText('קרן כספית')).toBeInTheDocument()
  expect(screen.getByText('IBI')).toBeInTheDocument()
})

test('calls onChange with portfolio selection', () => {
  const onChange = vi.fn()
  render(<InvestmentPicker portfolios={portfolios} types={types} value={null} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: /בחר/ }))
  fireEvent.click(screen.getByText('IBI'))
  expect(onChange).toHaveBeenCalledWith({ portfolioAccountId: 'p2' })
})

test('calls onChange with type selection', () => {
  const onChange = vi.fn()
  render(<InvestmentPicker portfolios={portfolios} types={types} value={null} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: /בחר/ }))
  fireEvent.click(screen.getByText('קרן כספית'))
  expect(onChange).toHaveBeenCalledWith({ portfolioAccountId: 'p1', investmentTypeId: 't1' })
})

test('filters options by search text', () => {
  render(<InvestmentPicker portfolios={portfolios} types={types} value={null} onChange={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /בחר/ }))
  fireEvent.change(screen.getByPlaceholderText('חיפוש...'), { target: { value: 'קרן' } })
  expect(screen.getByText('קרן כספית')).toBeInTheDocument()
  expect(screen.queryByText('אג"ח')).not.toBeInTheDocument()
})

test('shows selected value label', () => {
  render(
    <InvestmentPicker
      portfolios={portfolios}
      types={types}
      value={{ portfolioAccountId: 'p1', investmentTypeId: 't1' }}
      onChange={() => {}}
    />
  )
  expect(screen.getByText(/קרן כספית/)).toBeInTheDocument()
})

test('clears selection on X click', () => {
  const onChange = vi.fn()
  render(
    <InvestmentPicker
      portfolios={portfolios}
      types={types}
      value={{ portfolioAccountId: 'p1' }}
      onChange={onChange}
    />
  )
  fireEvent.click(screen.getByTitle('נקה'))
  expect(onChange).toHaveBeenCalledWith(null)
})
