import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { InvestmentType, InvestmentEntry, Account } from '../types'
import { getAccounts, addAccount } from './accounts'

function getDb() { return getFirestore(app) }

const TYPES_KEY = 'investment_types'
const entryKey = (month: string) => `investment_entries:${month}`
const entryYearKey = (year: string) => `investment_entries_year:${year}`

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
  appCache.del(entryYearKey(entry.month.slice(0, 4)))
  return { id: ref.id, ...entry }
}

export async function deleteInvestmentEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_entries', id))
  appCache.delPrefix('investment_entries:')
  appCache.delPrefix('investment_entries_year:')
}

export async function deleteInvestmentType(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'investment_types', id))
  appCache.del(TYPES_KEY)
}

// Portfolio helpers — derive from already-cached getAccounts, no extra cache needed
export async function getInvestmentPortfolios(): Promise<Account[]> {
  const accs = await getAccounts()
  return accs.filter(a => a.type === 'investment')
}

export async function addInvestmentPortfolio(name: string, color: string): Promise<Account> {
  return addAccount({ name, type: 'investment', color, isActive: true })
}

// Derives from already-cached getInvestmentTypes
export async function getInvestmentTypesByPortfolio(portfolioId: string): Promise<InvestmentType[]> {
  const types = await getInvestmentTypes()
  return types.filter(t => t.portfolioAccountId === portfolioId)
}

// Year-based entry query
export async function getInvestmentEntriesByYear(year: string): Promise<InvestmentEntry[]> {
  const k = entryYearKey(year)
  const cached = appCache.get<InvestmentEntry[]>(k)
  if (cached !== undefined) return cached
  const q = query(
    collection(getDb(), 'investment_entries'),
    where('month', '>=', `${year}-01`),
    where('month', '<=', `${year}-12`)
  )
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentEntry))
  appCache.set(k, result)
  return result
}
