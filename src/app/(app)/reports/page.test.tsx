const mockGetTransactionsForMonths = jest.fn()
const mockGetCategories = jest.fn()
const mockGetAccounts = jest.fn()

jest.mock('@/lib/firestore/transactions', () => ({
  getTransactionsForMonths: (...a: unknown[]) => mockGetTransactionsForMonths(...a),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: (...a: unknown[]) => mockGetCategories(...a),
}))
jest.mock('@/lib/firestore/accounts', () => ({
  getAccounts: (...a: unknown[]) => mockGetAccounts(...a),
}))

import { render, screen, waitFor } from '@testing-library/react'
import ReportsPage from './page'
import type { Transaction, Category, Account } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]
const accounts: Account[] = [
  { id: 'a1', name: 'בנק', type: 'bank', color: '#3b82f6', isActive: true },
  { id: 'credit1', name: 'ויזה', type: 'credit', color: '#ef4444', isActive: true },
]
const txs: Transaction[] = [
  { id: 'tx1', date: '2026-06-01', merchantName: 'שופרסל', amount: 500, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06', categoryId: 'c1' },
  { id: 'tx2', date: '2026-06-02', merchantName: 'שופרסל', amount: 200, currency: 'ILS', accountId: 'credit1', source: 'xlsx_import', isImmediate: true, month: '2026-06', categoryId: 'c1' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTransactionsForMonths.mockResolvedValue(txs)
  mockGetCategories.mockResolvedValue(cats)
  mockGetAccounts.mockResolvedValue(accounts)
})

describe('ReportsPage', () => {
  it('shows loading state initially', () => {
    mockGetTransactionsForMonths.mockImplementation(() => new Promise(() => {}))
    render(<ReportsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('renders year navigation', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText(String(new Date().getFullYear()))).toBeInTheDocument())
  })

  it('calls getTransactionsForMonths with 12 months of the year', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(mockGetTransactionsForMonths).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringMatching(/^\d{4}-\d{2}$/)])
    ))
    expect(mockGetTransactionsForMonths.mock.calls[0][0]).toHaveLength(12)
  })

  it('calls getAccounts', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(mockGetAccounts).toHaveBeenCalled())
  })

  it('renders month summary rows after loading', async () => {
    render(<ReportsPage />)
    await waitFor(() => expect(screen.getByText(/יוני/)).toBeInTheDocument())
  })

  it('excludes credit isImmediate transactions from expense totals', async () => {
    render(<ReportsPage />)
    // Only tx1 (500) should count, not tx2 (200 credit immediate)
    await waitFor(() => expect(screen.getAllByText(/500/).length).toBeGreaterThan(0))
    expect(screen.queryByText(/700/)).toBeNull()
  })
})
