const API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/ils.json'
const CACHE_TTL_MS = 60 * 60 * 1000

let cache: { rates: Record<string, number>; fetchedAt: number } | null = null

export async function getExchangeRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.rates
  try {
    const res = await fetch(API_URL)
    if (!res.ok) return {}
    const data = await res.json() as { ils: Record<string, number> }
    const rates: Record<string, number> = {}
    for (const [code, ilsPerUnit] of Object.entries(data.ils)) {
      if (ilsPerUnit > 0) rates[code.toUpperCase()] = 1 / ilsPerUnit
    }
    cache = { rates, fetchedAt: Date.now() }
    return rates
  } catch {
    return {}
  }
}

export function ilsValue(amount: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === 'ILS') return amount
  const rate = rates[currency]
  if (!rate) return null
  return amount * rate
}

export function _resetCache() {
  cache = null
}
