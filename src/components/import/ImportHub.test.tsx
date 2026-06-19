import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImportHub } from './ImportHub'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

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
  seedDefaultCategories: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/salary', () => ({
  getSalaryEntries: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))

beforeEach(() => {
  mockPush.mockClear()
  mockReplace.mockClear()
})

describe('ImportHub', () => {
  it('shows hub cards after loading', async () => {
    render(<ImportHub />)
    await waitFor(() => {
      expect(screen.getByText('ויזה')).toBeInTheDocument()
    })
    expect(screen.getByText('לאומי')).toBeInTheDocument()
    expect(screen.getByText('משכורות')).toBeInTheDocument()
    expect(screen.getByText('מזומן')).toBeInTheDocument()
    expect(screen.queryByText('הכנסות נוספות')).not.toBeInTheDocument()
  })

  it('navigates to credit flow when credit account row is clicked', async () => {
    render(<ImportHub />)
    await waitFor(() => expect(screen.getByText('ויזה')).toBeInTheDocument())
    fireEvent.click(screen.getByText('ויזה'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/import/credit/cc1'))
  })

  it('navigates to bank flow when bank account row is clicked', async () => {
    render(<ImportHub />)
    await waitFor(() => expect(screen.getByText('לאומי')).toBeInTheDocument())
    fireEvent.click(screen.getByText('לאומי'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/import/bank/bk1'))
  })

  it('navigates to salary flow when salary row is clicked', async () => {
    render(<ImportHub />)
    await waitFor(() => expect(screen.getByText('משכורות')).toBeInTheDocument())
    fireEvent.click(screen.getByText('משכורות'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/import/salary'))
  })
})
