import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { InvestmentType, InvestmentEntry } from '../types'

function getDb() {
  return getFirestore(app)
}

export async function getInvestmentTypes(): Promise<InvestmentType[]> {
  const snap = await getDocs(collection(getDb(), 'investment_types'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentType))
}

export async function addInvestmentType(type: Omit<InvestmentType, 'id'>): Promise<InvestmentType> {
  const ref = await addDoc(collection(getDb(), 'investment_types'), type)
  return { id: ref.id, ...type }
}

export async function getInvestmentEntries(month: string): Promise<InvestmentEntry[]> {
  const q = query(collection(getDb(), 'investment_entries'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentEntry))
}

export async function addInvestmentEntry(entry: Omit<InvestmentEntry, 'id'>): Promise<InvestmentEntry> {
  const ref = await addDoc(collection(getDb(), 'investment_entries'), entry)
  return { id: ref.id, ...entry }
}
