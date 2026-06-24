import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { InvestmentType, InvestmentEntry } from '../types'

function getDb() { return getFirestore(app) }

const TYPES_KEY = 'investment_types'
const entryKey = (month: string) => `investment_entries:${month}`

export async function getInvestmentTypes(): Promise<InvestmentType[]> {
  const cached = appCache.get<InvestmentType[]>(TYPES_KEY)
  if (cached !== undefined) return cached
  const snap = await getDocs(collection(getDb(), 'investment_types'))
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentType))
  appCache.set(TYPES_KEY, result)
  return result
}

export async function addInvestmentType(type: Omit<InvestmentType, 'id'>): Promise<InvestmentType> {
  const ref = await addDoc(collection(getDb(), 'investment_types'), type)
  appCache.del(TYPES_KEY)
  return { id: ref.id, ...type }
}

export async function getInvestmentEntries(month: string): Promise<InvestmentEntry[]> {
  const k = entryKey(month)
  const cached = appCache.get<InvestmentEntry[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'investment_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentEntry))
  appCache.set(k, result)
  return result
}

export async function addInvestmentEntry(entry: Omit<InvestmentEntry, 'id'>): Promise<InvestmentEntry> {
  const ref = await addDoc(collection(getDb(), 'investment_entries'), entry)
  appCache.del(entryKey(entry.month))
  return { id: ref.id, ...entry }
}

export async function deleteInvestmentEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_entries', id))
  appCache.delPrefix('investment_entries:')
}

export async function deleteInvestmentType(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_types', id))
  appCache.del(TYPES_KEY)
}
