'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry, deleteInvestmentEntry, deleteInvestmentType, getInvestmentPortfolios } from '@/lib/firestore/investments'
import { getDividends, addDividend, deleteDividend } from '@/lib/firestore/dividends'
import { AddInvestmentEntryForm } from '@/components/investments/AddInvestmentEntryForm'
import { AddDividendForm } from '@/components/investments/AddDividendForm'
import { AddInvestmentTypeForm } from '@/components/investments/AddInvestmentTypeForm'
import type { InvestmentType, InvestmentEntry, Dividend } from '@/lib/types'

export default function InvestmentsPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showAddDividend, setShowAddDividend] = useState(false)
  const [showAddType, setShowAddType] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [deletingDividendId, setDeletingDividendId] = useState<string | null>(null)
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const [types, ents, divs] = await Promise.all([
          getInvestmentTypes(),
          getInvestmentEntries(month),
          getDividends(month),
        ])
        setInvestmentTypes(types)
        setEntries(ents)
        setDividends(divs)
      } catch (e) {
        setError('שגיאה בטעינת נתוני השקעות. בדוק את חיבור הרשת.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  async function handleAddEntry(entry: Omit<InvestmentEntry, 'id'>) {
    const newEntry = await addInvestmentEntry(entry)
    setEntries(prev => [...prev, newEntry])
    setShowAddEntry(false)
  }

  async function handleAddDividend(dividend: Omit<Dividend, 'id'>) {
    const newDividend = await addDividend(dividend)
    setDividends(prev => [...prev, newDividend])
    setShowAddDividend(false)
  }

  async function handleAddType(type: { name: string; currency: string }) {
    const portfolios = await getInvestmentPortfolios()
    if (portfolios.length === 0) { setError('אין תיקי השקעות זמינים'); return }
    const portfolioAccountId = portfolios[0].id
    const newType = await addInvestmentType({ ...type, portfolioAccountId })
    setInvestmentTypes(prev => [...prev, newType])
    setShowAddType(false)
  }

  async function handleDeleteEntry(id: string) {
    await deleteInvestmentEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingEntryId(null)
  }

  async function handleDeleteDividend(id: string) {
    await deleteDividend(id)
    setDividends(prev => prev.filter(d => d.id !== id))
    setDeletingDividendId(null)
  }

  async function handleDeleteType(id: string) {
    await deleteInvestmentType(id)
    setInvestmentTypes(prev => prev.filter(t => t.id !== id))
    setDeletingTypeId(null)
  }

  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))

  return (
    <main className="p-4 max-w-lg mx-auto pb-24 space-y-6">
      <MonthHeader month={month} onMonthChange={setMonth} />

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : (
        <>
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">תרומות החודש</h2>
              <button onClick={() => setShowAddEntry(v => !v)} className="text-xs text-accent">
                {showAddEntry ? 'ביטול' : '+ הוסף תרומה'}
              </button>
            </div>
            {showAddEntry && (
              <div className="mb-3">
                <AddInvestmentEntryForm types={investmentTypes} onSubmit={handleAddEntry} onCancel={() => setShowAddEntry(false)} />
              </div>
            )}
            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {entries.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין תרומות החודש</p>
              ) : entries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
                    <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">{e.amount.toLocaleString('he-IL')} {e.currency}</span>
                    {deletingEntryId === e.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => handleDeleteEntry(e.id)} className="text-red-400 hover:text-red-300">מחק</button>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => setDeletingEntryId(null)} className="text-slate-400">ביטול</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeletingEntryId(e.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">דיבידנדים החודש</h2>
              <button onClick={() => setShowAddDividend(v => !v)} className="text-xs text-accent">
                {showAddDividend ? 'ביטול' : '+ הוסף דיבידנד'}
              </button>
            </div>
            {showAddDividend && (
              <div className="mb-3">
                <AddDividendForm types={investmentTypes} onSubmit={handleAddDividend} onCancel={() => setShowAddDividend(false)} />
              </div>
            )}
            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {dividends.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין דיבידנדים החודש</p>
              ) : dividends.map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm">{typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId}</span>
                    <span className="text-xs text-slate-500 mr-2">{d.date.slice(5).replace('-', '/')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-sm tabular-nums">{d.amount.toLocaleString('he-IL')} {d.currency}</span>
                      {d.ilsEquivalent && <span className="text-xs text-slate-400 block">₪{d.ilsEquivalent.toLocaleString('he-IL')}</span>}
                    </div>
                    {deletingDividendId === d.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => handleDeleteDividend(d.id)} className="text-red-400 hover:text-red-300">מחק</button>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => setDeletingDividendId(null)} className="text-slate-400">ביטול</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeletingDividendId(d.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">סוגי השקעות</h2>
              <button onClick={() => setShowAddType(v => !v)} className="text-xs text-accent">
                {showAddType ? 'ביטול' : '+ הוסף סוג'}
              </button>
            </div>
            {showAddType && (
              <div className="mb-3">
                <AddInvestmentTypeForm onSubmit={handleAddType} onCancel={() => setShowAddType(false)} />
              </div>
            )}
            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {investmentTypes.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין סוגי השקעות עדיין</p>
              ) : investmentTypes.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">{t.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{t.currency}</span>
                    {deletingTypeId === t.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => handleDeleteType(t.id)} className="text-red-400 hover:text-red-300">מחק</button>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => setDeletingTypeId(null)} className="text-slate-400">ביטול</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeletingTypeId(t.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
