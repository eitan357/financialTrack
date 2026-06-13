'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signInWithGoogle } from '@/lib/firebase/auth'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Financial Track</h1>
        <p className="text-slate-400">מעקב פיננסי חודשי</p>
      </div>
      <button
        onClick={signInWithGoogle}
        className="w-full max-w-sm bg-accent hover:bg-indigo-500 text-white py-4 rounded-xl font-medium transition-colors"
      >
        כניסה עם Google
      </button>
    </main>
  )
}
