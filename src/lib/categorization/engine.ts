import type { CategorizationRule, Transaction } from '../types'

export interface CategorizationResult {
  categoryId: string | null
  source: 'rule' | 'history' | null
  ruleId?: string
}

function matches(merchantName: string, rule: CategorizationRule): boolean {
  const name = merchantName.toLowerCase()
  const kw = rule.keyword.toLowerCase()
  switch (rule.matchType) {
    case 'contains':
      return name.includes(kw)
    case 'exact':
      return name === kw
    case 'startsWith':
      return name.startsWith(kw)
  }
}

export function categorize(
  merchantName: string,
  rules: CategorizationRule[],
  history: Transaction[]
): CategorizationResult {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  for (const rule of sorted) {
    if (matches(merchantName, rule)) {
      return { categoryId: rule.categoryId, source: 'rule', ruleId: rule.id }
    }
  }
  const past = history.find(t => t.merchantName === merchantName && t.categoryId)
  if (past?.categoryId) {
    return { categoryId: past.categoryId, source: 'history' }
  }
  return { categoryId: null, source: null }
}
