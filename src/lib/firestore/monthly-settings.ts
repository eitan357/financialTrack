import { getFirestore, collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { app } from '../firebase/config'
import { appCache } from '../cache'
import type { MonthlySettings } from '../types'

function getDb() { return getFirestore(app) }
const key = (month: string) => `monthly_settings:${month}`

export async function getMonthlySettings(month: string): Promise<MonthlySettings | null> {
  const k = key(month)
  const cached = appCache.get<MonthlySettings | null>(k)
  if (cached !== undefined) return cached
  const q = query(collection(getDb(), 'monthly_settings'), where('month', '==', month))
  const snap = await getDocs(q)
  const result = snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as MonthlySettings)
  appCache.set(k, result)
  return result
}

export async function upsertMonthlySettings(settings: Omit<MonthlySettings, 'id'> & { id?: string }): Promise<void> {
  const { id, ...data } = settings
  const docRef = id
    ? doc(getDb(), 'monthly_settings', id)
    : doc(collection(getDb(), 'monthly_settings'))
  await setDoc(docRef, data, { merge: true })
  appCache.del(key(data.month))
}
