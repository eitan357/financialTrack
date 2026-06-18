import type { Account, LinkedBankSnapshot, Transaction } from '@/lib/types'

export interface CreditPaymentInfo {
  creditAccountId: string
  creditAccountName: string
  creditColor: string
  bankAccountId: string | null
  date: string   // YYYY-MM-DD (payment date in month)
  amount: number // sum of credit card expense transactions
  month: string  // YYYY-MM
}

/**
 * Returns the LinkedBankSnapshot that was active for the given month.
 * Uses linkedBankHistory for non-retroactive lookups:
 *   - Find the most recent snapshot where fromMonth <= month
 *   - Fall back to linkedBankAccountId / creditPaymentDay if no history exists
 */
function resolveSnapshot(
  account: Account,
  month: string
): { bankId: string | null; paymentDay: number } {
  const history = account.linkedBankHistory

  if (history && history.length > 0) {
    // Sort descending by fromMonth and find the first one that applies
    const applicable = [...history]
      .sort((a, b) => b.fromMonth.localeCompare(a.fromMonth))
      .find((s: LinkedBankSnapshot) => s.fromMonth <= month)

    if (applicable) {
      return {
        bankId: applicable.bankId,
        paymentDay: Math.min(applicable.paymentDay ?? 1, 28),
      }
    }
  }

  // Backward-compatible fallback for accounts without history
  return {
    bankId: account.linkedBankAccountId ?? null,
    paymentDay: Math.min(account.creditPaymentDay ?? 1, 28),
  }
}

export function computeCreditPayments(
  accounts: Account[],
  transactions: Transaction[],
  month: string
): CreditPaymentInfo[] {
  // All credit accounts — isActive only controls the tab, not historical data
  return accounts
    .filter(a => a.type === 'credit')
    .flatMap(ca => {
      const total = transactions
        .filter(t => t.accountId === ca.id && t.direction !== 'income')
        .reduce((s, t) => s + t.amount, 0)
      if (total <= 0) return []

      const { bankId, paymentDay } = resolveSnapshot(ca, month)
      const date = `${month}-${String(paymentDay).padStart(2, '0')}`

      return [{
        creditAccountId: ca.id,
        creditAccountName: ca.name,
        creditColor: ca.color,
        bankAccountId: bankId,
        date,
        amount: total,
        month,
      }]
    })
}
