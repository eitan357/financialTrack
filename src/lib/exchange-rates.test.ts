import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getExchangeRates, ilsValue, _resetCache } from './exchange-rates'

describe('exchange-rates', () => {
  beforeEach(() => {
    _resetCache()
    vi.clearAllMocks()
  })

  it('fetches from the correct URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ils: { usd: 0.25, eur: 0.23 } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await getExchangeRates()

    expect(mockFetch).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/ils.json')
  })

  it('inverts rates correctly (ils.usd = 0.25 → USD rate = 4.0)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ils: { usd: 0.25, eur: 0.23 } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const rates = await getExchangeRates()

    expect(rates['USD']).toBe(4.0)
    expect(rates['EUR']).toBeCloseTo(1 / 0.23, 5)
  })

  it('returns empty object on HTTP error (res.ok = false)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    })
    vi.stubGlobal('fetch', mockFetch)

    const rates = await getExchangeRates()

    expect(rates).toEqual({})
  })

  it('returns empty object on network error (fetch throws)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const rates = await getExchangeRates()

    expect(rates).toEqual({})
  })

  it('returns cached result without re-fetching within 1 hour', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ils: { usd: 0.25 } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const rates1 = await getExchangeRates()
    const rates2 = await getExchangeRates()

    expect(rates1).toEqual(rates2)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('ilsValue(100, "ILS", {}) returns 100', () => {
    const result = ilsValue(100, 'ILS', {})
    expect(result).toBe(100)
  })

  it('ilsValue(100, "USD", { USD: 3.7 }) returns 370', () => {
    const result = ilsValue(100, 'USD', { USD: 3.7 })
    expect(result).toBe(370)
  })

  it('ilsValue(100, "XYZ", {}) returns null', () => {
    const result = ilsValue(100, 'XYZ', {})
    expect(result).toBeNull()
  })
})
