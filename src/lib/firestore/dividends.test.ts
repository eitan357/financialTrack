// src/lib/firestore/dividends.test.ts
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = jest.fn(() => 'doc-ref')
const mockCollection = jest.fn(() => 'col-ref')
const mockQuery = jest.fn(() => 'query-ref')
const mockWhere = jest.fn(() => 'where-ref')
const mockOrderBy = jest.fn(() => 'order-ref')
const mockLimit = jest.fn(() => 'limit-ref')

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
  doc: (...a: unknown[]) => mockDoc(...a),
  writeBatch: (...a: unknown[]) => mockWriteBatch(...a),
}))
jest.mock('@/lib/firebase/config', () => ({ app: {} }))
jest.mock('@/lib/cache', () => ({
  appCache: {
    get: jest.fn(() => undefined),
    set: jest.fn(),
    del: jest.fn(),
    delPrefix: jest.fn(),
  },
}))

import { getDividends, addDividend, deleteDividend } from './dividends'

beforeEach(() => jest.clearAllMocks())

const divData = { month: '2026-06', investmentTypeId: 'msty', amount: 150, currency: 'USD', ilsEquivalent: 555, date: '2026-06-15' }

describe('getDividends', () => {
  it('returns dividends for the month', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'd1', data: () => divData }] })
    const divs = await getDividends('2026-06')
    expect(divs[0]).toEqual({ id: 'd1', ...divData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })

  it('returns empty array when no dividends', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    expect(await getDividends('2026-06')).toEqual([])
  })

  it('caches results on second call', async () => {
    const { appCache } = jest.requireMock('@/lib/cache')
    appCache.get
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce([{ id: 'd1', ...divData }])

    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'd1', data: () => divData }] })

    await getDividends('2026-06')
    await getDividends('2026-06')
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
  })
})

describe('addDividend', () => {
  it('adds dividend and returns it with generated id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'd2' })
    const result = await addDividend(divData)
    expect(result).toEqual({ id: 'd2', ...divData })
  })
})

describe('deleteDividend', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined)
    await deleteDividend('d1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'dividends', 'd1')
  })
})
