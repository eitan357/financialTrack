import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { BankReconciliation } from '../types'

function getDb() { return getFirestore(app) }

export async function getBankReconciliations(month: string): Promise<BankReconciliation[]> {
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
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
  return { id: docRef.id, ...data }
}

export async function deleteAllBankReconciliations(): Promise<void> {
  const snap = await getDocs(collection(getDb(), 'bank_reconciliations'))
  const batch = writeBatch(getDb())
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}
