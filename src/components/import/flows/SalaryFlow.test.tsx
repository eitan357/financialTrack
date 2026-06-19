import { render, screen } from '@testing-library/react'
import { SalaryFlow } from './SalaryFlow'
import type { Account, SalaryEntry } from '@/lib/types'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({ back: jest.fn() }),
}))

jest.mock('@/lib/firestore/salary', () => ({
  upsertSalaryEntry: jest.fn().mockResolvedValue(undefined),
  deleteSalaryEntry: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  addTransactions: jest.fn().mockResolvedValue(undefined),
  updateTransaction: jest.fn().mockResolvedValue(undefined),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({}),
  collection: jest.fn().mockReturnValue({}),
  doc: jest.fn().mockReturnValue({ id: 'tx-mock-id' }),
  setDoc: jest.fn().mockResolvedValue(undefined),
}))

const bankAccounts: Account[] = [
  { id: 'bank1', name: 'לאומי', type: 'bank', color: '#00f', isActive: true },
]

describe('SalaryFlow', () => {
  it('shows empty state when no existing entries', () => {
    render(
      <SalaryFlow
        month="2026-06"
        existingEntries={[]}
        bankAccounts={bankAccounts}
        previousSalary={null}
        onDone={jest.fn()}
      />
    )
    expect(screen.getByText(/אין משכורות/i)).toBeInTheDocument()
    expect(screen.getByText(/הוסף משכורת/i)).toBeInTheDocument()
  })

  it('shows existing salary entry', () => {
    const entry: SalaryEntry = {
      id: 'sal1', month: '2026-06', employerName: 'Acme Corp',
      grossAmount: 15000,
      deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 200, pension: 1000, trainingFund: 500 },
      netAmount: 10800,
    }
    render(
      <SalaryFlow
        month="2026-06"
        existingEntries={[entry]}
        bankAccounts={bankAccounts}
        previousSalary={null}
        onDone={jest.fn()}
      />
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText(/10,800/)).toBeInTheDocument()
  })
})
