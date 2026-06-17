import {
  getFirestore, collection, getDocs, addDoc, doc, deleteDoc,
  query, limit, where, writeBatch, runTransaction,
} from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Category } from '../types'

function getDb() { return getFirestore(app) }

export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(collection(getDb(), 'categories'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Category))
    .filter(c => c.id !== '_seeded_v1')
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const ref = await addDoc(collection(getDb(), 'categories'), category)
  return { id: ref.id, ...category }
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
  const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore')
  await updateDoc(firestoreDoc(getDb(), 'categories', id), updates)
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'categories', id))
}

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'אוכל',           color: '#ef4444', isActive: true },
  { name: 'חשבונות',        color: '#f97316', isActive: true },
  { name: 'רפואה',          color: '#84cc16', isActive: true },
  { name: 'תחבורה',         color: '#06b6d4', isActive: true },
  { name: 'תחזוקה',         color: '#8b5cf6', isActive: true },
  { name: 'חופשים',         color: '#ec4899', isActive: true },
  { name: 'מתנות לעצמי',   color: '#f43f5e', isActive: true },
  { name: 'מתנות לאחרים',  color: '#e11d48', isActive: true },
  { name: 'קורסים וחוגים', color: '#a855f7', isActive: true },
  { name: 'סופש כיף',      color: '#6366f1', isActive: true },
  { name: 'בילויים',        color: '#3b82f6', isActive: true },
  { name: 'בגדים',          color: '#14b8a6', isActive: true },
  { name: 'אוכל בחוץ',     color: '#f59e0b', isActive: true },
  { name: 'השקעות',         color: '#10b981', isActive: true },
  { name: 'שכירות',         color: '#64748b', isActive: true },
]

export async function seedDefaultCategories(): Promise<void> {
  const db = getDb()
  const sentinelRef = doc(db, 'categories', '_seeded_v1')

  try {
    await runTransaction(db, async (tx) => {
      const sentinel = await tx.get(sentinelRef)
      if (sentinel.exists()) return
      tx.set(sentinelRef, { seeded: true })
      for (const cat of DEFAULT_CATEGORIES) {
        tx.set(doc(collection(db, 'categories')), cat)
      }
    })
  } catch {
    // already seeded or race condition — safe to ignore
  }
}

export async function cleanupDuplicateCategories(): Promise<{ deleted: number; txsFixed: number }> {
  const db = getDb()
  const allCats = await getCategories()

  const byName: Record<string, Category[]> = {}
  for (const cat of allCats) {
    byName[cat.name] = [...(byName[cat.name] ?? []), cat]
  }

  let deleted = 0
  let txsFixed = 0

  for (const dupes of Object.values(byName)) {
    if (dupes.length <= 1) continue
    dupes.sort((a, b) => a.id.localeCompare(b.id))
    const canonical = dupes[0]

    for (const dup of dupes.slice(1)) {
      const txSnap = await getDocs(
        query(collection(db, 'transactions'), where('categoryId', '==', dup.id))
      )

      const batch = writeBatch(db)
      txSnap.docs.forEach(d => batch.update(d.ref, { categoryId: canonical.id }))
      batch.delete(doc(db, 'categories', dup.id))
      await batch.commit()

      txsFixed += txSnap.size
      deleted++
    }
  }

  // Write sentinel so the seed won't re-run and create more duplicates
  const sentinelRef = doc(db, 'categories', '_seeded_v1')
  const sentinelSnap = await getDocs(query(collection(db, 'categories'), limit(1)))
  if (!sentinelSnap.empty) {
    const { setDoc } = await import('firebase/firestore')
    await setDoc(sentinelRef, { seeded: true })
  }

  return { deleted, txsFixed }
}
