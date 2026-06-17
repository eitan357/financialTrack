import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SalaryStep } from './SalaryStep'

const defaultProps = {
  month: '2026-06',
  initialSalary: null,
  bankAccounts: [],
  onComplete: jest.fn(),
  onSkip: jest.fn(),
  onBack: jest.fn(),
}

describe('SalaryStep', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all salary form fields', () => {
    render(<SalaryStep {...defaultProps} />)
    expect(screen.getByLabelText('שם מעסיק')).toBeInTheDocument()
    expect(screen.getByLabelText('ברוטו')).toBeInTheDocument()
    expect(screen.getByLabelText('מס הכנסה')).toBeInTheDocument()
    expect(screen.getByLabelText('ביטוח לאומי')).toBeInTheDocument()
    expect(screen.getByLabelText('ביטוח בריאות')).toBeInTheDocument()
    expect(screen.getByLabelText('פנסיה')).toBeInTheDocument()
    expect(screen.getByLabelText('קרן השתלמות')).toBeInTheDocument()
  })

  it('shows zero netAmount initially', () => {
    render(<SalaryStep {...defaultProps} />)
    expect(screen.getByTestId('net-amount')).toHaveTextContent('0')
  })

  it('computes netAmount automatically when gross changes', () => {
    render(<SalaryStep {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('ברוטו'), { target: { value: '10000' } })
    expect(screen.getByTestId('net-amount')).toHaveTextContent('10,000')
  })

  it('subtracts deductions from gross', () => {
    render(<SalaryStep {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('ברוטו'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('מס הכנסה'), { target: { value: '2000' } })
    expect(screen.getByTestId('net-amount')).toHaveTextContent('8,000')
  })

  it('pre-fills fields from initialSalary', () => {
    const sal = { month: '2026-06', employerName: 'חברה בע"מ', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 100, pension: 1500, trainingFund: 750 }, netAmount: 10150 }
    render(<SalaryStep {...defaultProps} initialSalary={sal} />)
    expect(screen.getByDisplayValue('חברה בע"מ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('15000')).toBeInTheDocument()
  })

  it('calls onComplete with computed netAmount when Next clicked', () => {
    const onComplete = jest.fn()
    render(<SalaryStep {...defaultProps} onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText('שם מעסיק'), { target: { value: 'חברה' } })
    fireEvent.change(screen.getByLabelText('ברוטו'), { target: { value: '10000' } })
    fireEvent.click(screen.getByText('הבא →'))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ grossAmount: 10000, netAmount: 10000, employerName: 'חברה' }), null)
  })

  it('calls onSkip when skip clicked', () => {
    const onSkip = jest.fn()
    render(<SalaryStep {...defaultProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('דלג'))
    expect(onSkip).toHaveBeenCalled()
  })
})
