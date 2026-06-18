import type { ImportedTransaction, Transaction } from '../types'

export interface DuplicateMatch {
  incoming: ImportedTransaction
  existing: Transaction
}

export interface DuplicateCheckResult {
  duplicates: DuplicateMatch[]
  clean: ImportedTransaction[]
}

export function detectDuplicates(
  incoming: ImportedTransaction[],
  existing: Transaction[],
): DuplicateCheckResult {
  const duplicates: DuplicateMatch[] = []
  const clean: ImportedTransaction[] = []

  for (const tx of incoming) {
    const match = existing.find(
      e =>
        e.date === tx.date &&
        Math.abs(e.amount) === tx.amount &&
        e.merchantName === tx.merchantName
    )
    if (match) {
      duplicates.push({ incoming: tx, existing: match })
    } else {
      clean.push(tx)
    }
  }
  return { duplicates, clean }
}
