import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { IncomeEntry } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `income:${month}`

export async function getIncomeEntries(month: string): Promise<IncomeEntry[]> {
  const k = key(month)
  const cached = appCache.get<IncomeEntry[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'income_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeEntry))
  appCache.set(k, result)
  return result
}

export async function addIncomeEntry(entry: Omit<IncomeEntry, 'id'>): Promise<IncomeEntry> {
  const ref = await addDoc(collection(getDb(), 'income_entries'), entry)
  appCache.del(key(entry.month))
  return { id: ref.id, ...entry }
}

export async function deleteIncomeEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'income_entries', id))
  appCache.delPrefix('income:')
}

export async function deleteAllIncomeEntries(): Promise<number> {
  const db = getDb()
  const snap = await getDocs(collection(db, 'income_entries'))
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  appCache.delPrefix('income:')
  return snap.size
}
