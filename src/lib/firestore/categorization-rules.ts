import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { CategorizationRule } from '../types'

const CACHE_KEY = 'rules'

function getDb() { return getFirestore(app) }

export async function getRules(): Promise<CategorizationRule[]> {
  const cached = appCache.get<CategorizationRule[]>(CACHE_KEY)
  if (cached) return cached
  const q = query(collection(getDb(), 'categorization_rules'), orderBy('priority', 'desc'))
  const snap = await getDocs(q)
  const rules = snap.docs.map(d => ({ id: d.id, ...d.data() } as CategorizationRule))
  appCache.set(CACHE_KEY, rules)
  return rules
}

export async function addRule(rule: Omit<CategorizationRule, 'id'>): Promise<CategorizationRule> {
  appCache.del(CACHE_KEY)
  const ref = await addDoc(collection(getDb(), 'categorization_rules'), rule)
  return { id: ref.id, ...rule }
}

export async function updateRule(id: string, updates: Partial<Omit<CategorizationRule, 'id'>>): Promise<void> {
  appCache.del(CACHE_KEY)
  await updateDoc(doc(getDb(), 'categorization_rules', id), updates)
}

export async function deleteRule(id: string): Promise<void> {
  appCache.del(CACHE_KEY)
  await deleteDoc(doc(getDb(), 'categorization_rules', id))
}
