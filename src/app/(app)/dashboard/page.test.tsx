jest.mock('@/lib/firestore/transactions', () => ({ getTransactions: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/salary', () => ({ getSalaryEntry: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/firestore/income', () => ({ getIncomeEntries: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/dividends', () => ({ getDividends: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/investments', () => ({
  getInvestmentEntries: jest.fn().mockResolvedValue([]),
  getInvestmentTypes: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/bank-reconciliations', () => ({ getBankReconciliations: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/firestore/monthly-settings', () => ({ getMonthlySettings: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/firestore/categories', () => ({ getCategories: jest.fn().mockResolvedValue([]) }))

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DashboardPage from './page'

beforeEach(() => jest.clearAllMocks())

describe('DashboardPage', () => {
  it('shows loading state initially', () => {
    render(<DashboardPage />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows all 4 summary card labels after loading', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('הכנסות')).toBeInTheDocument())
    expect(screen.getByText('הוצאות')).toBeInTheDocument()
    expect(screen.getByText('חיסכון')).toBeInTheDocument()
    expect(screen.getByText('להשקעות')).toBeInTheDocument()
  })

  it('shows month navigation buttons', () => {
    render(<DashboardPage />)
    expect(screen.getByRole('button', { name: 'חודש קודם' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'חודש הבא' })).toBeInTheDocument()
  })

  it('shows bank reconciliation card after loading', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('אימות יתרת בנק')).toBeInTheDocument())
  })

  it('shows dividends card after loading', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('דיבידנדים החודש')).toBeInTheDocument())
  })

  it('reloads data when navigating to previous month', async () => {
    const { getTransactions } = require('@/lib/firestore/transactions')
    render(<DashboardPage />)
    await waitFor(() => screen.getByText('הכנסות'))
    const before = getTransactions.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'חודש קודם' }))
    await waitFor(() => expect(getTransactions.mock.calls.length).toBeGreaterThan(before))
  })
})
