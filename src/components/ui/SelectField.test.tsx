// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectField } from './SelectField'
import { vi } from 'vitest'

const OPTIONS = [
  { value: 'food', label: 'אוכל', color: '#ff0000', group: 'בית' },
  { value: 'bills', label: 'חשבונות', color: '#00ff00', group: 'בית' },
  { value: 'gas', label: 'דלק', group: 'תחבורה' },
]

describe('SelectField', () => {
  it('shows placeholder when value is empty', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} placeholder="בחר..." />)
    expect(screen.getByText('בחר...')).toBeTruthy()
  })

  it('shows selected label when value is set', () => {
    render(<SelectField value="food" onChange={vi.fn()} options={OPTIONS} />)
    expect(screen.getByText('אוכל')).toBeTruthy()
  })

  it('opens dropdown on trigger click', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })

  it('filters options by search input', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש...'), { target: { value: 'דלק' } })
    expect(screen.getAllByRole('option').length).toBe(1)
    expect(screen.getByText('דלק')).toBeTruthy()
  })

  it('calls onChange with correct value on option click', () => {
    const onChange = vi.fn()
    render(<SelectField value="" onChange={onChange} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('אוכל'))
    expect(onChange).toHaveBeenCalledWith('food')
  })

  it('shows group headers', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('בית')).toBeTruthy()
    expect(screen.getByText('תחבורה')).toBeTruthy()
  })

  it('shows nullable item always visible during search', () => {
    render(<SelectField value="" onChange={vi.fn()} options={OPTIONS} nullable nullLabel="— ללא —" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('חפש...'), { target: { value: 'xyz_no_match' } })
    expect(screen.getByText('— ללא —')).toBeTruthy()
  })

  it('calls onChange with empty string when nullable item clicked', () => {
    const onChange = vi.fn()
    render(<SelectField value="food" onChange={onChange} options={OPTIONS} nullable />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('— ללא —'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes on click outside', () => {
    render(
      <div>
        <SelectField value="" onChange={vi.fn()} options={OPTIONS} />
        <div data-testid="outside">outside</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('option')).toBeNull()
  })
})
