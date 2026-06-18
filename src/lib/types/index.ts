export type AccountType = 'credit' | 'bank' | 'cash'

export interface Account {
  id: string
  name: string
  type: AccountType
  last4digits?: string
  color: string
  isActive: boolean
  csvIdentifier?: string // keyword to search in CSV file to auto-detect this card's section
  sortOrder?: number
  linkedBankAccountId?: string // credit only: which bank account pays this credit card
  creditPaymentDay?: number    // credit only: day of month the bank pays (1-28)
}

export interface Category {
  id: string
  name: string
  monthlyTarget?: number
  color: string
  isActive: boolean
  sortOrder?: number
}

export type MatchType = 'contains' | 'exact' | 'startsWith'

export interface CategorizationRule {
  id: string
  keyword: string
  matchType: MatchType
  categoryId: string
  priority: number
  createdAt: string // ISO date string
}

export type TransactionSource = 'csv_import' | 'xlsx_import' | 'manual'

export interface SalaryDeductions {
  incomeTax: number
  nationalInsurance: number
  healthInsurance: number
  pension: number
  trainingFund: number
}

export interface SalaryDetails {
  grossAmount: number
  deductions: SalaryDeductions
  netAmount: number
  employerName?: string
}

export interface Transaction {
  id: string
  date: string // ISO date string
  merchantName: string
  description?: string
  amount: number
  currency: string
  accountId: string
  categoryId?: string
  source: TransactionSource
  isImmediate: boolean
  month: string // YYYY-MM
  direction?: 'income' | 'expense' // undefined = 'expense' for backward compat
  salaryDetails?: SalaryDetails
}

export interface SalaryEntry {
  id: string
  month: string // YYYY-MM
  employerName: string
  grossAmount: number
  deductions: SalaryDeductions
  netAmount: number
  notes?: string
}

export interface IncomeEntry {
  id: string
  month: string // YYYY-MM
  sourceName: string
  amount: number
  currency: string // defaults to 'ILS' in practice
  date: string // ISO date string
  notes?: string
}

export interface InvestmentType {
  id: string
  name: string
  currency: string
  notes?: string
}

export interface InvestmentEntry {
  id: string
  date: string // ISO date string
  month: string // YYYY-MM, derived from date, used for Firestore queries
  investmentTypeId: string
  amount: number
  currency: string
  notes?: string
}

export interface InvestmentConversion {
  id: string
  date: string // ISO date string
  investmentTypeId: string
  ilsReceived: number
  foreignAmountReduced?: number
  notes?: string
}

export interface Dividend {
  id: string
  month: string // YYYY-MM
  investmentTypeId: string
  amount: number
  currency: string
  ilsEquivalent?: number
  date: string // ISO date string
  notes?: string
}

export interface BankReconciliation {
  id: string
  month: string // YYYY-MM
  accountId: string
  actualBalance: number
  expectedBalance: number
  date: string // ISO date string
  notes?: string
}

// Per-month override targets. Takes precedence over Category.monthlyTarget (which serves as default).
export interface MonthlySettings {
  id: string
  month: string // YYYY-MM
  categoryTargets: Record<string, number> // categoryId → override target amount
}

// Intermediate type produced by transaction-mapper from a CSV/XLSX row
export interface RawTransaction {
  date: string         // ISO YYYY-MM-DD
  merchantName: string
  bankCategory: string // the bank's own category string (used as fallback suggestion)
  amount: number
  currency: string
  isImmediate: boolean // true when סוג עסקה === 'חיוב עסקות מיידי'
  notes: string
}

// RawTransaction after the categorization engine has run
export interface ImportedTransaction extends RawTransaction {
  categoryId: string | null
  categorizationSource: 'rule' | 'history' | 'manual' | null
}
