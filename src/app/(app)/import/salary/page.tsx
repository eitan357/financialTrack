'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAccounts } from '@/lib/firestore/accounts'
import { getSalaryEntries, getSalaryEntry } from '@/lib/firestore/salary'
import { SalaryFlow } from '@/components/import/flows/SalaryFlow'
import type { Account, SalaryEntry } from '@/lib/types'

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthStr(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function SalaryPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const month = searchParams.get('month') ?? currentMonth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [existingEntries, setExistingEntries] = useState<SalaryEntry[]>([])
  const [previousSalary, setPreviousSalary] = useState<Omit<SalaryEntry, 'id'> | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [accs, entries, prevSal] = await Promise.all([
          getAccounts(),
          getSalaryEntries(month),
          getSalaryEntry(prevMonthStr(month)),
        ])
        setBankAccounts(accs.filter(a => a.type === 'bank' && a.isActive))
        setExistingEntries(entries)
        if (prevSal) {
          const { id: _id, ...rest } = prevSal
          setPreviousSalary(rest)
        }
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

  return (
    <main className="p-4 max-w-lg mx-auto">
      <SalaryFlow
        month={month}
        existingEntries={existingEntries}
        bankAccounts={bankAccounts}
        previousSalary={previousSalary}
        onDone={() => router.push(`/import?month=${month}`)}
      />
    </main>
  )
}

export default function SalaryPage() {
  return (
    <Suspense>
      <SalaryPageInner />
    </Suspense>
  )
}
