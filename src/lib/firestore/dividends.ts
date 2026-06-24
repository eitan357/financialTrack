import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { Dividend } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `dividends:${month}`

export async function getDividends(month: string): Promise<Dividend[]> {
  const k = key(month)
  const cached = appCache.get<Dividend[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'dividends'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as Dividend))
  appCache.set(k, result)
  return result
}

export async function addDividend(dividend: Omit<Dividend, 'id'>): Promise<Dividend> {
  const ref = await addDoc(collection(getDb(), 'dividends'), dividend)
  appCache.del(key(dividend.month))
  return { id: ref.id, ...dividend }
}

export async function deleteDividend(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'dividends', id))
  appCache.delPrefix('dividends:')
}
