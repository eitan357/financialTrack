import { getFirestore, collection, getDocs, addDoc, query, limit } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Account } from '../types'

function getDb() { return getFirestore(app) }

export async function getAccounts(): Promise<Account[]> {
  const snap = await getDocs(collection(getDb(), 'accounts'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account))
}

export async function addAccount(account: Omit<Account, 'id'>): Promise<Account> {
  const ref = await addDoc(collection(getDb(), 'accounts'), account)
  return { id: ref.id, ...account }
}

const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { name: 'אשראי בהצדעה',  type: 'credit', last4digits: '8729', color: '#f59e0b', isActive: true },
  { name: 'אשראי One Zero', type: 'credit',                      color: '#3b82f6', isActive: true },
  { name: 'בנק One Zero',   type: 'bank',                        color: '#10b981', isActive: true },
  { name: 'בנק לאומי',      type: 'bank',                        color: '#6366f1', isActive: true },
  { name: 'מזומן',          type: 'cash',                        color: '#94a3b8', isActive: true },
]

export async function seedDefaultAccounts(): Promise<void> {
  const snap = await getDocs(query(collection(getDb(), 'accounts'), limit(1)))
  if (!snap.empty) return
  for (const account of DEFAULT_ACCOUNTS) {
    await addDoc(collection(getDb(), 'accounts'), account)
  }
}
