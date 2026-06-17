import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
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

export async function upsertSalaryEntry(entry: Omit<SalaryEntry, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = entry
  const docRef = id
    ? doc(getDb(), 'salary_entries', id)
    : doc(collection(getDb(), 'salary_entries'))
  await setDoc(docRef, data, { merge: true })
  appCache.del(`salary:${data.month}`)
}
