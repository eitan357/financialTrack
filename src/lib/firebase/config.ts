import { initializeApp, getApps } from 'firebase/app'

// Turbopack replaces NEXT_PUBLIC_* vars statically — must use literal property access, not dynamic bracket notation
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) throw new Error('Missing env var: NEXT_PUBLIC_FIREBASE_API_KEY')
if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) throw new Error('Missing env var: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error('Missing env var: NEXT_PUBLIC_FIREBASE_PROJECT_ID')
if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) throw new Error('Missing env var: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) throw new Error('Missing env var: NEXT_PUBLIC_FIREBASE_APP_ID')

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const existingApps = getApps()
export const app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0]
