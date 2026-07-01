const mockGetInvestmentTypes = jest.fn()
const mockGetInvestmentEntries = jest.fn()
const mockAddInvestmentEntry = jest.fn()
const mockDeleteInvestmentEntry = jest.fn()
const mockGetDividends = jest.fn()
const mockAddDividend = jest.fn()
const mockDeleteDividend = jest.fn()
const mockGetInvestmentConversions = jest.fn()
const mockAddInvestmentConversion = jest.fn()
const mockDeleteInvestmentConversion = jest.fn()
const mockGetAccounts = jest.fn()
const mockGetTransactions = jest.fn()

jest.mock('@/lib/firestore/investments', () => ({
  getInvestmentTypes: (...a: unknown[]) => mockGetInvestmentTypes(...a),
  getInvestmentEntries: (...a: unknown[]) => mockGetInvestmentEntries(...a),
  addInvestmentEntry: (...a: unknown[]) => mockAddInvestmentEntry(...a),
  deleteInvestmentEntry: (...a: unknown[]) => mockDeleteInvestmentEntry(...a),
}))
jest.mock('@/lib/firestore/dividends', () => ({
  getDividends: (...a: unknown[]) => mockGetDividends(...a),
  addDividend: (...a: unknown[]) => mockAddDividend(...a),
  deleteDividend: (...a: unknown[]) => mockDeleteDividend(...a),
}))
jest.mock('@/lib/firestore/conversions', () => ({
  getInvestmentConversions: (...a: unknown[]) => mockGetInvestmentConversions(...a),
  addInvestmentConversion: (...a: unknown[]) => mockAddInvestmentConversion(...a),
  deleteInvestmentConversion: (...a: unknown[]) => mockDeleteInvestmentConversion(...a),
}))
jest.mock('@/lib/firestore/accounts', () => ({
  getAccounts: (...a: unknown[]) => mockGetAccounts(...a),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: (...a: unknown[]) => mockGetTransactions(...a),
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
  mockGetInvestmentEntries.mockResolvedValue(entries)
  mockGetDividends.mockResolvedValue(dividends)
  mockGetInvestmentConversions.mockResolvedValue([])
  mockGetTransactions.mockResolvedValue([])
})

describe('InvestmentsPage', () => {
  it('shows loading state initially', () => {
    mockGetInvestmentTypes.mockImplementation(() => new Promise(() => {}))
    render(<InvestmentsPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows investment type name in entries list after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0))
    expect(screen.getAllByText(/הראל/).length).toBeGreaterThan(0)
  })

  it('shows dividends after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getAllByText(/165/).length).toBeGreaterThan(0))
    expect(screen.getAllByText(/הכנסה/).length).toBeGreaterThan(0)
  })

  it('shows add entry form when "+ הוסף פעילות" button is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף פעילות' }))
    expect(screen.getByLabelText(/סכום/)).toBeInTheDocument()
  })

  it('shows add dividend form when "הכנסה" toggle is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף פעילות' }))
    fireEvent.click(screen.getByRole('button', { name: 'הכנסה' }))
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
  })

  it('calls addInvestmentEntry when entry form is submitted', async () => {
    const newEntry: InvestmentEntry = { id: 'e2', date: '2026-06-15', month: '2026-06', investmentTypeId: 't1', amount: 500, currency: 'ILS' }
    mockAddInvestmentEntry.mockResolvedValue(newEntry)
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף פעילות' }))
    // Open the custom SelectField dropdown by clicking the trigger button (shows placeholder)
    fireEvent.click(screen.getByText('בחר סוג...'))
    // Click the option for הראל
    await waitFor(() => screen.getByRole('option', { name: 'הראל' }))
    fireEvent.click(screen.getByRole('option', { name: 'הראל' }))
    fireEvent.change(screen.getByLabelText(/סכום/), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    await waitFor(() => expect(mockAddInvestmentEntry).toHaveBeenCalled())
  })

  it('shows investment transfer transaction in activity list', async () => {
    mockGetTransactions.mockResolvedValue([{
      id: 'tx-inv1',
      date: '2026-06-10',
      merchantName: 'העברה לפסגות',
      amount: 5000,
      currency: 'ILS',
      accountId: 'bank1',
      source: 'xlsx_import',
      isImmediate: false,
      month: '2026-06',
      direction: 'investment',
      portfolioAccountId: 'p1',
    }])
    render(<InvestmentsPage />)
    await waitFor(() => {
      expect(screen.getByText(/העברה: העברה לפסגות/)).toBeInTheDocument()
    })
  })
})
