import { render, screen } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockUseAuth = jest.fn()
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

import { AuthGuard } from './AuthGuard'

describe('AuthGuard', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('shows loading indicator while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('redirects to /login when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '123' }, loading: false })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(screen.getByText('Protected')).toBeInTheDocument()
  })

  it('does not redirect while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
