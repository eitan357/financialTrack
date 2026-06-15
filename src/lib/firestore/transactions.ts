import { getFirestore, collection, getDocs, writeBatch, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Transaction } from '../types'

function getDb() { return getFirestore(app) }

export async function getTransactions(month: string): Promise<Transaction[]> {
  const q = query(
    collection(getDb(), 'transactions'),
    where('month', '==', month),
    orderBy('date', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
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
}

export async function updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id'>>): Promise<void> {
  await updateDoc(doc(getDb(), 'transactions', id), updates)
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'transactions', id))
}
