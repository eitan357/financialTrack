// src/lib/firestore/monthly-settings.test.ts
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

import { getMonthlySettings, upsertMonthlySettings } from './monthly-settings'

beforeEach(() => jest.clearAllMocks())

const settingsData = { month: '2026-06', categoryTargets: { c1: 1500, c2: 800 } }

describe('getMonthlySettings', () => {
  it('returns null when no settings for the month', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    expect(await getMonthlySettings('2026-06')).toBeNull()
  })

  it('returns settings when they exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 's1', data: () => settingsData }] })
    const result = await getMonthlySettings('2026-06')
    expect(result).toEqual({ id: 's1', ...settingsData })
  })
})

describe('upsertMonthlySettings', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined)
    await upsertMonthlySettings(settingsData)
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', settingsData, { merge: true })
  })
})
