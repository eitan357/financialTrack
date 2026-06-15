import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { CategorizationRule } from '../types'

function getDb() { return getFirestore(app) }

export async function getRules(): Promise<CategorizationRule[]> {
  const q = query(collection(getDb(), 'categorization_rules'), orderBy('priority', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CategorizationRule))
}

export async function addRule(rule: Omit<CategorizationRule, 'id'>): Promise<CategorizationRule> {
  const ref = await addDoc(collection(getDb(), 'categorization_rules'), rule)
  return { id: ref.id, ...rule }
}

export async function updateRule(id: string, updates: Partial<Omit<CategorizationRule, 'id'>>): Promise<void> {
  await updateDoc(doc(getDb(), 'categorization_rules', id), updates)
}

export async function deleteRule(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'categorization_rules', id))
}
