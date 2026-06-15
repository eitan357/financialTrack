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

import { getBankReconciliations, saveBankReconciliation } from './bank-reconciliations'

beforeEach(() => jest.clearAllMocks())

const recData = { month: '2026-06', accountId: 'a3', actualBalance: 12500, expectedBalance: 12480, date: '2026-06-03' }

describe('getBankReconciliations', () => {
  it('returns reconciliations for the month', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'r1', data: () => recData }] })
    const recs = await getBankReconciliations('2026-06')
    expect(recs[0]).toEqual({ id: 'r1', ...recData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })

  it('returns empty array when no reconciliations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    expect(await getBankReconciliations('2026-06')).toEqual([])
  })
})

describe('saveBankReconciliation', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await saveBankReconciliation(recData)
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', recData, { merge: true })
  })

  it('calls setDoc with the provided id when id is given', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await saveBankReconciliation({ id: 'r1', ...recData })
    expect(mockDoc).toHaveBeenCalledWith({}, 'bank_reconciliations', 'r1')
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', recData, { merge: true })
  })
})
