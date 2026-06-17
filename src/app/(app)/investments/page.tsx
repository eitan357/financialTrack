'use client'
import { useState, useEffect } from 'react'
import { usePersistedMonth } from '@/hooks/usePersistedMonth'
import { getInvestmentTypes, addInvestmentType, getInvestmentEntries, addInvestmentEntry } from '@/lib/firestore/investments'
import { getDividends, addDividend } from '@/lib/firestore/dividends'
import { AddInvestmentEntryForm } from '@/components/investments/AddInvestmentEntryForm'
import { AddDividendForm } from '@/components/investments/AddDividendForm'
import { AddInvestmentTypeForm } from '@/components/investments/AddInvestmentTypeForm'
import { MonthPicker } from '@/components/MonthPicker'
import type { InvestmentType, InvestmentEntry, Dividend } from '@/lib/types'

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return `${HE_MONTHS[parseInt(mo, 10) - 1]} ${y}`
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function InvestmentsPage() {
  const [month, setMonth] = usePersistedMonth()
  const [loading, setLoading] = useState(true)
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([])
  const [entries, setEntries] = useState<InvestmentEntry[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showAddDividend, setShowAddDividend] = useState(false)
  const [showAddType, setShowAddType] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
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

  async function handleAddType(type: Omit<InvestmentType, 'id'>) {
    const newType = await addInvestmentType(type)
    setInvestmentTypes(prev => [...prev, newType])
    setShowAddType(false)
  }

  const typeMap = Object.fromEntries(investmentTypes.map(t => [t.id, t]))

  return (
    <main className="p-4 max-w-lg mx-auto pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="חודש קודם" className="text-slate-400 text-2xl w-10 text-center">‹</button>
        <button
          onClick={() => setPickerOpen(p => !p)}
          aria-label="בחר חודש"
          className="text-base font-semibold hover:text-accent transition-colors"
        >
          {formatMonth(month)}
        </button>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="חודש הבא" className="text-slate-400 text-2xl w-10 text-center">›</button>
      </div>
      {pickerOpen && (
        <MonthPicker
          value={month}
          onChange={m => { setMonth(m); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center items-center min-h-40">
          <p className="text-slate-400">טוען...</p>
        </div>
      ) : (
        <>
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">תרומות החודש</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowAddEntry(v => !v)} aria-label="הוסף תרומה" className="text-xs text-accent">
                  {showAddEntry ? 'ביטול' : '+ הוסף תרומה'}
                </button>
              </div>
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
                  <span className="text-sm tabular-nums">{e.amount.toLocaleString('he-IL')} {e.currency}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">דיבידנדים החודש</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowAddDividend(v => !v)} aria-label="הוסף דיבידנד" className="text-xs text-accent">
                  {showAddDividend ? 'ביטול' : '+ הוסף דיבידנד'}
                </button>
              </div>
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
                  <div className="text-left">
                    <span className="text-sm tabular-nums">{d.amount.toLocaleString('he-IL')} {d.currency}</span>
                    {d.ilsEquivalent && <span className="text-xs text-slate-400 block">₪{d.ilsEquivalent.toLocaleString('he-IL')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-sm">סוגי השקעות</h2>
              <button onClick={() => setShowAddType(v => !v)} aria-label="הוסף סוג" className="text-xs text-accent">
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
                  <span className="text-xs text-slate-400">{t.currency}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
