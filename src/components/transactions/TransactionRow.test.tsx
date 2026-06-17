import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionRow } from './TransactionRow'
import type { Transaction, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]

const tx: Transaction = {
  id: 'tx1',
  date: '2026-06-15',
  merchantName: 'שופרסל',
  amount: 250,
  currency: 'ILS',
  accountId: 'a1',
  source: 'csv_import',
  isImmediate: false,
  month: '2026-06',
}

describe('TransactionRow', () => {
  it('renders date in DD/MM format', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByText('15/06')).toBeInTheDocument()
  })

  it('renders merchant name', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByText('שופרסל')).toBeInTheDocument()
  })

  it('renders formatted amount with ₪', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByText(/250/)).toBeInTheDocument()
  })

  it('calls onCategoryChange with transactionId and new categoryId', () => {
    const onCategoryChange = jest.fn()
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={onCategoryChange} onDelete={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    expect(onCategoryChange).toHaveBeenCalledWith('tx1', 'c1')
  })

  it('calls onCategoryChange with undefined when blank is selected', () => {
    const onCategoryChange = jest.fn()
    const txWithCat = { ...tx, categoryId: 'c1' }
    render(<TransactionRow transaction={txWithCat} categories={cats} onCategoryChange={onCategoryChange} onDelete={jest.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onCategoryChange).toHaveBeenCalledWith('tx1', undefined)
  })

  it('calls onDelete with transactionId when delete button clicked', () => {
    const onDelete = jest.fn()
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'מחק עסקה' }))
    expect(onDelete).toHaveBeenCalledWith('tx1')
  })

  it('shows the current category in the select', () => {
    const txWithCat = { ...tx, categoryId: 'c1' }
    render(<TransactionRow transaction={txWithCat} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('c1')
  })
})
