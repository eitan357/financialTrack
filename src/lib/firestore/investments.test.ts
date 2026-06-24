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

import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry, deleteInvestmentEntry, deleteInvestmentType } from './investments'

beforeEach(() => jest.clearAllMocks())

describe('getInvestmentTypes', () => {
  it('returns all investment types', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 't1', data: () => ({ name: 'MSTY', currency: 'USD' }) }],
    })
    const types = await getInvestmentTypes()
    expect(types[0]).toEqual({ id: 't1', name: 'MSTY', currency: 'USD' })
  })

  it('uses cache on second call', async () => {
    const { appCache } = jest.requireMock('@/lib/cache')
    const cached = [{ id: 't1', name: 'MSTY', currency: 'USD' }]
    appCache.get
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(cached)
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 't1', data: () => ({ name: 'MSTY', currency: 'USD' }) }] })

    await getInvestmentTypes()
    await getInvestmentTypes()
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
  })
})

describe('addInvestmentType', () => {
  it('adds type and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 't2' })
    const result = await addInvestmentType({ name: 'Headstart', currency: 'ILS' })
    expect(result).toEqual({ id: 't2', name: 'Headstart', currency: 'ILS' })
  })
})

describe('getInvestmentEntries', () => {
  it('queries by month and maps docs', async () => {
    const entryData = { date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 5000, currency: 'ILS' }
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'e1', data: () => entryData }] })
    const entries = await getInvestmentEntries('2026-06')
    expect(entries[0]).toEqual({ id: 'e1', ...entryData })
    expect(mockWhere).toHaveBeenCalledWith('month', '==', '2026-06')
  })

  it('uses cache on second call', async () => {
    const { appCache } = jest.requireMock('@/lib/cache')
    const entryData = { date: '2026-06-01', month: '2026-06', investmentTypeId: 't1', amount: 5000, currency: 'ILS' }
    appCache.get
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce([{ id: 'e1', ...entryData }])
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'e1', data: () => entryData }] })

    await getInvestmentEntries('2026-06')
    await getInvestmentEntries('2026-06')
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
  })
})

describe('addInvestmentEntry', () => {
  it('adds entry and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'e2' })
    const entry = { date: '2026-06-10', month: '2026-06', investmentTypeId: 't1', amount: 1000, currency: 'ILS' }
    const result = await addInvestmentEntry(entry)
    expect(result).toEqual({ id: 'e2', ...entry })
  })
})

describe('deleteInvestmentEntry', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined)
    await deleteInvestmentEntry('e1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'investment_entries', 'e1')
  })
})

describe('deleteInvestmentType', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined)
    await deleteInvestmentType('t1')
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'investment_types', 't1')
  })
})
