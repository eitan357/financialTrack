const mockGetTransactions = jest.fn()
const mockGetCategories = jest.fn()
const mockGetRules = jest.fn()
const mockUpdateTransaction = jest.fn()
const mockDeleteTransaction = jest.fn()
const mockAddRule = jest.fn()
const mockDeleteRule = jest.fn()

jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: (...a: unknown[]) => mockGetTransactions(...a),
  updateTransaction: (...a: unknown[]) => mockUpdateTransaction(...a),
  deleteTransaction: (...a: unknown[]) => mockDeleteTransaction(...a),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: (...a: unknown[]) => mockGetCategories(...a),
}))
jest.mock('@/lib/firestore/categorization-rules', () => ({
  getRules: (...a: unknown[]) => mockGetRules(...a),
  addRule: (...a: unknown[]) => mockAddRule(...a),
  deleteRule: (...a: unknown[]) => mockDeleteRule(...a),
}))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TransactionsPage from './page'
import type { Transaction, Category, CategorizationRule } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]
const txs: Transaction[] = [
  { id: 'tx1', date: '2026-06-15', merchantName: 'שופרסל', amount: 250, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
  { id: 'tx2', date: '2026-06-14', merchantName: 'רמי לוי', amount: 150, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06' },
]
const rules: CategorizationRule[] = []

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTransactions.mockResolvedValue(txs)
  mockGetCategories.mockResolvedValue(cats)
  mockGetRules.mockResolvedValue(rules)
})

describe('TransactionsPage', () => {
  it('shows loading state initially', () => {
    mockGetTransactions.mockImplementation(() => new Promise(() => {}))
    render(<TransactionsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('renders transactions after loading', async () => {
    render(<TransactionsPage />)
    await waitFor(() => expect(screen.getByText('שופרסל')).toBeInTheDocument())
    expect(screen.getByText('רמי לוי')).toBeInTheDocument()
  })

  it('shows uncategorized count in filter button', async () => {
    render(<TransactionsPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /ללא קטגוריה \(1\)/ })).toBeInTheDocument())
  })

  it('filters to uncategorized only when filter button clicked', async () => {
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    fireEvent.click(screen.getByRole('button', { name: /ללא קטגוריה/ }))
    expect(screen.queryByText('שופרסל')).not.toBeInTheDocument()
    expect(screen.getByText('רמי לוי')).toBeInTheDocument()
  })

  it('calls updateTransaction when category is changed', async () => {
    mockUpdateTransaction.mockResolvedValue(undefined)
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'c1' } })
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledWith('tx1', { categoryId: 'c1' }))
  })

  it('calls deleteTransaction and removes row on delete click', async () => {
    mockDeleteTransaction.mockResolvedValue(undefined)
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    const deleteButtons = screen.getAllByRole('button', { name: 'מחק עסקה' })
    fireEvent.click(deleteButtons[0])
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith('tx1'))
    await waitFor(() => expect(screen.queryByText('שופרסל')).not.toBeInTheDocument())
  })

  it('shows empty state when no transactions', async () => {
    mockGetTransactions.mockResolvedValue([])
    render(<TransactionsPage />)
    await waitFor(() => expect(screen.getByText('אין עסקאות בחודש זה')).toBeInTheDocument())
  })

  it('shows "כל העסקאות מקוטלגות!" when filter=uncategorized and all are categorized', async () => {
    mockGetTransactions.mockResolvedValue([txs[0]])
    render(<TransactionsPage />)
    await waitFor(() => screen.getByText('שופרסל'))
    fireEvent.click(screen.getByRole('button', { name: /ללא קטגוריה/ }))
    expect(screen.getByText('כל העסקאות מקוטלגות!')).toBeInTheDocument()
  })
})
