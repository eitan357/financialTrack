'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAccounts } from '@/lib/firestore/accounts'
import { getCategories } from '@/lib/firestore/categories'
import { getTransactions } from '@/lib/firestore/transactions'
import { CashFlow } from '@/components/import/flows/CashFlow'
import type { Account, Category, Transaction } from '@/lib/types'

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function CashPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const month = searchParams.get('month') ?? currentMonth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cashAccount, setCashAccount] = useState<Account | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [existingTransactions, setExistingTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [accs, cats, txs] = await Promise.all([
          getAccounts(),
          getCategories(),
          getTransactions(month),
        ])
        const cash = accs.find(a => a.type === 'cash' && a.isActive)
        setCashAccount(cash ?? null)
        setCategories(cats)
        setExistingTransactions(cash ? txs.filter(t => t.accountId === cash.id) : [])
      } catch {
        setError('שגיאה בטעינת הנתונים.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  if (loading) return <main className="p-4 max-w-lg mx-auto"><div className="flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></div></main>
  if (error) return <main className="p-4 max-w-lg mx-auto"><p className="text-red-400 text-sm">{error}</p></main>
  if (!cashAccount) return <main className="p-4 max-w-lg mx-auto"><p className="text-slate-400 text-sm text-center pt-8">אין חשבון מזומן פעיל</p></main>

  return (
    <main className="p-4 max-w-lg mx-auto">
      <CashFlow
        month={month}
        cashAccountId={cashAccount.id}
        categories={categories}
        existingTransactions={existingTransactions}
        onDone={() => router.push(`/import?month=${month}`)}
      />
    </main>
  )
}

export default function CashPage() {
  return (
    <Suspense>
      <CashPageInner />
    </Suspense>
  )
}
