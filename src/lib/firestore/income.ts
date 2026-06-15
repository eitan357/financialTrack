import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { IncomeEntry } from '../types'

function getDb() { return getFirestore(app) }

export async function getIncomeEntries(month: string): Promise<IncomeEntry[]> {
  const q = query(collection(getDb(), 'income_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeEntry))
}

export async function addIncomeEntry(entry: Omit<IncomeEntry, 'id'>): Promise<IncomeEntry> {
  const ref = await addDoc(collection(getDb(), 'income_entries'), entry)
  return { id: ref.id, ...entry }
}

export async function deleteIncomeEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'income_entries', id))
}
