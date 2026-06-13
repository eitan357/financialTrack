import { renderHook } from '@testing-library/react'

const mockUnsubscribe = jest.fn()
const mockOnAuthStateChanged = jest.fn()
const mockGetAuthInstance = jest.fn(() => ({}))

jest.mock('@/lib/firebase/auth', () => ({
  getAuthInstance: () => mockGetAuthInstance(),
}))
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    mockOnAuthStateChanged(callback)
    return mockUnsubscribe
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockClear()
    mockUnsubscribe.mockClear()
    mockGetAuthInstance.mockClear()
  })

  it('starts with loading=true and user=null before Firebase responds', () => {
    mockOnAuthStateChanged.mockImplementation(() => {})
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('sets loading=false and user=null when not signed in', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => cb(null))
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('sets user when signed in', () => {
    const fakeUser = { uid: 'abc', email: 'test@test.com' }
    mockOnAuthStateChanged.mockImplementation((cb) => cb(fakeUser))
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toEqual(fakeUser)
    expect(result.current.loading).toBe(false)
  })

  it('calls unsubscribe on unmount', () => {
    mockOnAuthStateChanged.mockImplementation(() => {})
    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('calls getAuthInstance to get the auth object', () => {
    mockOnAuthStateChanged.mockImplementation(() => {})
    renderHook(() => useAuth())
    expect(mockGetAuthInstance).toHaveBeenCalledTimes(1)
  })
})
