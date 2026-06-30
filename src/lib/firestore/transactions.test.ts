// src/lib/firestore/transactions.test.ts
import { vi, beforeEach, describe, it, expect } from 'vitest'

const mockGetDocs = vi.fn()
const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockBatchSet = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)
const mockWriteBatch = vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockDoc = vi.fn(() => 'doc-ref')
const mockCollection = vi.fn(() => 'col-ref')
const mockQuery = vi.fn(() => 'query-ref')
const mockWhere = vi.fn(() => 'where-ref')
const mockOrderBy = vi.fn(() => 'order-ref')
const mockLimit = vi.fn(() => 'limit-ref')

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
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
vi.mock('@/lib/firebase/config', () => ({ app: {} }))

import { getTransactions, addTransactions, updateTransaction, deleteTransaction, getTransactionsForMonths, getInvestmentTransfers } from './transactions'

beforeEach(() => vi.clearAllMocks())

const mockTxData = { date: '2026-06-01', merchantName: 'שופרסל', amount: 150, currency: 'ILS', accountId: 'a1', source: 'csv_import' as const, isImmediate: false, month: '2026-06' }

describe('getTransactions', () => {
  it('queries by month and orders by date desc', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => mockTxData }] })
    const txs = await getTransactions('2026-06')
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
    expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc')
    expect(txs[0]).toEqual({ id: 't1', ...mockTxData })
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

describe('deleteTransaction', () => {
  it('calls deleteDoc on the correct document', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await deleteTransaction('tx1')
    expect(mockDoc).toHaveBeenCalledWith({}, 'transactions', 'tx1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
  })
})

describe('getTransactionsForMonths', () => {
  it('returns empty array for empty months list without calling Firestore', async () => {
    const result = await getTransactionsForMonths([])
    expect(result).toEqual([])
    expect(mockGetDocs).not.toHaveBeenCalled()
  })

  it('queries with in operator for multiple months', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => mockTxData }] })
    const result = await getTransactionsForMonths(['2026-05', '2026-06'])
    expect(mockWhere).toHaveBeenCalledWith('month', 'in', ['2026-05', '2026-06'])
    expect(result[0]).toEqual({ id: 't1', ...mockTxData })
  })
})

describe('getInvestmentTransfers', () => {
  it('returns only transactions with direction investment', async () => {
    mockGetDocs.mockResolvedValue({ docs: [
      { id: 't1', data: () => ({ ...mockTxData, direction: 'investment' }) },
      { id: 't2', data: () => ({ ...mockTxData, direction: 'expense' }) },
      { id: 't3', data: () => ({ ...mockTxData, direction: 'investment' }) }
    ] })
    const result = await getInvestmentTransfers('2026-06')
    expect(result.every(t => t.direction === 'investment')).toBe(true)
    expect(result).toHaveLength(2)
  })
})
