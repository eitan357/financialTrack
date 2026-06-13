import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { app } from './config'

export const signInWithGoogle = () =>
  signInWithPopup(getAuth(app), new GoogleAuthProvider())

export const signOutUser = () => signOut(getAuth(app))

// Lazy getter — use only in 'use client' components
export const getAuthInstance = () => getAuth(app)
