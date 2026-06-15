import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Dividend } from '../types'

function getDb() { return getFirestore(app) }

export async function getDividends(month: string): Promise<Dividend[]> {
  const q = query(collection(getDb(), 'dividends'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Dividend))
}

export async function addDividend(dividend: Omit<Dividend, 'id'>): Promise<Dividend> {
  const ref = await addDoc(collection(getDb(), 'dividends'), dividend)
  return { id: ref.id, ...dividend }
}
