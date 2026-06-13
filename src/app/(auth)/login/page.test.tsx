import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockUseAuth = jest.fn()
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

const mockSignInWithGoogle = jest.fn()
jest.mock('@/lib/firebase/auth', () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
}))

import LoginPage from './page'

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockPush.mockClear()
    mockSignInWithGoogle.mockClear()
  })

  it('renders the Google sign-in button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls signInWithGoogle when button is clicked', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /google/i }))
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('redirects to /dashboard when already signed in', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '123' }, loading: false })
    render(<LoginPage />)
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('does not redirect while auth state is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(<LoginPage />)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
