import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
    mockSignInWithGoogle.mockResolvedValue(undefined)
  })

  it('renders the Google sign-in button with Hebrew label', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /כניסה עם Google/i })).toBeInTheDocument()
  })

  it('calls signInWithGoogle when button is clicked', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /כניסה עם Google/i }))
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1))
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

  it('shows Hebrew error message when sign-in fails', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('popup closed'))
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /כניסה עם Google/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('הכניסה נכשלה. אנא נסה שוב.')
    )
  })
})
