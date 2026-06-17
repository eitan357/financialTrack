import {
  getFirestore, collection, getDocs, addDoc, doc, updateDoc, setDoc,
  query, where, writeBatch, runTransaction,
} from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { Account } from '../types'

const CACHE_KEY = 'accounts'

function getDb() { return getFirestore(app) }

export async function getAccounts(): Promise<Account[]> {
  const cached = appCache.get<Account[]>(CACHE_KEY)
  if (cached) return cached
  const snap = await getDocs(collection(getDb(), 'accounts'))
  const accs = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Account))
    .filter(a => a.id !== '_seeded_v1')
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
  appCache.set(CACHE_KEY, accs)
  return accs
}

export async function addAccount(account: Omit<Account, 'id'>): Promise<Account> {
  appCache.del(CACHE_KEY)
  const ref = await addDoc(collection(getDb(), 'accounts'), account)
  return { id: ref.id, ...account }
}

export async function updateAccount(id: string, updates: Partial<Omit<Account, 'id'>>): Promise<void> {
  appCache.del(CACHE_KEY)
  await updateDoc(doc(getDb(), 'accounts', id), updates)
}

const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { name: 'אשראי בהצדעה',  type: 'credit', last4digits: '8729', color: '#f59e0b', isActive: true, csvIdentifier: 'הצדעה' },
  { name: 'אשראי One Zero', type: 'credit',                      color: '#3b82f6', isActive: true, csvIdentifier: 'one zero' },
  { name: 'בנק One Zero',   type: 'bank',                        color: '#10b981', isActive: true },
  { name: 'בנק לאומי',      type: 'bank',                        color: '#6366f1', isActive: true },
  { name: 'מזומן',          type: 'cash',                        color: '#94a3b8', isActive: true },
]

export async function seedDefaultAccounts(): Promise<void> {
  if (appCache.get<boolean>('_seed:accounts')) return
  const db = getDb()
  const sentinelRef = doc(db, 'accounts', '_seeded_v1')
  try {
    await runTransaction(db, async (tx) => {
      const sentinel = await tx.get(sentinelRef)
      if (sentinel.exists()) return
      tx.set(sentinelRef, { seeded: true })
      for (const account of DEFAULT_ACCOUNTS) {
        tx.set(doc(collection(db, 'accounts')), account)
      }
    })
  } catch {
    // already seeded or race condition — safe to ignore
  }
  appCache.set('_seed:accounts', true, 60 * 60_000)
}

export async function cleanupDuplicateAccounts(): Promise<{ deleted: number; txsFixed: number }> {
  const db = getDb()
  appCache.del(CACHE_KEY)
  const allAccounts = await getAccounts()

  const byName: Record<string, Account[]> = {}
  for (const acc of allAccounts) {
    byName[acc.name] = [...(byName[acc.name] ?? []), acc]
  }

  let deleted = 0
  let txsFixed = 0

  for (const dupes of Object.values(byName)) {
    if (dupes.length <= 1) continue
    dupes.sort((a, b) => a.id.localeCompare(b.id))
    const canonical = dupes[0]

    for (const dup of dupes.slice(1)) {
      const txSnap = await getDocs(
        query(collection(db, 'transactions'), where('accountId', '==', dup.id))
      )
      const batch = writeBatch(db)
      txSnap.docs.forEach(d => batch.update(d.ref, { accountId: canonical.id }))
      batch.delete(doc(db, 'accounts', dup.id))
      await batch.commit()
      txsFixed += txSnap.size
      deleted++
    }
  }

  await setDoc(doc(db, 'accounts', '_seeded_v1'), { seeded: true })
  appCache.del(CACHE_KEY)
  appCache.delPrefix('transactions:')
  return { deleted, txsFixed }
}
