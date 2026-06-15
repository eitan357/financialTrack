// src/lib/firestore/categories.test.ts
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

import { getCategories, seedDefaultCategories } from './categories'

beforeEach(() => jest.clearAllMocks())

describe('getCategories', () => {
  it('returns mapped categories', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'c1', data: () => ({ name: 'אוכל', color: '#ef4444', isActive: true }) }],
    })
    const cats = await getCategories()
    expect(cats[0]).toEqual({ id: 'c1', name: 'אוכל', color: '#ef4444', isActive: true })
  })
})

describe('seedDefaultCategories', () => {
  it('does not seed when categories already exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 'existing' }] })
    await seedDefaultCategories()
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('seeds exactly 15 default categories when collection is empty', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    mockAddDoc.mockResolvedValue({ id: 'new' })
    await seedDefaultCategories()
    expect(mockAddDoc).toHaveBeenCalledTimes(15)
  })
})
