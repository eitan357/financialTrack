import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SummaryStep } from './SummaryStep'

jest.mock('@/lib/firestore/transactions', () => ({ addTransactions: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/firestore/salary', () => ({ upsertSalaryEntry: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/firestore/income', () => ({ addIncomeEntry: jest.fn().mockResolvedValue({ id: 'i1' }) }))

const mockImportedTx = {
  date: '2026-06-01', merchantName: 'שופרסל', bankCategory: '', amount: 150,
  currency: 'ILS', isImmediate: false, notes: '', categoryId: 'c1', categorizationSource: 'rule' as const,
}

const baseProps = {
  month: '2026-06',
  data: {
    creditAccounts: [
      { accountId: 'a1', accountName: 'אשראי בהצדעה', transactions: [mockImportedTx] },
      { accountId: 'a2', accountName: 'אשראי One Zero', transactions: [] },
    ],
    salary: null,
    incomeEntries: [],
    cashExpenses: [],
  },
  cashAccountId: 'a5',
  onDone: jest.fn(),
}

describe('SummaryStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('displays a row for each credit account', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('עסקאות אשראי בהצדעה')).toBeInTheDocument()
    expect(screen.getByText('עסקאות אשראי One Zero')).toBeInTheDocument()
  })

  it('displays fixed rows for income and cash', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('הכנסות נוספות')).toBeInTheDocument()
    expect(screen.getByText('הוצאות מזומן')).toBeInTheDocument()
  })

  it('shows the Save button', () => {
    render(<SummaryStep {...baseProps} />)
    expect(screen.getByText('שמור הכל')).toBeInTheDocument()
  })

  it('calls addTransactions with correct accountId per credit account', async () => {
    const { addTransactions } = require('@/lib/firestore/transactions')
    render(<SummaryStep {...baseProps} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => expect(addTransactions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ merchantName: 'שופרסל', accountId: 'a1' })])
    ))
  })

  it('shows success screen after saving', async () => {
    render(<SummaryStep {...baseProps} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => expect(screen.getByText('הנתונים נשמרו בהצלחה!')).toBeInTheDocument())
  })

  it('calls onDone after success when button clicked', async () => {
    const onDone = jest.fn()
    render(<SummaryStep {...baseProps} onDone={onDone} />)
    fireEvent.click(screen.getByText('שמור הכל'))
    await waitFor(() => screen.getByText('חזור לייבוא'))
    fireEvent.click(screen.getByText('חזור לייבוא'))
    expect(onDone).toHaveBeenCalled()
  })
})
