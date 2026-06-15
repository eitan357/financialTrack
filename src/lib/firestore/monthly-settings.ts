import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import type { MonthlySettings } from '../types'

function getDb() { return getFirestore(app) }

export async function getMonthlySettings(month: string): Promise<MonthlySettings | null> {
  const q = query(collection(getDb(), 'monthly_settings'), where('month', '==', month))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as MonthlySettings
}

export async function upsertMonthlySettings(settings: Omit<MonthlySettings, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = settings
  const docRef = id
    ? doc(getDb(), 'monthly_settings', id)
    : doc(collection(getDb(), 'monthly_settings'))
  await setDoc(docRef, data, { merge: true })
}
