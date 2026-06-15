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

import { getSalaryEntry, upsertSalaryEntry } from './salary'

beforeEach(() => jest.clearAllMocks())

const salaryData = { month: '2026-06', employerName: 'חברה', grossAmount: 15000, deductions: { incomeTax: 2000, nationalInsurance: 500, healthInsurance: 100, pension: 1500, trainingFund: 750 }, netAmount: 10150 }

describe('getSalaryEntry', () => {
  it('returns null when no entry exists for the month', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    expect(await getSalaryEntry('2026-06')).toBeNull()
  })

  it('returns the salary entry when it exists', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 's1', data: () => salaryData }] })
    const entry = await getSalaryEntry('2026-06')
    expect(entry).toEqual({ id: 's1', ...salaryData })
  })
})

describe('upsertSalaryEntry', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await upsertSalaryEntry(salaryData)
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', salaryData, { merge: true })
  })
})
