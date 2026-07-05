'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { MonthHeader } from '@/components/layout/MonthHeader'
import { getInvestmentTypes, getInvestmentEntries, addInvestmentEntry, deleteInvestmentEntry } from '@/lib/firestore/investments'
import { getDividends, addDividend, deleteDividend } from '@/lib/firestore/dividends'
import { getInvestmentConversions, addInvestmentConversion, deleteInvestmentConversion } from '@/lib/firestore/conversions'
import { getAccounts } from '@/lib/firestore/accounts'
import { getTransactions, updateTransaction, addTransactionGetId } from '@/lib/firestore/transactions'
import { AddInvestmentActivityForm } from '@/components/investments/AddInvestmentActivityForm'
import { InvestmentTransferEditForm } from '@/components/investments/InvestmentTransferEditForm'
import type { InvestmentType, InvestmentEntry, Dividend, Account, InvestmentConversion, Transaction } from '@/lib/types'

type InvItem =
  | { kind: 'deposit'; entry: InvestmentEntry; typeName: string; bankName: string | undefined }
  | { kind: 'dividend'; dividend: Dividend; typeName: string }
  | { kind: 'conversion'; conversion: InvestmentConversion; typeName: string }
  | { kind: 'transfer'; transaction: Transaction }

export default function InvestmentsPage() {
  const [month, setMonth] = usePersistedMonth()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolios, setPortfolios] = useState<Account[]>([])
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [conversions, setConversions] = useState<InvestmentConversion[]>([])
  const [transfers, setTransfers] = useState<Transaction[]>([])
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSellForm, setShowSellForm] = useState(false)
  const [sellError, setSellError] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ kind: 'deposit'; id: string } | { kind: 'dividend'; id: string } | { kind: 'conversion'; id: string } | null>(null)
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null)
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)

  // Ref map for scroll-to-highlight
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const [accs, types, ents, divs, convs, txs] = await Promise.all([
          getAccounts(),
          getInvestmentTypes(),
          getInvestmentEntries(month),
          getDividends(month),
          getInvestmentConversions(month),
          getTransactions(month),
        ])
        setPortfolios(accs.filter(a => a.type === 'investment'))
        setBankAccounts(accs.filter(a => a.type === 'bank' && a.isActive !== false))
        setInvestmentTypes(types)
        setEntries(ents)
        setDividends(divs)
        setConversions(convs)
        setTransfers(txs.filter(t => t.direction === 'investment' || t.direction === 'divestment'))
      } catch (e) {
        setError('שגיאה בטעינת נתוני השקעות. בדוק את חיבור הרשת.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  // Highlight from URL param
  useEffect(() => {
    const highlight = searchParams?.get('highlight')
    if (!highlight || loading) return
    const key = `transfer-${highlight}`
    setExpandedItemKey(key)
    setTimeout(() => {
      rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [searchParams, loading])

  async function handleAddEntry(entry: Omit<InvestmentEntry, 'id'>) {
    const newEntry = await addInvestmentEntry(entry)
    setEntries(prev => [...prev, newEntry])
    setShowAddForm(false)
  }

  async function handleAddDividend(dividend: Omit<Dividend, 'id'>) {
    const newDividend = await addDividend(dividend)
    setDividends(prev => [...prev, newDividend])
    setShowAddForm(false)
  }

  async function handleAddConversion(conv: Omit<InvestmentConversion, 'id'>) {
    const newConv = await addInvestmentConversion(conv)
    setConversions(prev => [...prev, newConv])
    setShowAddForm(false)
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

  async function handleUpdateTransfer(id: string, data: Parameters<React.ComponentProps<typeof InvestmentTransferEditForm>['onSave']>[0]) {
    const txMonth = data.date.slice(0, 7)
    await updateTransaction(id, {
      date: data.date,
      merchantName: data.merchantName,
      amount: data.amount,
      portfolioAccountId: data.portfolioAccountId,
      investmentTypeId: data.investmentTypeId,
      direction: data.direction,
      accountId: data.accountId,
      month: txMonth,
      ...(data.notes ? { description: data.notes } : { description: undefined }),
    })
    setTransfers(prev =>
      txMonth === month
        ? prev.map(t => t.id === id ? {
            ...t,
            date: data.date,
            merchantName: data.merchantName,
            amount: data.amount,
            portfolioAccountId: data.portfolioAccountId,
            investmentTypeId: data.investmentTypeId,
            direction: data.direction,
            accountId: data.accountId,
            month: txMonth,
            description: data.notes,
          } : t)
        : prev.filter(t => t.id !== id)
    )
    setEditingTransferId(null)
    setExpandedItemKey(null)
  }

  async function handleAddSell(data: Parameters<React.ComponentProps<typeof InvestmentTransferEditForm>['onSave']>[0]) {
    setSellError(null)
    try {
      const txMonth = data.date.slice(0, 7)
      const id = await addTransactionGetId({
        date: data.date,
        merchantName: data.merchantName,
        amount: data.amount,
        currency: 'ILS',
        accountId: data.accountId,
        source: 'manual',
        isImmediate: false,
        month: txMonth,
        direction: data.direction,
        portfolioAccountId: data.portfolioAccountId,
        ...(data.investmentTypeId ? { investmentTypeId: data.investmentTypeId } : {}),
        ...(data.notes ? { description: data.notes } : {}),
      })
      if (txMonth === month) {
        setTransfers(prev => [...prev, {
          id,
          date: data.date,
          merchantName: data.merchantName,
          amount: data.amount,
          currency: 'ILS',
          accountId: data.accountId,
          source: 'manual' as const,
          isImmediate: false,
          month: txMonth,
          direction: data.direction,
          portfolioAccountId: data.portfolioAccountId,
          investmentTypeId: data.investmentTypeId,
        }])
      }
      setShowSellForm(false)
    } catch {
      setSellError('שגיאה בשמירה. נסה שוב.')
    }
  }

  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))
  const bankMap = Object.fromEntries(bankAccounts.map(a => [a.id, a]))
  const activeTypes = investmentTypes.filter(t => t.isActive !== false)
  const typeIdsInMonth = new Set([
    ...entries.map(e => e.investmentTypeId),
    ...dividends.map(d => d.investmentTypeId),
    ...conversions.map(c => c.investmentTypeId),
  ])
  const portfolioIdsWithData = new Set([
    ...investmentTypes
      .filter(t => typeIdsInMonth.has(t.id))
      .map(t => t.portfolioAccountId),
    ...transfers.map(t => t.portfolioAccountId).filter((id): id is string => !!id),
  ])
  const visiblePortfolios = portfolios.filter(
    p => p.isActive !== false || portfolioIdsWithData.has(p.id)
  )
  const activePortfolios = portfolios.filter(p => p.isActive !== false)

  const filteredEntries = portfolioFilter === 'all'
    ? entries
    : entries.filter(e => typeMap[e.investmentTypeId]?.portfolioAccountId === portfolioFilter)

  const filteredDividends = portfolioFilter === 'all'
    ? dividends
    : dividends.filter(d => typeMap[d.investmentTypeId]?.portfolioAccountId === portfolioFilter)

  const filteredConversions = portfolioFilter === 'all'
    ? conversions
    : conversions.filter(c => typeMap[c.investmentTypeId]?.portfolioAccountId === portfolioFilter)

  const filteredTransfers = portfolioFilter === 'all'
    ? transfers
    : transfers.filter(t => t.portfolioAccountId === portfolioFilter)

  function itemDate(item: InvItem): string {
    if (item.kind === 'deposit') return item.entry.date
    if (item.kind === 'dividend') return item.dividend.date
    if (item.kind === 'transfer') return item.transaction.date
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
    ...filteredTransfers.map(t => ({
      kind: 'transfer' as const,
      transaction: t,
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
      {visiblePortfolios.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 no-scrollbar">
          <button
            onClick={() => setPortfolioFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${portfolioFilter === 'all' ? 'bg-slate-600 text-white' : 'bg-surface text-slate-400'}`}
          >הכל</button>
          {visiblePortfolios.map(p => (
            <button
              key={p.id}
              onClick={() => setPortfolioFilter(p.id)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition-colors ${portfolioFilter === p.id ? (p.color ? 'text-white' : 'bg-slate-600 text-white') : 'bg-surface text-slate-400'}`}
              style={portfolioFilter === p.id && p.color ? { backgroundColor: p.color } : undefined}
            >{p.name}</button>
          ))}
        </div>
      )}

      {/* Floating action buttons */}
      {!showAddForm && !showSellForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="fixed bottom-20 left-4 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-10"
        >+ פעילות</button>
      )}
      {!showAddForm && !showSellForm && (
        <button
          onClick={() => setShowSellForm(true)}
          className="fixed bottom-20 right-4 bg-red-900/80 border border-red-700 text-red-300 text-sm font-semibold px-4 py-2 rounded-full shadow-lg z-10"
        >+ מכירה</button>
      )}

      {showAddForm && (
        <AddInvestmentActivityForm
          types={activeTypes}
          portfolios={activePortfolios}
          bankAccounts={bankAccounts}
          onSubmitEntry={handleAddEntry}
          onSubmitDividend={handleAddDividend}
          onSubmitConversion={handleAddConversion}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {sellError && <p className="text-red-400 text-xs px-4 pb-1">{sellError}</p>}
      {showSellForm && (
        <div className="bg-surface rounded-2xl px-4 py-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">הוספת מכירה</h3>
          <InvestmentTransferEditForm
            defaultDirection="divestment"
            portfolios={activePortfolios}
            investmentTypes={activeTypes}
            bankAccounts={bankAccounts}
            onSave={handleAddSell}
            onCancel={() => { setShowSellForm(false); setSellError(null) }}
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
              const key = `deposit-${item.entry.id}`
              const isExpanded = expandedItemKey === key
              return (
                <div
                  key={item.entry.id}
                  className="border-b border-slate-800 last:border-0"
                  ref={el => { rowRefs.current[key] = el }}
                  data-item-key={key}
                >
                  <div
                    className="flex items-center gap-2 py-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedItemKey(isExpanded ? null : key)}
                  >
                    <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">קנייה: {item.typeName}</span>
                      {item.bankName && <span className="text-xs text-slate-500 block">{item.bankName}</span>}
                    </div>
                    {ilsAmount !== null && (
                      <span className="text-sm tabular-nums text-green-400 flex-shrink-0" dir="ltr">₪-{ilsAmount.toLocaleString('he-IL')}</span>
                    )}
                    <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
                  </div>
                  {isExpanded && (
                    <div className="pb-3 px-2 space-y-1.5 text-xs" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between text-slate-400">
                        <span>תאריך</span><span>{item.entry.date}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>השקעה</span><span className="text-foreground">{item.typeName}</span>
                      </div>
                      {item.bankName && (
                        <div className="flex justify-between text-slate-400">
                          <span>חשבון מקור</span><span className="text-foreground">{item.bankName}</span>
                        </div>
                      )}
                      {ilsAmount !== null && (
                        <div className="flex justify-between text-slate-400">
                          <span>סכום (₪)</span><span className="text-green-400 tabular-nums" dir="ltr">₪{ilsAmount.toLocaleString('he-IL')}</span>
                        </div>
                      )}
                      {item.entry.notes && (
                        <div className="flex justify-between text-slate-400">
                          <span>הערות</span><span className="text-foreground">{item.entry.notes}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        {deletingItem?.kind === 'deposit' && deletingItem.id === item.entry.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button onClick={() => handleDeleteEntry(item.entry.id)} className="text-red-400 hover:text-red-300">מחק</button>
                            <span className="text-slate-600">|</span>
                            <button onClick={() => setDeletingItem(null)} className="text-slate-400">ביטול</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingItem({ kind: 'deposit', id: item.entry.id })} className="text-slate-500 hover:text-red-400 text-xs">מחק</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            if (item.kind === 'dividend') {
              const [, mm, dd] = item.dividend.date.split('-')
              const ilsAmount = item.dividend.ilsEquivalent ?? (item.dividend.currency === 'ILS' ? item.dividend.amount : null)
              const key = `dividend-${item.dividend.id}`
              const isExpanded = expandedItemKey === key
              return (
                <div
                  key={item.dividend.id}
                  className="border-b border-slate-800 last:border-0"
                  ref={el => { rowRefs.current[key] = el }}
                  data-item-key={key}
                >
                  <div
                    className="flex items-center gap-2 py-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedItemKey(isExpanded ? null : key)}
                  >
                    <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">הכנסה: {item.typeName}</span>
                    </div>
                    {ilsAmount !== null && (
                      <span className="text-sm tabular-nums text-purple-400 flex-shrink-0" dir="ltr">₪+{ilsAmount.toLocaleString('he-IL')}</span>
                    )}
                    <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
                  </div>
                  {isExpanded && (
                    <div className="pb-3 px-2 space-y-1.5 text-xs" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between text-slate-400">
                        <span>תאריך</span><span>{item.dividend.date}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>השקעה</span><span className="text-foreground">{item.typeName}</span>
                      </div>
                      {ilsAmount !== null && (
                        <div className="flex justify-between text-slate-400">
                          <span>סכום (₪)</span><span className="text-purple-400 tabular-nums" dir="ltr">₪{ilsAmount.toLocaleString('he-IL')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-400">
                        <span>נשאר בתיק</span><span className="text-foreground">{item.dividend.staysInPortfolio ? 'כן' : 'לא'}</span>
                      </div>
                      {item.dividend.destinationAccountId && bankMap[item.dividend.destinationAccountId] && (
                        <div className="flex justify-between text-slate-400">
                          <span>חשבון יעד</span><span className="text-foreground">{bankMap[item.dividend.destinationAccountId].name}</span>
                        </div>
                      )}
                      {item.dividend.notes && (
                        <div className="flex justify-between text-slate-400">
                          <span>הערות</span><span className="text-foreground">{item.dividend.notes}</span>
                        </div>
                      )}
                      <div className="pt-1">
                        {deletingItem?.kind === 'dividend' && deletingItem.id === item.dividend.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button onClick={() => handleDeleteDividend(item.dividend.id)} className="text-red-400 hover:text-red-300">מחק</button>
                            <span className="text-slate-600">|</span>
                            <button onClick={() => setDeletingItem(null)} className="text-slate-400">ביטול</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingItem({ kind: 'dividend', id: item.dividend.id })} className="text-slate-500 hover:text-red-400 text-xs">מחק</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            if (item.kind === 'transfer') {
              const [, mm, dd] = item.transaction.date.split('-')
              const portfolioName = portfolios.find(p => p.id === item.transaction.portfolioAccountId)?.name ?? 'תיק השקעות'
              const typeName = investmentTypes.find(t => t.id === item.transaction.investmentTypeId)?.name
              const sourceAccount = bankAccounts.find(a => a.id === item.transaction.accountId)
              const isBuy = item.transaction.direction === 'investment'
              const key = `transfer-${item.transaction.id}`
              const isExpanded = expandedItemKey === key
              const isEditing = editingTransferId === item.transaction.id

              if (isEditing) {
                return (
                  <div
                    key={key}
                    className="py-3 border-b border-slate-800 last:border-0"
                    ref={el => { rowRefs.current[key] = el }}
                    data-item-key={key}
                  >
                    <InvestmentTransferEditForm
                      initial={item.transaction}
                      portfolios={portfolios.filter(p => p.isActive !== false)}
                      investmentTypes={investmentTypes.filter(t => t.isActive !== false)}
                      bankAccounts={bankAccounts}
                      onSave={data => handleUpdateTransfer(item.transaction.id, data)}
                      onCancel={() => setEditingTransferId(null)}
                    />
                  </div>
                )
              }

              return (
                <div
                  key={key}
                  className="border-b border-slate-800 last:border-0"
                  ref={el => { rowRefs.current[key] = el }}
                  data-item-key={key}
                >
                  <div
                    className="flex items-center gap-2 py-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedItemKey(isExpanded ? null : key)}
                  >
                    <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{isBuy ? 'קנייה' : 'מכירה'}: {item.transaction.merchantName}</span>
                      <span className="text-xs text-slate-500 block">{typeName ? `${typeName} — ${portfolioName}` : portfolioName}</span>
                    </div>
                    <span className={`text-sm tabular-nums flex-shrink-0 ${isBuy ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                      {isBuy ? '₪-' : '₪+'}{item.transaction.amount.toLocaleString('he-IL')}
                    </span>
                    <span className="text-slate-500 text-xs flex-shrink-0">{isExpanded ? '⌃' : '⌄'}</span>
                  </div>

                  {isExpanded && (
                    <div className="pb-3 px-2 space-y-1.5 text-xs" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between text-slate-400">
                        <span>תאריך</span><span>{item.transaction.date}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>תיאור מהבנק</span><span className="text-foreground">{item.transaction.merchantName}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>תיק</span><span className="text-foreground">{portfolioName}</span>
                      </div>
                      {typeName && (
                        <div className="flex justify-between text-slate-400">
                          <span>השקעה</span><span className="text-foreground">{typeName}</span>
                        </div>
                      )}
                      {sourceAccount && (
                        <div className="flex justify-between text-slate-400">
                          <span>חשבון בנק</span><span className="text-foreground">{sourceAccount.name}</span>
                        </div>
                      )}
                      {item.transaction.description && (
                        <div className="flex justify-between text-slate-400">
                          <span>הערות</span><span className="text-foreground">{item.transaction.description}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-400">
                        <span>כיוון</span><span className={isBuy ? 'text-green-400' : 'text-red-400'}>{isBuy ? 'קנייה' : 'מכירה'}</span>
                      </div>
                      <div className="pt-1">
                        <button
                          onClick={() => setEditingTransferId(item.transaction.id)}
                          className="text-xs text-accent hover:underline"
                        >ערוך</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            // conversion
            const [, mm, dd] = item.conversion.date.split('-')
            const convKey = `conversion-${item.conversion.id}`
            const isConvExpanded = expandedItemKey === convKey
            return (
              <div
                key={item.conversion.id}
                className="border-b border-slate-800 last:border-0"
                ref={el => { rowRefs.current[convKey] = el }}
                data-item-key={convKey}
              >
                <div
                  className="flex items-center gap-2 py-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedItemKey(isConvExpanded ? null : convKey)}
                >
                  <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>{dd}/{mm}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">המרה: {item.typeName}</span>
                  </div>
                  <span className="text-sm tabular-nums text-purple-400 flex-shrink-0" dir="ltr">₪+{item.conversion.ilsReceived.toLocaleString('he-IL')}</span>
                  <span className="text-slate-500 text-xs flex-shrink-0">{isConvExpanded ? '⌃' : '⌄'}</span>
                </div>
                {isConvExpanded && (
                  <div className="pb-3 px-2 space-y-1.5 text-xs" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between text-slate-400">
                      <span>תאריך</span><span>{item.conversion.date}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>השקעה</span><span className="text-foreground">{item.typeName}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>התקבל (₪)</span><span className="text-purple-400 tabular-nums" dir="ltr">₪{item.conversion.ilsReceived.toLocaleString('he-IL')}</span>
                    </div>
                    {item.conversion.foreignAmountReduced !== undefined && (
                      <div className="flex justify-between text-slate-400">
                        <span>הופחת (מט&quot;ח)</span><span className="text-foreground tabular-nums">{item.conversion.foreignAmountReduced.toLocaleString('he-IL')}</span>
                      </div>
                    )}
                    {item.conversion.destinationAccountId && bankMap[item.conversion.destinationAccountId] && (
                      <div className="flex justify-between text-slate-400">
                        <span>חשבון יעד</span><span className="text-foreground">{bankMap[item.conversion.destinationAccountId].name}</span>
                      </div>
                    )}
                    {item.conversion.notes && (
                      <div className="flex justify-between text-slate-400">
                        <span>הערות</span><span className="text-foreground">{item.conversion.notes}</span>
                      </div>
                    )}
                    <div className="pt-1">
                      {deletingItem?.kind === 'conversion' && deletingItem.id === item.conversion.id ? (
                        <span className="flex items-center gap-1 text-xs">
                          <button onClick={() => handleDeleteConversion(item.conversion.id)} className="text-red-400 hover:text-red-300">מחק</button>
                          <span className="text-slate-600">|</span>
                          <button onClick={() => setDeletingItem(null)} className="text-slate-400">ביטול</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeletingItem({ kind: 'conversion', id: item.conversion.id })} className="text-slate-500 hover:text-red-400 text-xs">מחק</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="py-3 border-t border-slate-700 space-y-1.5">
            {(() => {
              const investmentTransferTotal = filteredTransfers
                .filter(t => t.direction === 'investment')
                .reduce((s, t) => s + t.amount, 0)
              const divestmentTotal = filteredTransfers
                .filter(t => t.direction === 'divestment')
                .reduce((s, t) => s + t.amount, 0)
              const totalIn = depositTotal + investmentTransferTotal
              const totalOut = divestmentTotal + conversionTotal + incomeTotal
              return (
                <>
                  {totalIn > 0 && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>סה&quot;כ נכנס לתיק</span>
                      <span className="tabular-nums text-green-400" dir="ltr">₪-{totalIn.toLocaleString('he-IL')}</span>
                    </div>
                  )}
                  {totalOut > 0 && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>סה&quot;כ יצא מהתיק</span>
                      <span className="tabular-nums text-purple-400" dir="ltr">₪+{totalOut.toLocaleString('he-IL')}</span>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </main>
  )
}
