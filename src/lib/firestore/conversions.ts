import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { InvestmentConversion } from '../types'

function getDb() { return getFirestore(app) }

const convKey = (month: string) => `investment_conversions:${month}`
const convYearKey = (year: string) => `investment_conversions_year:${year}`

export async function getInvestmentConversions(month: string): Promise<InvestmentConversion[]> {
  const k = convKey(month)
  const cached = appCache.get<InvestmentConversion[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'investment_conversions'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentConversion))
  appCache.set(k, result)
  return result
}

export async function getInvestmentConversionsByYear(year: string): Promise<InvestmentConversion[]> {
  const k = convYearKey(year)
  const cached = appCache.get<InvestmentConversion[]>(k)
  if (cached !== undefined) return cached
  const q = query(
    collection(getDb(), 'investment_conversions'),
    where('month', '>=', `${year}-01`),
    where('month', '<=', `${year}-12`)
  )
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentConversion))
  appCache.set(k, result)
  return result
}

export async function addInvestmentConversion(conv: Omit<InvestmentConversion, 'id'>): Promise<InvestmentConversion> {
  const ref = await addDoc(collection(getDb(), 'investment_conversions'), conv)
  appCache.del(convKey(conv.month))
  appCache.del(convYearKey(conv.month.slice(0, 4)))
  return { id: ref.id, ...conv }
}

export async function deleteInvestmentConversion(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_conversions', id))
  appCache.delPrefix('investment_conversions:')
  appCache.delPrefix('investment_conversions_year:')
}
