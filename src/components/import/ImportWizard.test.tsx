import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ImportWizard } from './ImportWizard'

// Mock all Firestore services
jest.mock('@/lib/firestore/accounts', () => ({
  seedDefaultAccounts: jest.fn().mockResolvedValue(undefined),
  getAccounts: jest.fn().mockResolvedValue([
    { id: 'a1', name: 'אשראי בהצדעה',  type: 'credit', color: '#f59e0b', isActive: true },
    { id: 'a2', name: 'אשראי One Zero', type: 'credit', color: '#3b82f6', isActive: true },
    { id: 'a5', name: 'מזומן',          type: 'cash',   color: '#94a3b8', isActive: true },
  ]),
}))
jest.mock('@/lib/firestore/categories', () => ({
  seedDefaultCategories: jest.fn().mockResolvedValue(undefined),
  getCategories: jest.fn().mockResolvedValue([
    { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
  ]),
}))
jest.mock('@/lib/firestore/categorization-rules', () => ({
  getRules: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/transactions', () => ({
  getTransactions: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/firestore/salary', () => ({
  getSalaryEntry: jest.fn().mockResolvedValue(null),
}))

// Mock all step components with lightweight stubs
jest.mock('./steps/CreditImportStep', () => ({
  CreditImportStep: ({ accountName, onComplete, onSkip, onBack, stepNumber }: { accountName: string; onComplete: (t: unknown[]) => void; onSkip: () => void; onBack?: () => void; stepNumber: number }) => (
    <div>
      <span data-testid="step-label">שלב {stepNumber} — {accountName}</span>
      <button onClick={() => onComplete([])}>סיים</button>
      <button onClick={onSkip}>דלג</button>
      {onBack && <button onClick={onBack}>חזור</button>}
    </div>
  ),
}))
jest.mock('./steps/SalaryStep', () => ({
  SalaryStep: ({ onComplete, onSkip, onBack }: { onComplete: (s: unknown) => void; onSkip: () => void; onBack: () => void }) => (
    <div>
      <span data-testid="step-label">שלב 3 — משכורת</span>
      <button onClick={() => onComplete({})}>סיים</button>
      <button onClick={onSkip}>דלג</button>
      <button onClick={onBack}>חזור</button>
    </div>
  ),
}))
jest.mock('./steps/IncomeStep', () => ({
  IncomeStep: ({ onComplete, onBack }: { onComplete: (e: unknown[]) => void; onBack: () => void }) => (
    <div>
      <span data-testid="step-label">שלב 4 — הכנסות</span>
      <button onClick={() => onComplete([])}>סיים</button>
      <button onClick={onBack}>חזור</button>
    </div>
  ),
}))
jest.mock('./steps/CashStep', () => ({
  CashStep: ({ onComplete, onBack }: { onComplete: (e: unknown[]) => void; onBack: () => void }) => (
    <div>
      <span data-testid="step-label">שלב 5 — מזומן</span>
      <button onClick={() => onComplete([])}>סיים</button>
      <button onClick={onBack}>חזור</button>
    </div>
  ),
}))
jest.mock('./steps/SummaryStep', () => ({
  SummaryStep: ({ onDone }: { onDone: () => void }) => (
    <div>
      <span data-testid="step-label">סיכום</span>
      <button onClick={onDone}>סיים</button>
    </div>
  ),
}))

describe('ImportWizard', () => {
  it('shows loading state initially', () => {
    render(<ImportWizard />)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
  })

  it('shows step 1 (אשראי בהצדעה) after loading', async () => {
    render(<ImportWizard />)
    await waitFor(() => expect(screen.getByTestId('step-label').textContent).toContain('שלב 1'))
    expect(screen.getByTestId('step-label').textContent).toContain('אשראי בהצדעה')
  })

  it('shows step counter text', async () => {
    render(<ImportWizard />)
    await waitFor(() => expect(screen.getByText('שלב 1 מתוך 5')).toBeInTheDocument())
  })

  it('advances to step 2 when step 1 completes', async () => {
    render(<ImportWizard />)
    await waitFor(() => screen.getByText('סיים'))
    fireEvent.click(screen.getByText('סיים'))
    expect(screen.getByTestId('step-label').textContent).toContain('שלב 2')
    expect(screen.getByTestId('step-label').textContent).toContain('אשראי One Zero')
  })

  it('advances through all 5 steps to summary', async () => {
    render(<ImportWizard />)
    await waitFor(() => screen.getByText('סיים'))
    // steps 1-5
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('סיים'))
    }
    expect(screen.getByTestId('step-label').textContent).toContain('סיכום')
  })

  it('shows month selector with navigation buttons', async () => {
    render(<ImportWizard />)
    await waitFor(() => screen.getByRole('button', { name: 'חודש קודם' }))
    expect(screen.getByRole('button', { name: 'חודש הבא' })).toBeInTheDocument()
  })
})
