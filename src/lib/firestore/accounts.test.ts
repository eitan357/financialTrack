// src/lib/firestore/accounts.test.ts
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

import { getAccounts, addAccount, seedDefaultAccounts } from './accounts'

beforeEach(() => jest.clearAllMocks())

describe('getAccounts', () => {
  it('returns mapped accounts from Firestore', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'a1', data: () => ({ name: 'אשראי בהצדעה', type: 'credit', color: '#f59e0b', isActive: true }) }],
    })
    const accounts = await getAccounts()
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toEqual({ id: 'a1', name: 'אשראי בהצדעה', type: 'credit', color: '#f59e0b', isActive: true })
  })
})

describe('addAccount', () => {
  it('adds account and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new1' })
    const account = await addAccount({ name: 'מזומן', type: 'cash', color: '#94a3b8', isActive: true })
    expect(account).toEqual({ id: 'new1', name: 'מזומן', type: 'cash', color: '#94a3b8', isActive: true })
  })
})

describe('seedDefaultAccounts', () => {
  it('does not seed when accounts already exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 'existing' }] })
    await seedDefaultAccounts()
    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it('seeds exactly 5 default accounts when collection is empty', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    mockAddDoc.mockResolvedValue({ id: 'new' })
    await seedDefaultAccounts()
    expect(mockAddDoc).toHaveBeenCalledTimes(5)
  })
})
