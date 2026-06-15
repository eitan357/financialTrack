import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { SalaryEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getSalaryEntry(month: string): Promise<SalaryEntry | null> {
  const q = query(collection(getDb(), 'salary_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as SalaryEntry
}

export async function upsertSalaryEntry(entry: Omit<SalaryEntry, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = entry
  const docRef = id
    ? doc(getDb(), 'salary_entries', id)
    : doc(collection(getDb(), 'salary_entries'))
  await setDoc(docRef, data, { merge: true })
}
