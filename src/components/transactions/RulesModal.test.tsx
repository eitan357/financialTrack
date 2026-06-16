import { render, screen, fireEvent } from '@testing-library/react'
import { RulesModal } from './RulesModal'
import type { CategorizationRule, Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
]

const rules: CategorizationRule[] = [
  { id: 'r1', keyword: 'שופרסל', matchType: 'contains', categoryId: 'c1', priority: 10, createdAt: '2026-01-01T00:00:00Z' },
]

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  rules,
  categories: cats,
  onAdd: jest.fn(),
  onDelete: jest.fn(),
}

describe('RulesModal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<RulesModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders title when isOpen is true', () => {
    render(<RulesModal {...defaultProps} />)
    expect(screen.getByText('חוקי קטגוריזציה')).toBeInTheDocument()
  })

  it('shows existing rule keyword and category name', () => {
    render(<RulesModal {...defaultProps} />)
    expect(screen.getByText('שופרסל')).toBeInTheDocument()
    expect(screen.getByText('אוכל')).toBeInTheDocument()
  })

  it('shows empty state when rules list is empty', () => {
    render(<RulesModal {...defaultProps} rules={[]} />)
    expect(screen.getByText('אין חוקים עדיין')).toBeInTheDocument()
  })

  it('calls onDelete with ruleId when delete button clicked', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'מחק חוק' }))
    expect(defaultProps.onDelete).toHaveBeenCalledWith('r1')
  })

  it('calls onAdd with correct data when form submitted', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('למשל: שופרסל'), { target: { value: 'רמי לוי' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(defaultProps.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'רמי לוי', categoryId: 'c1', matchType: 'contains' })
    )
  })

  it('calls onClose when close button clicked', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('does not call onAdd when keyword is empty', () => {
    render(<RulesModal {...defaultProps} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(defaultProps.onAdd).not.toHaveBeenCalled()
  })
})
