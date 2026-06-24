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

import { getIncomeEntries, addIncomeEntry, deleteIncomeEntry } from './income'

beforeEach(() => jest.clearAllMocks())

const incomeData = { month: '2026-06', sourceName: 'מילואים', amount: 3000, currency: 'ILS', date: '2026-06-15' }

describe('getIncomeEntries', () => {
  it('returns income entries for the month', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'i1', data: () => incomeData }] })
    const entries = await getIncomeEntries('2026-06')
    expect(entries[0]).toEqual({ id: 'i1', ...incomeData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })

  it('caches results — getDocs called only once on second call', async () => {
    const { appCache } = jest.requireMock('@/lib/cache')
    appCache.get
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce([{ id: 'i1', month: '2026-06', sourceName: 'מילואים', amount: 3000, currency: 'ILS', date: '2026-06-15' }])

    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'i1', data: () => incomeData }] })

    await getIncomeEntries('2026-06')
    await getIncomeEntries('2026-06')
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
  })
})

describe('addIncomeEntry', () => {
  it('adds entry and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'i2' })
    const entry = await addIncomeEntry(incomeData)
    expect(entry).toEqual({ id: 'i2', ...incomeData })
  })
})

describe('deleteIncomeEntry', () => {
  it('calls deleteDoc on the correct document', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await deleteIncomeEntry('i1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
  })
})
