export type AccountType = 'credit' | 'bank' | 'cash'

export interface Account {
  id: string
  name: string
  type: AccountType
  last4digits?: string
  color: string
  isActive: boolean
}

export interface Category {
  id: string
  name: string
  monthlyTarget?: number
  color: string
  isActive: boolean
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
}

export interface SalaryDeductions {
  incomeTax: number
  nationalInsurance: number
  healthInsurance: number
  pension: number
  trainingFund: number
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

export interface MonthlySettings {
  id: string
  month: string // YYYY-MM
  categoryTargets: Record<string, number> // categoryId → target amount
}
