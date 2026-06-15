import { render, screen } from '@testing-library/react'

const mockUsePathname = jest.fn()
jest.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('renders all five navigation items', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNav />)
    expect(screen.getByText('ראשי')).toBeInTheDocument()
    expect(screen.getByText('עסקאות')).toBeInTheDocument()
    expect(screen.getByText('ייבוא')).toBeInTheDocument()
    expect(screen.getByText('השקעות')).toBeInTheDocument()
    expect(screen.getByText('דוחות')).toBeInTheDocument()
  })

  it('applies accent color class to the active route', () => {
    mockUsePathname.mockReturnValue('/transactions')
    render(<BottomNav />)
    const activeLink = screen.getByText('עסקאות').closest('a')
    expect(activeLink).toHaveClass('text-accent')
  })

  it('applies muted color class to inactive routes', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNav />)
    const inactiveLink = screen.getByText('עסקאות').closest('a')
    expect(inactiveLink).toHaveClass('text-slate-400')
  })

  it('links point to correct hrefs', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNav />)
    expect(screen.getByText('ראשי').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('עסקאות').closest('a')).toHaveAttribute('href', '/transactions')
    expect(screen.getByText('ייבוא').closest('a')).toHaveAttribute('href', '/import')
    expect(screen.getByText('השקעות').closest('a')).toHaveAttribute('href', '/investments')
    expect(screen.getByText('דוחות').closest('a')).toHaveAttribute('href', '/reports')
  })
})
