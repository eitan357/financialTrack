/**
 * settings-mutations.ts
 *
 * THE ONLY PLACE that should mutate account and category settings.
 *
 * PRINCIPLE: Settings changes must never retroactively alter how historical
 * data is displayed. Concretely:
 *
 *   - isActive       → controls UI pickers and tab visibility only.
 *                      Historical transactions are always visible regardless.
 *   - name / color   → cosmetic; safe to update globally (no data-integrity impact).
 *   - sortOrder      → display order only.
 *   - linkedBankAccountId / creditPaymentDay → TEMPORAL: new values only apply
 *                      from the current month onwards. Past months keep the old
 *                      linkage via linkedBankHistory.
 *   - type           → FORBIDDEN on existing accounts. Changing an account's
 *                      type would move all historical transactions to the wrong
 *                      tab. If the type was wrong, delete the account and recreate.
 *
 * Future developers: if you need a new settings field that affects how
 * historical data is displayed, follow the linkedBankHistory pattern —
 * store a snapshot array with fromMonth so past months are unaffected.
 */

import { updateAccount, appendLinkedBankSnapshot } from './firestore/accounts'
import { updateCategory } from './firestore/categories'
import { updateInvestmentType } from './firestore/investments'
import type { LinkedBankSnapshot, AccountProvider } from './types'

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

// ---------------------------------------------------------------------------
// Account mutations
// ---------------------------------------------------------------------------

/** Cosmetic — safe to apply globally. */
export async function updateAccountMeta(
  id: string,
  fields: { name?: string; color?: string; last4digits?: string; csvIdentifier?: string; provider?: AccountProvider }
): Promise<void> {
  await updateAccount(id, fields)
}

/**
 * Controls tab visibility and picker inclusion only.
 * Historical transactions are always visible regardless of isActive.
 */
export async function setAccountActive(id: string, isActive: boolean): Promise<void> {
  await updateAccount(id, { isActive })
}

/** Display order only — no impact on data. */
export async function reorderAccounts(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
  await Promise.all(updates.map(u => updateAccount(u.id, { sortOrder: u.sortOrder })))
}

/**
 * Non-retroactive credit linkage update.
 *
 * Appends a new LinkedBankSnapshot with fromMonth = current month.
 * computeCreditPayments will use this snapshot for the current month onwards
 * and will use older snapshots for past months, so history is preserved.
 *
 * Also updates the convenience fields linkedBankAccountId / creditPaymentDay
 * so code that reads those directly still gets the latest values.
 *
 * Pass fromMonth explicitly when you want the change to take effect from a
 * specific month (e.g. when seeding initial data use '2000-01' so it covers all history).
 */
export async function updateCreditLinkage(
  id: string,
  bankId: string,
  paymentDay?: number,
  fromMonth: string = currentMonth()
): Promise<void> {
  const snapshot: LinkedBankSnapshot = {
    bankId,
    fromMonth,
    ...(paymentDay !== undefined ? { paymentDay } : {}),
  }
  await appendLinkedBankSnapshot(id, snapshot)
}

// ---------------------------------------------------------------------------
// Category mutations
// ---------------------------------------------------------------------------

/** Cosmetic — safe to apply globally. */
export async function updateCategoryMeta(
  id: string,
  fields: { name?: string; color?: string }
): Promise<void> {
  await updateCategory(id, fields)
}

/**
 * Controls picker inclusion only.
 * computeDashboard shows categories with actual spending regardless of isActive,
 * so hiding a category never makes past expenses disappear from the breakdown.
 */
export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  await updateCategory(id, { isActive })
}

/** Display order only — no impact on data. */
export async function reorderCategories(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
  await Promise.all(updates.map(u => updateCategory(u.id, { sortOrder: u.sortOrder })))
}

// ---------------------------------------------------------------------------
// Investment type mutations
// ---------------------------------------------------------------------------

/**
 * Cosmetic — safe to apply globally.
 * Does NOT allow changing portfolioAccountId: that would retroactively
 * re-assign historical entries to a different portfolio.
 */
export async function updateInvestmentTypeMeta(
  id: string,
  fields: { name?: string; currency?: string; notes?: string }
): Promise<void> {
  await updateInvestmentType(id, fields)
}

/**
 * Controls picker inclusion only.
 * Historical InvestmentEntry records still reference this type by ID
 * and are fully visible in the investments page regardless of isActive.
 */
export async function setInvestmentTypeActive(id: string, isActive: boolean): Promise<void> {
  await updateInvestmentType(id, { isActive })
}
