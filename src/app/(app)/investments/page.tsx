'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getInvestmentTypes, getInvestmentEntries, addInvestmentEntry, deleteInvestmentEntry } from '@/lib/firestore/investments'
import { getDividends, addDividend, deleteDividend } from '@/lib/firestore/dividends'
import { getInvestmentConversions, addInvestmentConversion, deleteInvestmentConversion } from '@/lib/firestore/conversions'
import { getAccounts } from '@/lib/firestore/accounts'
import { AddInvestmentEntryForm } from '@/components/investments/AddInvestmentEntryForm'
import { AddDividendForm } from '@/components/investments/AddDividendForm'
import { AddInvestmentConversionForm } from '@/components/investments/AddInvestmentConversionForm'
import type { InvestmentType, InvestmentEntry, Dividend, Account, InvestmentConversion } from '@/lib/types'

type InvItem =
  | { kind: 'deposit'; entry: InvestmentEntry; typeName: string; bankName: string | undefined }
  | { kind: 'dividend'; dividend: Dividend; typeName: string }
  | { kind: 'conversion'; conversion: InvestmentConversion; typeName: string }

export default function InvestmentsPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolios, setPortfolios] = useState<Account[]>([])
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [conversions, setConversions] = useState<InvestmentConversion[]>([])
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all')
  const [showAddType, setShowAddType] = useState<'deposit' | 'dividend' | 'conversion' | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ kind: 'deposit'; id: string } | { kind: 'dividend'; id: string } | { kind: 'conversion'; id: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const [accs, types, ents, divs, convs] = await Promise.all([
          getAccounts(),
          getInvestmentTypes(),
          getInvestmentEntries(month),
          getDividends(month),
          getInvestmentConversions(month),
        ])
        setPortfolios(accs.filter(a => a.type === 'investment'))
        setBankAccounts(accs.filter(a => a.type === 'bank' && a.isActive))
        setInvestmentTypes(types)
        setEntries(ents)
        setDividends(divs)
        setConversions(convs)
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
    setShowAddType(null)
  }

  async function handleAddDividend(dividend: Omit<Dividend, 'id'>) {
    const newDividend = await addDividend(dividend)
    setDividends(prev => [...prev, newDividend])
    setShowAddType(null)
  }

  async function handleAddConversion(conv: Omit<InvestmentConversion, 'id'>) {
    const newConv = await addInvestmentConversion(conv)
    setConversions(prev => [...prev, newConv])
    setShowAddType(null)
  }

  async function handleDeleteEntry(id: string) {
    await deleteInvestmentEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingItem(null)
  }

  async function handleDeleteDividend(id: string) {
    await deleteDividend(id)
    setDividends(prev => prev.filter(d => d.id !== id))
    setDeletingItem(null)
  }

  async function handleDeleteConversion(id: string) {
    await deleteInvestmentConversion(id)
    setConversions(prev => prev.filter(c => c.id !== id))
    setDeletingItem(null)
  }

  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))
  const bankMap = Object.fromEntries(bankAccounts.map(a => [a.id, a]))

  const filteredEntries = portfolioFilter === 'all'
    ? entries
    : entries.filter(e => typeMap[e.investmentTypeId]?.portfolioAccountId === portfolioFilter)

  const filteredDividends = portfolioFilter === 'all'
    ? dividends
    : dividends.filter(d => typeMap[d.investmentTypeId]?.portfolioAccountId === portfolioFilter)

  const filteredConversions = portfolioFilter === 'all'
    ? conversions
    : conversions.filter(c => typeMap[c.investmentTypeId]?.portfolioAccountId === portfolioFilter)

  function itemDate(item: InvItem): string {
    if (item.kind === 'deposit') return item.entry.date
    if (item.kind === 'dividend') return item.dividend.date
    return item.conversion.date
  }

  const displayItems: InvItem[] = [
    ...filteredEntries.map(e => ({
      kind: 'deposit' as const,
      entry: e,
      typeName: typeMap[e.investmentTypeId]?.name ?? e.investmentTypeId,
      bankName: bankMap[e.sourceAccountId ?? '']?.name,
    })),
    ...filteredDividends.map(d => ({
      kind: 'dividend' as const,
      dividend: d,
      typeName: typeMap[d.investmentTypeId]?.name ?? d.investmentTypeId,
    })),
    ...filteredConversions.map(c => ({
      kind: 'conversion' as const,
      conversion: c,
      typeName: typeMap[c.investmentTypeId]?.name ?? c.investmentTypeId,
    })),
  ].sort((a, b) => itemDate(b).localeCompare(itemDate(a)))

  const depositTotal = filteredEntries.reduce((s, e) => {
    return s + (e.ilsEquivalent ?? (e.currency === 'ILS' ? e.amount : 0))
  }, 0)
  const incomeTotal = filteredDividends.reduce((s, d) => {
    return s + (d.ilsEquivalent ?? (d.currency === 'ILS' ? d.amount : 0))
  }, 0)
  const conversionTotal = filteredConversions.reduce((s, c) => s + c.ilsReceived, 0)

  return (
    <main className="p-4 max-w-lg mx-auto pb-24">
      <MonthHeader month={month} onMonthChange={setMonth} />

      {/* Portfolio tabs */}
      {portfolios.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 no-scrollbar">
          <button
            onClick={() => setPortfolioFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${portfolioFilter === 'all' ? 'bg-slate-600 text-white' : 'bg-surface text-slate-400'}`}
          >הכל</button>
          {portfolios.map(p => (
            <button
              key={p.id}
              onClick={() => setPortfolioFilter(p.id)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${portfolioFilter === p.id ? (p.color ? 'text-white' : 'bg-slate-600 text-white') : 'bg-surface text-slate-400'}`}
              style={portfolioFilter === p.id && p.color ? { backgroundColor: p.color } : undefined}
            >{p.name}</button>
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex gap-3 justify-end mb-4">
        <button
          onClick={() => setShowAddType(v => v === 'deposit' ? null : 'deposit')}
          className={`text-xs ${showAddType === 'deposit' ? 'text-slate-400' : 'text-accent'}`}
        >{showAddType === 'deposit' ? 'ביטול' : '+ הפקדה'}</button>
        <button
          onClick={() => setShowAddType(v => v === 'dividend' ? null : 'dividend')}
          className={`text-xs ${showAddType === 'dividend' ? 'text-slate-400' : 'text-accent'}`}
        >{showAddType === 'dividend' ? 'ביטול' : '+ הכנסה'}</button>
        <button
          onClick={() => setShowAddType(v => v === 'conversion' ? null : 'conversion')}
          className={`text-xs ${showAddType === 'conversion' ? 'text-slate-400' : 'text-accent'}`}
        >{showAddType === 'conversion' ? 'ביטול' : '+ המרה'}</button>
      </div>

      {showAddType === 'deposit' && (
        <div className="mb-4">
          <AddInvestmentEntryForm
            types={investmentTypes}
            portfolios={portfolios}
            bankAccounts={bankAccounts}
            onSubmit={handleAddEntry}
            onCancel={() => setShowAddType(null)}
          />
        </div>
      )}
      {showAddType === 'dividend' && (
        <div className="mb-4">
          <AddDividendForm
            types={investmentTypes}
            bankAccounts={bankAccounts}
            onSubmit={handleAddDividend}
            onCancel={() => setShowAddType(null)}
          />
        </div>
      )}
      {showAddType === 'conversion' && (
        <div className="mb-4">
          <AddInvestmentConversionForm
            types={investmentTypes}
            bankAccounts={bankAccounts}
            onSubmit={handleAddConversion}
            onCancel={() => setShowAddType(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">{error}</div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500">אין פעילות השקעות בחודש זה</div>
      ) : (
        <div className="bg-surface rounded-2xl px-4">
          {displayItems.map(item => {
            if (item.kind === 'deposit') {
              const [, mm, dd] = item.entry.date.split('-')
              const ilsAmount = item.entry.ilsEquivalent ?? (item.entry.currency === 'ILS' ? item.entry.amount : null)
              return (
                <div key={item.entry.id} className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
                  <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-purple-400">הפקדה: {item.typeName}</span>
                    {item.bankName && <span className="text-xs text-slate-500 block">{item.bankName}</span>}
                  </div>
                  {ilsAmount !== null && (
                    <span className="text-sm tabular-nums text-purple-400 flex-shrink-0" dir="ltr">₪-{ilsAmount.toLocaleString('he-IL')}</span>
                  )}
                  {deletingItem?.kind === 'deposit' && deletingItem.id === item.entry.id ? (
                    <span className="flex items-center gap-1 text-xs flex-shrink-0">
                      <button onClick={() => handleDeleteEntry(item.entry.id)} className="text-red-400 hover:text-red-300">מחק</button>
                      <span className="text-slate-600">|</span>
                      <button onClick={() => setDeletingItem(null)} className="text-slate-400">ביטול</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeletingItem({ kind: 'deposit', id: item.entry.id })} className="text-slate-600 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                  )}
                </div>
              )
            }
            if (item.kind === 'dividend') {
              const [, mm, dd] = item.dividend.date.split('-')
              const ilsAmount = item.dividend.ilsEquivalent ?? (item.dividend.currency === 'ILS' ? item.dividend.amount : null)
              return (
                <div key={item.dividend.id} className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
                  <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-purple-400">הכנסה: {item.typeName}</span>
                  </div>
                  {ilsAmount !== null && (
                    <span className="text-sm tabular-nums text-green-400 flex-shrink-0" dir="ltr">₪+{ilsAmount.toLocaleString('he-IL')}</span>
                  )}
                  {deletingItem?.kind === 'dividend' && deletingItem.id === item.dividend.id ? (
                    <span className="flex items-center gap-1 text-xs flex-shrink-0">
                      <button onClick={() => handleDeleteDividend(item.dividend.id)} className="text-red-400 hover:text-red-300">מחק</button>
                      <span className="text-slate-600">|</span>
                      <button onClick={() => setDeletingItem(null)} className="text-slate-400">ביטול</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeletingItem({ kind: 'dividend', id: item.dividend.id })} className="text-slate-600 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                  )}
                </div>
              )
            }
            // conversion
            const [, mm, dd] = item.conversion.date.split('-')
            return (
              <div key={item.conversion.id} className="flex items-center gap-2 py-2.5 border-b border-slate-800 last:border-0">
                <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-purple-400">מכירה: {item.typeName}</span>
                </div>
                <span className="text-sm tabular-nums text-green-400 flex-shrink-0" dir="ltr">₪+{item.conversion.ilsReceived.toLocaleString('he-IL')}</span>
                {deletingItem?.kind === 'conversion' && deletingItem.id === item.conversion.id ? (
                  <span className="flex items-center gap-1 text-xs flex-shrink-0">
                    <button onClick={() => handleDeleteConversion(item.conversion.id)} className="text-red-400 hover:text-red-300">מחק</button>
                    <span className="text-slate-600">|</span>
                    <button onClick={() => setDeletingItem(null)} className="text-slate-400">ביטול</button>
                  </span>
                ) : (
                  <button onClick={() => setDeletingItem({ kind: 'conversion', id: item.conversion.id })} className="text-slate-600 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                )}
              </div>
            )
          })}

          <div className="py-3 border-t border-slate-700 space-y-1.5">
            {depositTotal > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>הפקדות</span>
                <span className="tabular-nums text-purple-400" dir="ltr">₪-{depositTotal.toLocaleString('he-IL')}</span>
              </div>
            )}
            {incomeTotal > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>הכנסות</span>
                <span className="tabular-nums text-green-400" dir="ltr">₪+{incomeTotal.toLocaleString('he-IL')}</span>
              </div>
            )}
            {conversionTotal > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>המרות</span>
                <span className="tabular-nums text-green-400" dir="ltr">₪+{conversionTotal.toLocaleString('he-IL')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
