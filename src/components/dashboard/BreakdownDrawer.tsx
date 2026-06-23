'use client'
import type { Transaction, SalaryEntry, Dividend, InvestmentEntry, InvestmentType, Category, Account } from '@/lib/types'

export type DrawerData =
  | {
      type: 'income'
      total: number
      salary: SalaryEntry | null
      salaryDate?: string
      dividends: Dividend[]
      incomeTransactions: Transaction[]
    }
  | {
      type: 'expenses'
      total: number
      transactions: Transaction[]
      categories: Category[]
      accounts: Account[]
    }
  | {
      type: 'expenses-by-category'
      total: number
      transactions: Transaction[]
      categories: Category[]
    }
  | {
      type: 'investments'
      total: number
      entries: InvestmentEntry[]
      types: InvestmentType[]
    }

const TITLE: Record<DrawerData['type'], string> = {
  income: 'פירוט הכנסות',
  expenses: 'פירוט הוצאות',
  'expenses-by-category': 'הוצאות לפי קטגוריה',
  investments: 'פירוט השקעות',
}

function fmt(n: number) { return n.toLocaleString('he-IL') }
function fmtIls(n: number) { return `₪${fmt(Math.abs(n))}` }
function formatDate(d: string) {
  const [, mm, dd] = d.split('-')
  return `${dd}/${mm}`
}

function txAmount(tx: Transaction) {
  if (tx.amount < 0) return <span className="text-green-400">₪{fmt(Math.abs(tx.amount))}<span className="text-xs text-green-500/70 mr-1">זיכוי</span></span>
  return <span className="text-slate-200">{fmtIls(tx.amount)}</span>
}

function SectionBlock({ title, total, color, children }: {
  title: string
  total: number
  color?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <span className="font-semibold text-sm tabular-nums" dir="ltr">{fmtIls(total)}</span>
      </div>
      <div className="px-4 divide-y divide-slate-800/60">{children}</div>
    </div>
  )
}

function Row({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2.5 gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{label}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
      <div className="flex-shrink-0 text-sm tabular-nums" dir="ltr">{right}</div>
    </div>
  )
}

function IncomeBreakdown({ data }: { data: Extract<DrawerData, { type: 'income' }> }) {
  const { salary, salaryDate, dividends, incomeTransactions } = data
  const hasDivs = dividends.some(d => d.ilsEquivalent)

  type FlatItem = { key: string; date: string | null; label: string; amount: number }

  const items: FlatItem[] = []
  if (salary) {
    items.push({ key: 'salary', date: salaryDate ?? null, label: salary.employerName || 'משכורת', amount: salary.netAmount })
  }
  for (const tx of incomeTransactions) {
    items.push({ key: tx.id, date: tx.date, label: tx.merchantName, amount: tx.amount })
  }
  items.sort((a, b) => {
    if (!a.date) return -1
    if (!b.date) return 1
    return b.date.localeCompare(a.date)
  })

  const isEmpty = items.length === 0 && !hasDivs

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="bg-surface rounded-xl px-4 divide-y divide-slate-800/60">
          {items.map(item => (
            <div key={item.key} className="flex items-center gap-2 py-2.5">
              <span className="text-xs text-slate-500 tabular-nums flex-shrink-0" style={{ width: '2.5rem' }}>
                {item.date ? formatDate(item.date) : '—'}
              </span>
              <span className="flex-1 text-sm truncate">{item.label}</span>
              <span className="text-sm tabular-nums text-green-400 flex-shrink-0" dir="ltr">
                {fmtIls(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasDivs && (
        <SectionBlock title="דיבידנדים" total={dividends.reduce((s, d) => s + (d.ilsEquivalent ?? 0), 0)}>
          {dividends.filter(d => d.ilsEquivalent).map(d => (
            <Row key={d.id} label={formatDate(d.date)}
              sub={`${d.currency} ${fmt(d.amount)}`}
              right={<span className="text-green-400">{fmtIls(d.ilsEquivalent!)}</span>} />
          ))}
        </SectionBlock>
      )}

      {isEmpty && (
        <p className="text-slate-500 text-sm text-center py-8">אין נתוני הכנסה לחודש זה</p>
      )}
    </div>
  )
}

function ExpensesBreakdown({ data }: { data: Extract<DrawerData, { type: 'expenses' }> }) {
  const { transactions, accounts } = data

  const creditAccounts = accounts.filter(a => a.type === 'credit')
  const bankAccountIds = new Set(accounts.filter(a => a.type === 'bank').map(a => a.id))
  const cashAccountIds = new Set(accounts.filter(a => a.type === 'cash').map(a => a.id))

  const creditSummaries = creditAccounts
    .map(ca => ({
      account: ca,
      total: transactions.filter(t => t.accountId === ca.id).reduce((s, t) => s + t.amount, 0),
    }))
    .filter(cs => cs.total > 0)
    .sort((a, b) => b.total - a.total)

  const bankTxs = transactions.filter(t => bankAccountIds.has(t.accountId))
  const cashTxs = transactions.filter(t => cashAccountIds.has(t.accountId))
  const bankTotal = bankTxs.reduce((s, t) => s + t.amount, 0)
  const cashTotal = cashTxs.reduce((s, t) => s + t.amount, 0)

  const isEmpty = creditSummaries.length === 0 && bankTxs.length === 0 && cashTxs.length === 0

  return (
    <div className="space-y-3">
      {creditSummaries.map(({ account, total }) => (
        <SectionBlock key={account.id} title={account.name} total={total} color={account.color}>
          {null}
        </SectionBlock>
      ))}

      {bankTxs.length > 0 && (
        <SectionBlock title="הוצאות בנק ישיר" total={bankTotal}>
          {[...bankTxs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map(t => (
            <Row key={t.id} label={t.merchantName} sub={formatDate(t.date)} right={txAmount(t)} />
          ))}
        </SectionBlock>
      )}

      {cashTxs.length > 0 && (
        <SectionBlock title="הוצאות מזומן" total={cashTotal}>
          {[...cashTxs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map(t => (
            <Row key={t.id} label={t.merchantName} sub={formatDate(t.date)} right={txAmount(t)} />
          ))}
        </SectionBlock>
      )}

      {isEmpty && (
        <p className="text-slate-500 text-sm text-center py-8">אין הוצאות לחודש זה</p>
      )}
    </div>
  )
}

function CategoryBreakdown({ data }: { data: Extract<DrawerData, { type: 'expenses-by-category' }> }) {
  const { transactions, categories } = data

  const byCategory: Record<string, Transaction[]> = {}
  const uncategorized: Transaction[] = []

  for (const tx of transactions) {
    if (tx.categoryId) {
      if (!byCategory[tx.categoryId]) byCategory[tx.categoryId] = []
      byCategory[tx.categoryId].push(tx)
    } else {
      uncategorized.push(tx)
    }
  }

  const catGroups = categories
    .filter(c => byCategory[c.id]?.length)
    .map(c => ({ cat: c, txs: byCategory[c.id], total: byCategory[c.id].reduce((s, t) => s + t.amount, 0) }))
    .sort((a, b) => b.total - a.total)

  const uncatTotal = uncategorized.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-3">
      {catGroups.map(({ cat, txs, total }) => (
        <SectionBlock key={cat.id} title={cat.name} total={total} color={cat.color}>
          {[...txs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map(t => (
            <Row key={t.id} label={t.merchantName} sub={formatDate(t.date)} right={txAmount(t)} />
          ))}
        </SectionBlock>
      ))}

      {uncategorized.length > 0 && (
        <SectionBlock title="ללא קטגוריה" total={uncatTotal}>
          {[...uncategorized].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map(t => (
            <Row key={t.id} label={t.merchantName} sub={formatDate(t.date)} right={txAmount(t)} />
          ))}
        </SectionBlock>
      )}

      {transactions.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">אין הוצאות לחודש זה</p>
      )}
    </div>
  )
}

function InvestmentsBreakdown({ data }: { data: Extract<DrawerData, { type: 'investments' }> }) {
  const { entries, types } = data

  const typeMap = Object.fromEntries(types.map(t => [t.id, t]))
  const byType: Record<string, InvestmentEntry[]> = {}

  for (const e of entries) {
    if (!byType[e.investmentTypeId]) byType[e.investmentTypeId] = []
    byType[e.investmentTypeId].push(e)
  }

  const groups = Object.entries(byType)
    .map(([typeId, es]) => ({
      type: typeMap[typeId],
      entries: es,
      total: es.reduce((s, e) => s + e.amount, 0),
    }))
    .filter(g => g.type)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-3">
      {groups.map(({ type, entries: es, total }) => (
        <SectionBlock key={type.id} title={type.name}
          total={total}>
          {[...es].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
            <Row key={e.id} label={formatDate(e.date)}
              right={
                <span className="text-accent">
                  {e.currency !== 'ILS' ? `${e.currency} ` : '₪'}{fmt(e.amount)}
                </span>
              } />
          ))}
          {type.currency !== 'ILS' && (
            <div className="py-2 text-xs text-slate-500">
              סה״כ: {type.currency} {fmt(total)}
            </div>
          )}
        </SectionBlock>
      ))}

      {entries.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">אין השקעות לחודש זה</p>
      )}
    </div>
  )
}

interface Props {
  data: DrawerData
  onClose: () => void
}

export function BreakdownDrawer({ data, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl flex flex-col max-h-[92vh]">
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* header */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-800 flex-shrink-0">
          <h2 className="font-bold text-base">{TITLE[data.type]}</h2>
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold tabular-nums" dir="ltr">
              {fmtIls(data.total)}
            </span>
            <button onClick={onClose}
              className="text-slate-400 hover:text-foreground text-lg leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-800">
              ✕
            </button>
          </div>
        </div>

        {/* scrollable content */}
        <div className="overflow-y-auto p-4 pb-8">
          {data.type === 'income' && <IncomeBreakdown data={data} />}
          {data.type === 'expenses' && <ExpensesBreakdown data={data} />}
          {data.type === 'expenses-by-category' && <CategoryBreakdown data={data} />}
          {data.type === 'investments' && <InvestmentsBreakdown data={data} />}
        </div>
      </div>
    </div>
  )
}
