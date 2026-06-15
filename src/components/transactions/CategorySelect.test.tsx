import { render, screen, fireEvent } from '@testing-library/react'
import { CategorySelect } from './CategorySelect'
import type { Category } from '@/lib/types'

const cats: Category[] = [
  { id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true },
  { id: 'c2', name: 'תחבורה', color: '#3b82f6', isActive: true },
]

describe('CategorySelect', () => {
  it('renders "ללא קטגוריה" as first option', () => {
    render(<CategorySelect value={undefined} categories={cats} onChange={jest.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('ללא קטגוריה')).toBeInTheDocument()
  })

  it('renders all category options', () => {
    render(<CategorySelect value={undefined} categories={cats} onChange={jest.fn()} />)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText('תחבורה')).toBeInTheDocument()
  })

  it('shows the selected category', () => {
    render(<CategorySelect value="c1" categories={cats} onChange={jest.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('c1')
  })

  it('calls onChange with undefined when blank option is selected', () => {
    const onChange = jest.fn()
    render(<CategorySelect value="c1" categories={cats} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('calls onChange with categoryId when a category is selected', () => {
    const onChange = jest.fn()
    render(<CategorySelect value={undefined} categories={cats} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c2' } })
    expect(onChange).toHaveBeenCalledWith('c2')
  })
})
