import type { ImportedTransaction } from '@/lib/types'

export interface SwipeRow extends ImportedTransaction {
  skip: boolean
  skipReason?: string
  portfolioAccountId?: string
  investmentTypeId?: string
  investmentDirection?: 'investment' | 'divestment'
}

export type CardStatus = 'pending' | 'approved' | 'skipped'

export interface DeckCard extends SwipeRow {
  _id: string
  status: CardStatus
}

export interface UndoEntry {
  index: number
  previous: DeckCard
}

export interface DeckTotals {
  income: number
  expenses: number
  net: number
}

export function sortDeckCards(cards: DeckCard[]): DeckCard[] {
  const isUncategorizedExpense = (c: DeckCard) =>
    c.direction === 'expense' && !c.categoryId && !c.portfolioAccountId && !c.skip

  const uncategorized = cards
    .filter(isUncategorizedExpense)
    .sort((a, b) => a.date.localeCompare(b.date))

  const otherActive = cards
    .filter(c => !isUncategorizedExpense(c) && !c.skip)
    .sort((a, b) => a.date.localeCompare(b.date))

  const skipped = cards.filter(c => c.skip)

  return [...uncategorized, ...otherActive, ...skipped]
}

export function computeTotals(cards: DeckCard[]): DeckTotals {
  const approved = cards.filter(c => c.status === 'approved')
  let income = 0
  let expenses = 0
  for (const c of approved) {
    const dir = c.portfolioAccountId
      ? (c.investmentDirection ?? 'investment')
      : c.direction
    if (dir === 'income' || dir === 'divestment') {
      income += c.amount
    } else {
      expenses += c.amount
    }
  }
  return { income, expenses, net: income - expenses }
}

export function computeDisplayTotals(cards: DeckCard[]): DeckTotals {
  // Include pending + approved; exclude explicitly skipped and pre-skipped
  const visible = cards.filter(c => c.status !== 'skipped' && !c.skip)
  let income = 0
  let expenses = 0
  for (const c of visible) {
    const dir = c.portfolioAccountId
      ? (c.investmentDirection ?? 'investment')
      : c.direction
    if (dir === 'income' || dir === 'divestment') {
      income += c.amount
    } else {
      expenses += c.amount
    }
  }
  return { income, expenses, net: income - expenses }
}
