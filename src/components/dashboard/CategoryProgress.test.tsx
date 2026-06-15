import { render, screen } from '@testing-library/react'
import { CategoryProgress } from './CategoryProgress'
import type { CategorySummary } from '@/lib/dashboard/compute'

const cats: CategorySummary[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', actual: 1200, target: 2000 },
  { id: 'c2', name: 'חשבונות', color: '#f97316', actual: 2200, target: 2000 },
  { id: 'c3', name: 'רפואה', color: '#84cc16', actual: 300, target: null },
]

describe('CategoryProgress', () => {
  it('renders all category names', () => {
    render(<CategoryProgress categories={cats} />)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText('חשבונות')).toBeInTheDocument()
    expect(screen.getByText('רפואה')).toBeInTheDocument()
  })

  it('shows actual amounts', () => {
    render(<CategoryProgress categories={cats} />)
    expect(screen.getByText(/1,200/)).toBeInTheDocument()
  })

  it('shows target when present', () => {
    render(<CategoryProgress categories={cats} />)
    expect(screen.getAllByText(/2,000/)).toHaveLength(2)
  })

  it('renders progress bar for categories with a target', () => {
    render(<CategoryProgress categories={cats} />)
    const bars = document.querySelectorAll('[data-testid="progress-bar"]')
    expect(bars).toHaveLength(2)
  })

  it('marks over-budget category bar as red', () => {
    render(<CategoryProgress categories={cats} />)
    const bars = document.querySelectorAll('[data-testid="progress-bar"]')
    const overBudget = Array.from(bars).find(b => b.className.includes('bg-red'))
    expect(overBudget).toBeTruthy()
  })

  it('returns null when no categories', () => {
    const { container } = render(<CategoryProgress categories={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
