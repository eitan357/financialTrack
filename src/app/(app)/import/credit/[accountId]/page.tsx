'use client'
import { Suspense, useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getAccounts } from '@/lib/firestore/accounts'
import { getCategories } from '@/lib/firestore/categories'
import { getRules } from '@/lib/firestore/categorization-rules'
import { getTransactions } from '@/lib/firestore/transactions'
import { CreditFlow } from '@/components/import/flows/CreditFlow'
import type { Account, Category, CategorizationRule, Transaction } from '@/lib/types'

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function CreditPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountId = params.accountId as string
  const month = searchParams.get('month') ?? currentMonth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [existingTransactions, setExistingTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [accs, cats, rls, txs] = await Promise.all([
          getAccounts(),
          getCategories(),
          getRules(),
          getTransactions(month),
        ])
        const acc = accs.find(a => a.id === accountId)
        if (!acc) { router.replace('/import'); return }
        setAccount(acc)
        setCategories(cats)
        setRules(rls)
        setPreviousTransactions(txs)
        setExistingTransactions(txs.filter(t => t.accountId === accountId))
      } catch {
        setError('שגיאה בטעינת הנתונים.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accountId, month, router])

  if (loading) return <main className="p-4 max-w-lg mx-auto"><div className="flex justify-center items-center min-h-40"><p className="text-slate-400">טוען...</p></div></main>
  if (error) return <main className="p-4 max-w-lg mx-auto"><p className="text-red-400 text-sm">{error}</p></main>
  if (!account) return null

  return (
    <main className="p-4 max-w-lg mx-auto">
      <CreditFlow
        month={month}
        accountId={accountId}
        accountName={account.name}
        categories={categories}
        rules={rules}
        previousTransactions={previousTransactions}
        existingTransactions={existingTransactions}
        onDone={() => router.push(`/import?month=${month}`)}
      />
    </main>
  )
}

export default function CreditPage() {
  return (
    <Suspense>
      <CreditPageInner />
    </Suspense>
  )
}
