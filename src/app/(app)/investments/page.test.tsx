const mockGetInvestmentTypes = jest.fn()
const mockAddInvestmentType = jest.fn()
const mockGetInvestmentEntries = jest.fn()
const mockAddInvestmentEntry = jest.fn()
const mockGetDividends = jest.fn()
const mockAddDividend = jest.fn()

jest.mock('@/lib/firestore/investments', () => ({
  getInvestmentTypes: (...a: unknown[]) => mockGetInvestmentTypes(...a),
  addInvestmentType: (...a: unknown[]) => mockAddInvestmentType(...a),
  getInvestmentEntries: (...a: unknown[]) => mockGetInvestmentEntries(...a),
  addInvestmentEntry: (...a: unknown[]) => mockAddInvestmentEntry(...a),
}))
jest.mock('@/lib/firestore/dividends', () => ({
  getDividends: (...a: unknown[]) => mockGetDividends(...a),
  addDividend: (...a: unknown[]) => mockAddDividend(...a),
}))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import InvestmentsPage from './page'
import type { InvestmentType, InvestmentEntry, Dividend } from '@/lib/types'

const types: InvestmentType[] = [
  { id: 't1', name: 'הראל', currency: 'ILS' },
]
const entries: InvestmentEntry[] = [
  { id: 'e1', date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 1000, currency: 'ILS' },
]
const dividends: Dividend[] = [
  { id: 'd1', month: '2026-06', investmentTypeId: 't1', amount: 45, currency: 'USD', ilsEquivalent: 165, date: '2026-06-10' },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInvestmentTypes.mockResolvedValue(types)
  mockGetInvestmentEntries.mockResolvedValue(entries)
  mockGetDividends.mockResolvedValue(dividends)
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
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
  })

  it('shows dividends after loading', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => expect(screen.getByText(/45/)).toBeInTheDocument())
    expect(screen.getByText(/165/)).toBeInTheDocument()
  })

  it('shows add entry form when "הוסף תרומה" button is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => screen.getAllByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תרומה' }))
    expect(screen.getByLabelText('סכום')).toBeInTheDocument()
  })

  it('shows add dividend form when "הוסף דיבידנד" button is clicked', async () => {
    render(<InvestmentsPage />)
    await waitFor(() => screen.getAllByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: 'הוסף דיבידנד' }))
    expect(screen.getByLabelText('שווי ב-₪')).toBeInTheDocument()
  })

  it('calls addInvestmentEntry when entry form is submitted', async () => {
    const newEntry: InvestmentEntry = { id: 'e2', date: '2026-06-15', month: '2026-06', investmentTypeId: 't1', amount: 500, currency: 'ILS' }
    mockAddInvestmentEntry.mockResolvedValue(newEntry)
    render(<InvestmentsPage />)
    await waitFor(() => screen.getAllByText('הראל'))
    fireEvent.click(screen.getByRole('button', { name: 'הוסף תרומה' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByLabelText('סכום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    await waitFor(() => expect(mockAddInvestmentEntry).toHaveBeenCalled())
  })
})
