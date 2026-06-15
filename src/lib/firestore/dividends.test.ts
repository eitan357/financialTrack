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

import { getDividends, addDividend } from './dividends'

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
})

describe('addDividend', () => {
  it('adds dividend and returns it with generated id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'd2' })
    const result = await addDividend(divData)
    expect(result).toEqual({ id: 'd2', ...divData })
  })
})
