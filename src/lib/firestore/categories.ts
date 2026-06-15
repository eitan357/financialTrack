import { getFirestore, collection, getDocs, addDoc, query, limit } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { Category } from '../types'

function getDb() { return getFirestore(app) }

export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(collection(getDb(), 'categories'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category))
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const ref = await addDoc(collection(getDb(), 'categories'), category)
  return { id: ref.id, ...category }
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
  const snap = await getDocs(query(collection(getDb(), 'categories'), limit(1)))
  if (!snap.empty) return
  for (const cat of DEFAULT_CATEGORIES) {
    await addDoc(collection(getDb(), 'categories'), cat)
  }
}
