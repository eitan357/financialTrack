import { getFirestore, collection, getDocs, setDoc, doc, query, where, writeBatch, deleteDoc } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { SalaryEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getSalaryEntry(month: string): Promise<SalaryEntry | null> {
  const key = `salary:${month}`
  const cached = appCache.get<SalaryEntry | null>(key)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as SalaryEntry)
  appCache.set(key, result)
  return result
}

export async function deleteAllSalaryEntries(): Promise<number> {
  const db = getDb()
  const snap = await getDocs(collection(db, 'salary_entries'))
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  appCache.delPrefix('salary:')
  return snap.size
}

export async function getAllSalaryEntries(): Promise<SalaryEntry[]> {
  const snap = await getDocs(collection(getDb(), 'salary_entries'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryEntry))
}

export async function upsertSalaryEntry(entry: Omit<SalaryEntry, 'id'> & { id?: string }): Promise<SalaryEntry> {
  const { id, ...data } = entry
  const docRef = id
    ? doc(getDb(), 'salary_entries', id)
    : doc(collection(getDb(), 'salary_entries'))
  await setDoc(docRef, data, { merge: true })
  appCache.del(`salary:${data.month}`)
  return { id: docRef.id, ...data } as SalaryEntry
}

export async function getSalaryEntries(month: string): Promise<SalaryEntry[]> {
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryEntry))
}

export async function deleteSalaryEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'salary_entries', id))
  appCache.delPrefix('salary:')
}
