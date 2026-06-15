import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreditImportStep } from './CreditImportStep'

const mockMapRows = jest.fn().mockReturnValue([{
  date: '2026-06-01', merchantName: 'שופרסל', bankCategory: 'מזון',
  amount: 150, currency: 'ILS', isImmediate: false, notes: '',
}])

jest.mock('@/lib/parsers/csv-parser', () => ({ parseCSV: jest.fn().mockReturnValue([{}]) }))
jest.mock('@/lib/parsers/xlsx-parser', () => ({
  getSheetNames: jest.fn().mockReturnValue(['פירוט', 'קניות בחול']),
  parseSheet: jest.fn().mockReturnValue([{}]),
}))
jest.mock('@/lib/parsers/transaction-mapper', () => ({ mapRows: (...a: unknown[]) => mockMapRows(...a) }))
jest.mock('@/lib/categorization/engine', () => ({
  categorize: jest.fn().mockReturnValue({ categoryId: 'c1', source: 'rule' }),
}))

const defaultProps = {
  stepNumber: 1,
  accountName: 'אשראי בהצדעה',
  accountId: 'a1',
  categories: [{ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true }],
  rules: [],
  previousTransactions: [],
  initialTransactions: [],
  onComplete: jest.fn(),
  onSkip: jest.fn(),
}

function makeCSVFile() {
  const file = new File(['header\nrow'], 'test.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve('csv') })
  return file
}

function makeXLSXFile() {
  const file = new File([new ArrayBuffer(0)], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new ArrayBuffer(0)) })
  return file
}

beforeEach(() => jest.clearAllMocks())

describe('CreditImportStep', () => {
  it('renders the account name in the heading', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.getByText(/אשראי בהצדעה/)).toBeInTheDocument()
  })

  it('renders a file upload area', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.getByText(/העלאת קובץ/)).toBeInTheDocument()
  })

  it('renders the skip button', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.getByText('דלג')).toBeInTheDocument()
  })

  it('does not render Back button when onBack is not provided', () => {
    render(<CreditImportStep {...defaultProps} />)
    expect(screen.queryByText('← חזור')).not.toBeInTheDocument()
  })

  it('renders Back button when onBack is provided', () => {
    render(<CreditImportStep {...defaultProps} onBack={jest.fn()} />)
    expect(screen.getByText('← חזור')).toBeInTheDocument()
  })

  it('shows preview table after CSV upload', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeCSVFile()] } })
    await waitFor(() => expect(screen.getByRole('table', { name: 'תצוגה מקדימה של עסקאות' })).toBeInTheDocument())
    expect(screen.getByText('שופרסל')).toBeInTheDocument()
  })

  it('shows sheet selector for XLSX files', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeXLSXFile()] } })
    await waitFor(() => expect(screen.getByText('פירוט')).toBeInTheDocument())
    expect(screen.getByText('קניות בחול')).toBeInTheDocument()
  })

  it('shows error for unsupported file type', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File([''], 'doc.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [badFile] } })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('calls onSkip when skip is clicked', () => {
    render(<CreditImportStep {...defaultProps} />)
    fireEvent.click(screen.getByText('דלג'))
    expect(defaultProps.onSkip).toHaveBeenCalled()
  })

  it('calls onComplete with transactions when Next is clicked', async () => {
    render(<CreditImportStep {...defaultProps} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeCSVFile()] } })
    await waitFor(() => screen.getByText('הבא →'))
    fireEvent.click(screen.getByText('הבא →'))
    expect(defaultProps.onComplete).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ merchantName: 'שופרסל', categoryId: 'c1' })
    ]))
  })
})
