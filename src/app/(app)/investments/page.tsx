'use client'
import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { getInvestmentTypes, getInvestmentEntriesByYear, addInvestmentEntry, deleteInvestmentEntry } from '@/lib/firestore/investments'
import { getDividendsByYear, addDividend, deleteDividend } from '@/lib/firestore/dividends'
import { getAccounts } from '@/lib/firestore/accounts'
import { AddInvestmentEntryForm } from '@/components/investments/AddInvestmentEntryForm'
import { AddDividendForm } from '@/components/investments/AddDividendForm'
import type { InvestmentType, InvestmentEntry, Dividend, Account } from '@/lib/types'

export default function InvestmentsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)
  const [portfolios, setPortfolios] = useState<Account[]>([])
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showAddDividend, setShowAddDividend] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [deletingDividendId, setDeletingDividendId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const [accs, types, ents, divs] = await Promise.all([
          getAccounts(),
          getInvestmentTypes(),
          getInvestmentEntriesByYear(year),
          getDividendsByYear(year),
        ])
        setPortfolios(accs.filter(a => a.type === 'investment'))
        setBankAccounts(accs.filter(a => a.type === 'bank' && a.isActive))
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
  }, [year])

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

  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))
  const bankMap = Object.fromEntries(bankAccounts.map(a => [a.id, a]))

  // Group entries by portfolio
  const entriesByPortfolio: Record<string, InvestmentEntry[]> = {}
  for (const entry of entries) {
    const pId = typeMap[entry.investmentTypeId]?.portfolioAccountId ?? 'unassigned'
    if (!entriesByPortfolio[pId]) entriesByPortfolio[pId] = []
    entriesByPortfolio[pId].push(entry)
  }

  return (
    <main className="p-4 max-w-lg mx-auto pb-24 space-y-6">
      {/* Year navigation — dir="ltr" so chevrons point correctly */}
      <div className="flex items-center justify-between" dir="ltr">
        <button
          onClick={() => setYear(y => String(parseInt(y) - 1))}
          className="p-2 text-slate-400 hover:text-foreground transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{year}</h1>
        <button
          onClick={() => setYear(y => String(parseInt(y) + 1))}
          className="p-2 text-slate-400 hover:text-foreground transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : (
        <>
          {/* הפקדות section */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">הפקדות {year}</h2>
              <button onClick={() => setShowAddEntry(v => !v)} className="text-xs text-accent">
                {showAddEntry ? 'ביטול' : '+ הוסף הפקדה'}
              </button>
            </div>

            {showAddEntry && (
              <div className="mb-3">
                <AddInvestmentEntryForm
                  types={investmentTypes}
                  portfolios={portfolios}
                  bankAccounts={bankAccounts}
                  onSubmit={handleAddEntry}
                  onCancel={() => setShowAddEntry(false)}
                />
              </div>
            )}

            {entries.length === 0 ? (
              <div className="bg-surface rounded-2xl p-4">
                <p className="text-slate-500 text-sm text-center py-2">אין הפקדות ב-{year}</p>
              </div>
            ) : portfolios.length > 0 ? (
              <>
                {portfolios.map(portfolio => {
                  const pEntries = entriesByPortfolio[portfolio.id] ?? []
                  if (pEntries.length === 0) return null
                  const total = pEntries.reduce((s, e) => s + e.amount, 0)
                  const currency = pEntries[0]?.currency ?? ''
                  return (
                    <div key={portfolio.id} className="mb-3">
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: portfolio.color }} />
                        <span className="text-xs text-slate-400 flex-1">{portfolio.name}</span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {total.toLocaleString('he-IL')} {currency}
                        </span>
                      </div>
                      <div className="bg-surface rounded-2xl divide-y divide-slate-800">
                        {pEntries.map(e => (
                          <div key={e.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
                              <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
                              {e.sourceAccountId && bankMap[e.sourceAccountId] && (
                                <span className="text-xs text-slate-600 block">מ-{bankMap[e.sourceAccountId].name}</span>
                              )}
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
                    </div>
                  )
                })}
                {/* Show unassigned entries if any */}
                {(entriesByPortfolio['unassigned'] ?? []).length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs text-slate-400 flex-1">לא משויך</span>
                    </div>
                    <div className="bg-surface rounded-2xl divide-y divide-slate-800">
                      {(entriesByPortfolio['unassigned'] ?? []).map(e => (
                        <div key={e.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
                            <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
                            {e.sourceAccountId && bankMap[e.sourceAccountId] && (
                              <span className="text-xs text-slate-600 block">מ-{bankMap[e.sourceAccountId].name}</span>
                            )}
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
                  </div>
                )}
              </>
            ) : (
              <div className="bg-surface rounded-2xl divide-y divide-slate-800">
                {entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm">{typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId}</span>
                      <span className="text-xs text-slate-500 mr-2">{e.date.slice(5).replace('-', '/')}</span>
                      {e.sourceAccountId && bankMap[e.sourceAccountId] && (
                        <span className="text-xs text-slate-600 block">מ-{bankMap[e.sourceAccountId].name}</span>
                      )}
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
            )}
          </section>

          {/* הכנסות מהשקעות section */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">הכנסות מהשקעות {year}</h2>
              <button onClick={() => setShowAddDividend(v => !v)} className="text-xs text-accent">
                {showAddDividend ? 'ביטול' : '+ הוסף הכנסה'}
              </button>
            </div>

            {showAddDividend && (
              <div className="mb-3">
                <AddDividendForm
                  types={investmentTypes}
                  bankAccounts={bankAccounts}
                  onSubmit={handleAddDividend}
                  onCancel={() => setShowAddDividend(false)}
                />
              </div>
            )}

            <div className="bg-surface rounded-2xl divide-y divide-slate-800">
              {dividends.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">אין הכנסות מהשקעות ב-{year}</p>
              ) : dividends.map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm">{typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId}</span>
                    <span className="text-xs text-slate-500 mr-2">{d.date.slice(5).replace('-', '/')}</span>
                    {!d.staysInPortfolio && d.destinationAccountId && (
                      <span className="block text-xs text-slate-500">
                        → {bankMap[d.destinationAccountId]?.name ?? d.destinationAccountId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-sm tabular-nums">{d.amount.toLocaleString('he-IL')} {d.currency}</span>
                      {d.ilsEquivalent && (
                        <span className="text-xs text-slate-400 block">₪{d.ilsEquivalent.toLocaleString('he-IL')}</span>
                      )}
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
        </>
      )}
    </main>
  )
}
