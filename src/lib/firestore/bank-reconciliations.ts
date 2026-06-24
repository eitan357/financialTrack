import { getFirestore, collection, getDocs, setDoc, doc, query, where, writeBatch } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { BankReconciliation } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `bank_recs:${month}`

export async function getBankReconciliations(month: string): Promise<BankReconciliation[]> {
  const k = key(month)
  const cached = appCache.get<BankReconciliation[]>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
  appCache.set(k, result)
  return result
}

export async function getBankReconciliationsForMonths(months: string[]): Promise<BankReconciliation[]> {
  if (months.length === 0) return []
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', 'in', months))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
}

export async function saveBankReconciliation(rec: Omit<BankReconciliation, 'id'> & { id?: string }): Promise<BankReconciliation> {
  const { id, ...data } = rec
  const docRef = id
    ? doc(getDb(), 'bank_reconciliations', id)
    : doc(collection(getDb(), 'bank_reconciliations'))
  await setDoc(docRef, data, { merge: true })
  appCache.del(key(data.month))
  return { id: docRef.id, ...data }
}

export async function deleteAllBankReconciliations(): Promise<number> {
  const snap = await getDocs(collection(getDb(), 'bank_reconciliations'))
  const batch = writeBatch(getDb())
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  appCache.delPrefix('bank_recs:')
  return snap.size
}
