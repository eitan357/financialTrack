// src/lib/firestore/transactions.test.ts
const mockGetDocs = jest.fn()
const mockAddDoc = jest.fn()
const mockUpdateDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockSetDoc = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn().mockResolvedValue(undefined)
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

import { getTransactions, getTransactionsByMerchant, addTransactions, updateTransaction } from './transactions'

beforeEach(() => jest.clearAllMocks())

const mockTxData = { date: '2026-06-01', merchantName: 'שופרסל', amount: 150, currency: 'ILS', accountId: 'a1', source: 'csv_import', isImmediate: false, month: '2026-06' }

describe('getTransactions', () => {
  it('queries by month and orders by date desc', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => mockTxData }] })
    const txs = await getTransactions('2026-06')
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc')
    expect(txs[0]).toEqual({ id: 't1', ...mockTxData })
  })
})

describe('getTransactionsByMerchant', () => {
  it('queries by merchantName', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    await getTransactionsByMerchant('שופרסל')
    expect(mockWhere).toHaveBeenCalledWith('merchantName', '==', 'שופרסל')
  })
})

describe('addTransactions', () => {
  it('does nothing for empty array', async () => {
    await addTransactions([])
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })

  it('uses writeBatch and calls set once per transaction', async () => {
    await addTransactions([mockTxData, mockTxData])
    expect(mockWriteBatch).toHaveBeenCalledTimes(1)
    expect(mockBatchSet).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })
})

describe('updateTransaction', () => {
  it('calls updateDoc on the correct document', async () => {
    mockUpdateDoc.mockResolvedValue(undefined)
    await updateTransaction('t1', { categoryId: 'c1' })
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { categoryId: 'c1' })
  })
})
