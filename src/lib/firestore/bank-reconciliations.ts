import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { BankReconciliation } from '../types'

function getDb() { return getFirestore(app) }

export async function getBankReconciliations(month: string): Promise<BankReconciliation[]> {
  const q = query(collection(getDb(), 'bank_reconciliations'), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation))
}

export async function saveBankReconciliation(rec: Omit<BankReconciliation, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = rec
  const docRef = id
    ? doc(getDb(), 'bank_reconciliations', id)
    : doc(collection(getDb(), 'bank_reconciliations'))
  await setDoc(docRef, data, { merge: true })
}
