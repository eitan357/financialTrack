const mockGetTransactionsForMonths = jest.fn()
const mockGetCategories = jest.fn()

jest.mock('@/lib/firestore/transactions', () => ({
  getTransactionsForMonths: (...a: unknown[]) => mockGetTransactionsForMonths(...a),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: (...a: unknown[]) => mockGetCategories(...a),
}))

import { render, screen, waitFor } from '@testing-library/react'
import ReportsPage from './page'
import type { Transaction, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]
const txs: Transaction[] = [
  { id: 'tx1', date: '2026-06-01', merchantName: 'שופרסל', amount: 500, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTransactionsForMonths.mockResolvedValue(txs)
  mockGetCategories.mockResolvedValue(cats)
})

describe('ReportsPage', () => {
  it('shows loading state initially', () => {
    mockGetTransactionsForMonths.mockImplementation(() => new Promise(() => {}))
    render(<ReportsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('renders the page title', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText('דוחות')).toBeInTheDocument())
  })

  it('calls getTransactionsForMonths with 6 months', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(mockGetTransactionsForMonths).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringMatching(/^\d{4}-\d{2}$/)])
    ))
    expect(mockGetTransactionsForMonths.mock.calls[0][0]).toHaveLength(6)
  })

  it('renders month summary rows after loading', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText(/יוני/)).toBeInTheDocument())
  })

  it('shows total expenses for a month', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getAllByText(/500/).length).toBeGreaterThan(0))
  })
})
