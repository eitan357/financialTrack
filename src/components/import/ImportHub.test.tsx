import { render, screen, waitFor } from '@testing-library/react'
import { ImportHub } from './ImportHub'

jest.mock('@/lib/firestore/accounts', () => ({
  getAccounts: jest.fn().mockResolvedValue([
    { id: 'cc1', name: 'ויזה', type: 'credit', color: '#f00', isActive: true },
    { id: 'bk1', name: 'לאומי', type: 'bank', color: '#00f', isActive: true },
    { id: 'cash1', name: 'מזומן', type: 'cash', color: '#0f0', isActive: true },
    { id: 'bk2', name: 'One Zero', type: 'bank', color: '#0ff', isActive: true, csvIdentifier: 'one-zero' },
  ]),
  seedDefaultAccounts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/categories', () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  seedDefaultCategories: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/categorization-rules', () => ({
  getRules: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/salary', () => ({
  getSalaryEntries: jest.fn().mockResolvedValue([]),
  getSalaryEntry: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/firestore/income', () => ({
  getIncomeEntries: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/hooks/usePersistedMonth', () => ({
  usePersistedMonth: () => ['2026-06', jest.fn()],
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

describe('ImportHub', () => {
  it('shows hub cards after loading', async () => {
    render(<ImportHub />)
    await waitFor(() => {
      expect(screen.getByText('ויזה')).toBeInTheDocument()
    })
    expect(screen.getByText('משכורות')).toBeInTheDocument()
    expect(screen.getByText('הכנסות נוספות')).toBeInTheDocument()
    expect(screen.getByText('מזומן')).toBeInTheDocument()
  })
})
