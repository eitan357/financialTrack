const mockGetInvestmentTypes = jest.fn()
const mockGetInvestmentEntriesByYear = jest.fn()
const mockAddInvestmentEntry = jest.fn()
const mockDeleteInvestmentEntry = jest.fn()
const mockGetDividendsByYear = jest.fn()
const mockAddDividend = jest.fn()
const mockDeleteDividend = jest.fn()
const mockGetAccounts = jest.fn()

jest.mock('@/lib/firestore/investments', () => ({
  getInvestmentTypes: (...a: unknown[]) => mockGetInvestmentTypes(...a),
  getInvestmentEntriesByYear: (...a: unknown[]) => mockGetInvestmentEntriesByYear(...a),
  addInvestmentEntry: (...a: unknown[]) => mockAddInvestmentEntry(...a),
  deleteInvestmentEntry: (...a: unknown[]) => mockDeleteInvestmentEntry(...a),
}))
jest.mock('@/lib/firestore/dividends', () => ({
  getDividendsByYear: (...a: unknown[]) => mockGetDividendsByYear(...a),
  addDividend: (...a: unknown[]) => mockAddDividend(...a),
  deleteDividend: (...a: unknown[]) => mockDeleteDividend(...a),
}))
jest.mock('@/lib/firestore/accounts', () => ({
  getAccounts: (...a: unknown[]) => mockGetAccounts(...a),
}))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import InvestmentsPage from './page'
import type { InvestmentType, InvestmentEntry, Dividend, Account } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS', portfolioAccountId: 'p1' },
]
const portfolios: Account[] = [
  { id: 'p1', name: 'תיק 1', type: 'investment', color: '#888', isActive: true },
]
const entries: InvestmentEntry[] = [
  { id: 'e1', date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 1000, currency: 'ILS' },
]
const dividends: Dividend[] = [
  { id: 'd1', month: '2026-06', investmentTypeId: 't1', amount: 45, currency: 'USD', ilsEquivalent: 165, date: '2026-06-10' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAccounts.mockResolvedValue(portfolios)
  mockGetInvestmentTypes.mockResolvedValue(types)
  mockGetInvestmentEntriesByYear.mockResolvedValue(entries)
  mockGetDividendsByYear.mockResolvedValue(dividends)
})

describe('InvestmentsPage', () => {
  it('shows loading state initially', () => {
    mockGetInvestmentTypes.mockImplementation(() => new Promise(() => {}))
    render(<InvestmentsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows investment type name in entries list after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getAllByText('הראל').length).toBeGreaterThan(0))
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0)
  })

  it('shows dividends after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getByText(/45/)).toBeInTheDocument())
    expect(screen.getByText(/165/)).toBeInTheDocument()
  })

  it('shows add entry form when "+ הוסף הפקדה" button is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => screen.getAllByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף הפקדה' }))
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
  })

  it('shows add dividend form when "+ הוסף הכנסה" button is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => screen.getAllByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף הכנסה' }))
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
  })

  it('calls addInvestmentEntry when entry form is submitted', async () => {
    const newEntry: InvestmentEntry = { id: 'e2', date: '2026-06-15', month: '2026-06', investmentTypeId: 't1', amount: 500, currency: 'ILS' }
    mockAddInvestmentEntry.mockResolvedValue(newEntry)
    render(<InvestmentsPage />)
    await waitFor(() => screen.getAllByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף הפקדה' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    await waitFor(() => expect(mockAddInvestmentEntry).toHaveBeenCalled())
  })
})
