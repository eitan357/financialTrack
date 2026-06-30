import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('TransactionRow — row view', () => {
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

  it('clicking the row switches to detail view', () => {
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByText('שופרסל'))
    expect(screen.getByText('ערוך')).toBeInTheDocument()
    expect(screen.getByText('סגור')).toBeInTheDocument()
  })
})

describe('TransactionRow — edit form', () => {
  function renderInEditMode() {
    const onUpdate = jest.fn().mockResolvedValue(undefined)
    const onDelete = jest.fn()
    render(<TransactionRow transaction={tx} categories={cats} onCategoryChange={jest.fn()} onUpdate={onUpdate} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('שופרסל'))
    fireEvent.click(screen.getByText('ערוך'))
    return { onUpdate, onDelete }
  }

  it('edit form has labeled inputs', () => {
    renderInEditMode()
    expect(screen.getByText('תאריך')).toBeInTheDocument()
    expect(screen.getByText('שם עסק')).toBeInTheDocument()
    expect(screen.getByText('סכום (₪)')).toBeInTheDocument()
    expect(screen.getByText('קטגוריה')).toBeInTheDocument()
  })

  it('calls onUpdate with updated values on save', async () => {
    const { onUpdate } = renderInEditMode()
    const nameInput = screen.getByPlaceholderText('שם עסק')
    fireEvent.change(nameInput, { target: { value: 'רמי לוי' } })
    fireEvent.click(screen.getByText('שמור'))
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('tx1', expect.objectContaining({ merchantName: 'רמי לוי' }))
    })
  })

  it('calls onDelete when delete button clicked in edit mode', () => {
    const { onDelete } = renderInEditMode()
    fireEvent.click(screen.getByText('מחק'))
    expect(onDelete).toHaveBeenCalledWith('tx1')
  })

  it('shows current category in select', () => {
    const txWithCat = { ...tx, categoryId: 'c1' }
    render(<TransactionRow transaction={txWithCat} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByText('שופרסל'))
    fireEvent.click(screen.getByText('ערוך'))
    expect(screen.getByRole('combobox')).toHaveValue('c1')
  })
})

describe('TransactionRow — investment direction', () => {
  const investmentTx: Transaction = {
    id: 'tx-inv',
    date: '2026-06-15',
    merchantName: 'העברה לתיק',
    amount: 5000,
    currency: 'ILS',
    accountId: 'a1',
    source: 'xlsx_import',
    isImmediate: false,
    month: '2026-06',
    direction: 'investment',
    portfolioAccountId: 'p1',
  }

  it('renders amount in purple', () => {
    render(<TransactionRow transaction={investmentTx} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    const amount = screen.getByText(/5,000/)
    expect(amount).toHaveClass('text-purple-400')
  })

  it('shows "השקעה" label in detail view', () => {
    render(<TransactionRow transaction={investmentTx} categories={cats} onCategoryChange={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByText('העברה לתיק'))
    expect(screen.getByText('השקעה')).toBeInTheDocument()
  })
})
