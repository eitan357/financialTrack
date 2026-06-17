import { getFirestore, collection, getDocs, writeBatch, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { Transaction } from '../types'

function getDb() { return getFirestore(app) }

function cacheKey(month: string) { return `transactions:${month}` }

export async function getTransactions(month: string): Promise<Transaction[]> {
  const key = cacheKey(month)
  const cached = appCache.get<Transaction[]>(key)
  if (cached) return cached
  const q = query(
    collection(getDb(), 'transactions'),
    where('month', '==', month),
    orderBy('date', 'desc')
  )
  const snap = await getDocs(q)
  const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
  appCache.set(key, txs)
  return txs
}

export async function getTransactionsByMerchant(merchantName: string): Promise<Transaction[]> {
  const q = query(
    collection(getDb(), 'transactions'),
    where('merchantName', '==', merchantName)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
}

export async function addTransactions(transactions: Omit<Transaction, 'id'>[]): Promise<void> {
  if (transactions.length === 0) return
  const db = getDb()
  const batch = writeBatch(db)
  const colRef = collection(db, 'transactions')
  for (const tx of transactions) {
    batch.set(doc(colRef), tx)
  }
  await batch.commit()
  // Invalidate all affected months
  const months = [...new Set(transactions.map(t => t.month))]
  months.forEach(m => appCache.del(cacheKey(m)))
}

export async function updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id'>>): Promise<void> {
  await updateDoc(doc(getDb(), 'transactions', id), updates)
  // Don't know which month without a lookup — clear all transaction caches
  appCache.delPrefix('transactions:')
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'transactions', id))
  appCache.delPrefix('transactions:')
}

export async function getTransactionsForMonths(months: string[]): Promise<Transaction[]> {
  if (months.length === 0) return []
  const q = query(
    collection(getDb(), 'transactions'),
    where('month', 'in', months)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
}
