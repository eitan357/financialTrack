import type { Account, Transaction } from '@/lib/types'

export interface CreditPaymentInfo {
  creditAccountId: string
  creditAccountName: string
  creditColor: string
  bankAccountId: string | null
  date: string   // YYYY-MM-DD (payment date in month)
  amount: number // sum of credit card expense transactions
  month: string  // YYYY-MM
}

export function computeCreditPayments(
  accounts: Account[],
  transactions: Transaction[],
  month: string
): CreditPaymentInfo[] {
  return accounts
    .filter(a => a.type === 'credit' && a.isActive)
    .flatMap(ca => {
      const total = transactions
        .filter(t => t.accountId === ca.id && t.direction !== 'income')
        .reduce((s, t) => s + t.amount, 0)
      if (total <= 0) return []
      const day = Math.min(ca.creditPaymentDay ?? 1, 28)
      const date = `${month}-${String(day).padStart(2, '0')}`
      return [{
        creditAccountId: ca.id,
        creditAccountName: ca.name,
        creditColor: ca.color,
        bankAccountId: ca.linkedBankAccountId ?? null,
        date,
        amount: total,
        month,
      }]
    })
}
