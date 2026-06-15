// src/lib/firestore/categorization-rules.test.ts
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

import { getRules, addRule, updateRule, deleteRule } from './categorization-rules'

beforeEach(() => jest.clearAllMocks())

describe('getRules', () => {
  it('returns rules ordered by priority desc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'r1', data: () => ({ keyword: 'שופרסל', matchType: 'contains', categoryId: 'c1', priority: 5, createdAt: '2026-01-01' }) },
      ],
    })
    const rules = await getRules()
    expect(rules[0]).toEqual({ id: 'r1', keyword: 'שופרסל', matchType: 'contains', categoryId: 'c1', priority: 5, createdAt: '2026-01-01' })
    expect(mockOrderBy).toHaveBeenCalledWith('priority', 'desc')
  })
})

describe('addRule', () => {
  it('adds rule and returns it with generated id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'r2' })
    const rule = await addRule({ keyword: 'YES', matchType: 'exact', categoryId: 'c2', priority: 1, createdAt: '2026-06-01' })
    expect(rule.id).toBe('r2')
    expect(rule.keyword).toBe('YES')
  })
})

describe('updateRule', () => {
  it('calls updateDoc on the correct document', async () => {
    mockUpdateDoc.mockResolvedValue(undefined)
    await updateRule('r1', { priority: 10 })
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { priority: 10 })
  })
})

describe('deleteRule', () => {
  it('calls deleteDoc on the correct document', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await deleteRule('r1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
  })
})
